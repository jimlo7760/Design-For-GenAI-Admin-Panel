-- Mod Squad Admin Panel: the database side.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER every file in the Mod Squad repo's supabase/ folder. Safe to re-run.
--
-- The admin panel signs in with the same Google login as Mod Squad and talks to the database as
-- that signed-in person, with the public anon key. There is no service-role key anywhere in the
-- admin app. What lets an admin see and change more than a normal user is decided here, in the
-- database, by one column: profiles.is_superadmin.
--
--   1. profiles.is_superadmin       false for everyone. Nobody can set it through the API,
--                                   not even an admin (a trigger refuses, see section 2).
--   2. is_superadmin()              the one yes/no question every rule below asks.
--   3. Policies                     admins may read every vote and part search, delete any build,
--                                   and manage files in the build-renders bucket.
--   4. admin_* functions            users with emails, the vote log, create/update a build.
--                                   Each starts by checking is_superadmin() and refuses otherwise.
--
-- Becoming the first admin cannot happen through the app, on purpose. Run this yourself in the SQL
-- editor (it runs as the project owner, which the rules above do not apply to):
--
--   update public.profiles set is_superadmin = true
--    where id = (select id from auth.users where email = 'you@example.com');
--
-- Re-running Mod Squad's profiles.sql or assignment4.sql later is safe: they put back table-wide
-- grants on profiles, but the trigger in section 2 does not depend on grants.


-- 0. make sure the Mod Squad tables are here -----------------------------------
do $$
begin
    if to_regclass('public.profiles') is null
       or to_regclass('public.builds') is null
       or to_regclass('public.build_votes') is null then
        raise exception 'Run the Mod Squad SQL files first (profiles.sql, then assignment4.sql, assignment4_photos.sql, assignment4_render.sql, assignment4_edit.sql): profiles, builds or build_votes is missing.';
    end if;

    if (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'builds'
           and column_name in ('render_url', 'render_model', 'rendered_at',
                               'image_url', 'image_source_url', 'image_credit', 'image_license',
                               'mods_edited_at')) < 8 then
        raise exception 'builds is missing columns from assignment4_photos.sql, assignment4_render.sql or assignment4_edit.sql. Run those Mod Squad files first, in order.';
    end if;
end $$;


-- 1. the flag -------------------------------------------------------------------
alter table public.profiles
    add column if not exists is_superadmin boolean not null default false;


-- 2. nobody promotes themselves -------------------------------------------------
-- Mod Squad lets every signed-in user update their own profile row straight from the browser, so
-- without this a user could run
--     supabase.from('profiles').update({ is_superadmin: true }).eq('id', myId)
-- with the public anon key and own the admin panel.
--
-- current_user is the role Postgres is running the statement as. Everything that arrives through
-- the Supabase API (the browser, a Server Action, anyone holding the anon key) runs as `anon` or
-- `authenticated`. The SQL editor and the Table editor run as `postgres`, and the service-role key
-- as `service_role`; those are the owner's tools and may change the flag.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' and new.is_superadmin then
            raise exception 'is_superadmin can only be set from the Supabase SQL editor.' using errcode = '42501';
        end if;
        if tg_op = 'UPDATE' and new.is_superadmin is distinct from old.is_superadmin then
            raise exception 'is_superadmin can only be changed from the Supabase SQL editor.' using errcode = '42501';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_protect_superadmin on public.profiles;
create trigger profiles_protect_superadmin
    before insert or update on public.profiles
    for each row execute function public.protect_superadmin_flag();


-- 3. is_superadmin() ------------------------------------------------------------
-- security definer so it can read profiles whatever the caller's own rights are, and so a policy
-- on profiles could call it without recursing. (select auth.uid()) is evaluated once per query.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
        false
    );
$$;

revoke all on function public.is_superadmin() from public, anon, authenticated;
grant execute on function public.is_superadmin() to authenticated;


-- 4. policies for admins --------------------------------------------------------
-- Policies are OR-ed with the existing ones, so these only ever add rights for an admin.

-- Votes: Mod Squad shows each person only their own. An admin reads all of them (read only: there
-- is deliberately no insert, update or delete policy for admins).
drop policy if exists "Superadmins can read all votes" on public.build_votes;
create policy "Superadmins can read all votes"
    on public.build_votes for select to authenticated
    using ((select public.is_superadmin()));

-- Builds: owners can already delete their own. An admin can delete any (the votes go with it).
drop policy if exists "Superadmins can delete any build" on public.builds;
create policy "Superadmins can delete any build"
    on public.builds for delete to authenticated
    using ((select public.is_superadmin()));

-- Part searches: nobody could read this table. Admins can, for the "most wanted parts" chart.
-- (Only exists once assignment4_edit.sql has been run.)
do $$
begin
    if to_regclass('public.part_searches') is not null then
        grant select on public.part_searches to authenticated;
        drop policy if exists "Superadmins can read part searches" on public.part_searches;
        create policy "Superadmins can read part searches"
            on public.part_searches for select to authenticated
            using ((select public.is_superadmin()));
    end if;
end $$;

-- Storage: an admin can add, replace and remove AI renders for any build. Removing a file needs the
-- select policy as well, because Postgres checks it for the rows a DELETE ... WHERE touches.
drop policy if exists "Superadmins can read renders" on storage.objects;
create policy "Superadmins can read renders"
    on storage.objects for select to authenticated
    using (bucket_id = 'build-renders' and (select public.is_superadmin()));

drop policy if exists "Superadmins can upload renders" on storage.objects;
create policy "Superadmins can upload renders"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'build-renders' and (select public.is_superadmin()));

drop policy if exists "Superadmins can delete renders" on storage.objects;
create policy "Superadmins can delete renders"
    on storage.objects for delete to authenticated
    using (bucket_id = 'build-renders' and (select public.is_superadmin()));


-- 5. admin_users: every user, with the numbers the admin panel shows -------------
-- Emails and sign-in times live in auth.users, which the API does not expose, so the panel gets
-- them through this function. p_id returns one user; p_search matches name or email; p_sort is one
-- of newest, name, builds, votes, score, active.
-- total_count is the number of matching users before limit/offset, for paging.
create or replace function public.admin_users(
    p_search text    default null,
    p_id     uuid    default null,
    p_sort   text    default 'newest',
    p_limit  integer default 50,
    p_offset integer default 0
)
returns table (
    id                uuid,
    email             text,
    first_name        text,
    last_name         text,
    avatar_url        text,
    is_superadmin     boolean,
    created_at        timestamptz,
    last_sign_in_at   timestamptz,
    provider          text,
    builds_count      integer,
    renders_count     integer,
    upvotes_received  integer,
    downvotes_received integer,
    score_total       integer,
    last_build_at     timestamptz,
    votes_cast        integer,
    upvotes_cast      integer,
    downvotes_cast    integer,
    last_vote_at      timestamptz,
    total_count       bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
    if not public.is_superadmin() then
        raise exception 'Admins only.' using errcode = '42501';
    end if;

    return query
    with b as (
        select user_id,
               count(*)::integer                       as builds_count,
               count(render_url)::integer              as renders_count,
               coalesce(sum(upvotes), 0)::integer      as upvotes_received,
               coalesce(sum(downvotes), 0)::integer    as downvotes_received,
               coalesce(sum(score), 0)::integer        as score_total,
               max(created_at)                         as last_build_at
          from public.builds
         group by user_id
    ),
    v as (
        select user_id,
               count(*)::integer                                  as votes_cast,
               (count(*) filter (where value = 1))::integer       as upvotes_cast,
               (count(*) filter (where value = -1))::integer      as downvotes_cast,
               max(created_at)                                    as last_vote_at
          from public.build_votes
         group by user_id
    )
    select p.id,
           u.email::text,
           p.first_name,
           p.last_name,
           p.avatar_url,
           p.is_superadmin,
           p.created_at,
           u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'provider', 'unknown'),
           coalesce(b.builds_count, 0),
           coalesce(b.renders_count, 0),
           coalesce(b.upvotes_received, 0),
           coalesce(b.downvotes_received, 0),
           coalesce(b.score_total, 0),
           b.last_build_at,
           coalesce(v.votes_cast, 0),
           coalesce(v.upvotes_cast, 0),
           coalesce(v.downvotes_cast, 0),
           v.last_vote_at,
           count(*) over ()
      from public.profiles p
      join auth.users u on u.id = p.id
      left join b on b.user_id = p.id
      left join v on v.user_id = p.id
     where (p_id is null or p.id = p_id)
       and (coalesce(p_search, '') = ''
            or u.email ilike '%' || p_search || '%'
            or concat_ws(' ', p.first_name, p.last_name) ilike '%' || p_search || '%')
     order by
        (case when p_sort = 'name'   then lower(concat_ws(' ', p.first_name, p.last_name, u.email)) end) asc nulls last,
        (case when p_sort = 'builds' then coalesce(b.builds_count, 0) end) desc nulls last,
        (case when p_sort = 'votes'  then coalesce(v.votes_cast, 0) end) desc nulls last,
        (case when p_sort = 'score'  then coalesce(b.score_total, 0) end) desc nulls last,
        (case when p_sort = 'active' then u.last_sign_in_at end) desc nulls last,
        p.created_at desc,
        p.id
     limit greatest(least(coalesce(p_limit, 50), 1000), 1)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_users(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_users(text, uuid, text, integer, integer) to authenticated;


-- 6. admin_votes: the vote log --------------------------------------------------
-- One row per vote with who voted, on what, and whose build it was. Filter by build, by voter, by
-- direction (1 or -1) or by a search word. Newest first.
create or replace function public.admin_votes(
    p_build_id uuid    default null,
    p_user_id  uuid    default null,
    p_value    integer default null,
    p_search   text    default null,
    p_limit    integer default 50,
    p_offset   integer default 0
)
returns table (
    vote_id          bigint,
    build_id         uuid,
    build_title      text,
    build_car        text,
    build_owner_id   uuid,
    build_owner_name text,
    voter_id         uuid,
    voter_name       text,
    voter_email      text,
    value            smallint,
    created_at       timestamptz,
    total_count      bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
    if not public.is_superadmin() then
        raise exception 'Admins only.' using errcode = '42501';
    end if;

    return query
    select bv.id,
           bv.build_id,
           b.title,
           b.car_name,
           b.user_id,
           nullif(concat_ws(' ', op.first_name, op.last_name), ''),
           bv.user_id,
           nullif(concat_ws(' ', vp.first_name, vp.last_name), ''),
           vu.email::text,
           bv.value,
           bv.created_at,
           count(*) over ()
      from public.build_votes bv
      join public.builds b       on b.id = bv.build_id
      left join public.profiles op on op.id = b.user_id
      left join public.profiles vp on vp.id = bv.user_id
      left join auth.users vu      on vu.id = bv.user_id
     where (p_build_id is null or bv.build_id = p_build_id)
       and (p_user_id  is null or bv.user_id  = p_user_id)
       and (p_value    is null or bv.value    = p_value)
       and (coalesce(p_search, '') = ''
            or b.title ilike '%' || p_search || '%'
            or b.car_name ilike '%' || p_search || '%'
            or vu.email ilike '%' || p_search || '%'
            or concat_ws(' ', vp.first_name, vp.last_name) ilike '%' || p_search || '%')
     order by bv.created_at desc, bv.id desc
     limit greatest(least(coalesce(p_limit, 50), 1000), 1)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_votes(uuid, uuid, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_votes(uuid, uuid, integer, text, integer, integer) to authenticated;


-- 7. creating and updating builds -----------------------------------------------
-- Clients have no INSERT or UPDATE right on most build columns (that is how Mod Squad keeps vote
-- counters and AI output honest), so the admin panel goes through these two functions. Table
-- constraints still apply (name and vibe lengths, Wikimedia-only photo links, render links only
-- into our own bucket), and so do Mod Squad's per-user daily limits on builds and renders.

-- A parts list is a JSON array of 1 to 12 objects, under 20 KB (the same rule as edit_build_mods).
create or replace function public.admin_valid_mods(p_mods jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select p_mods is not null
       and jsonb_typeof(p_mods) = 'array'
       and jsonb_array_length(p_mods) between 1 and 12
       and octet_length(p_mods::text) <= 20000;
$$;

revoke all on function public.admin_valid_mods(jsonb) from public, anon, authenticated;

create or replace function public.admin_create_build(
    p_user_id          uuid,
    p_car_name         text,
    p_vibe             text,
    p_title            text,
    p_tagline          text,
    p_mods             jsonb,
    p_cost             integer,
    p_model            text,
    p_prompt           text    default null,
    p_image_url        text    default null,
    p_image_source_url text    default null,
    p_image_credit     text    default null,
    p_image_license    text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if not public.is_superadmin() then
        raise exception 'Admins only.' using errcode = '42501';
    end if;

    if not exists (select 1 from public.profiles where id = p_user_id) then
        raise exception 'That user does not exist.' using errcode = '22023';
    end if;
    if not public.admin_valid_mods(p_mods) then
        raise exception 'The list of parts must have 1 to 12 parts.' using errcode = '22023';
    end if;
    if p_cost is not null and (p_cost < 0 or p_cost > 10000000) then
        raise exception 'That cost is not valid.' using errcode = '22023';
    end if;
    if coalesce(btrim(p_model), '') = '' then
        raise exception 'Say which model or author made this build.' using errcode = '22023';
    end if;

    insert into public.builds
        (user_id, car_name, vibe, prompt, model, title, tagline, mods, est_cost_usd,
         image_url, image_source_url, image_credit, image_license)
    values
        (p_user_id, p_car_name, p_vibe, coalesce(nullif(btrim(p_prompt), ''), 'Created in the admin panel.'),
         btrim(p_model), p_title, p_tagline, p_mods, p_cost,
         p_image_url, p_image_source_url, p_image_credit, p_image_license)
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.admin_create_build(uuid, text, text, text, text, jsonb, integer, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_create_build(uuid, text, text, text, text, jsonb, integer, text, text, text, text, text, text) to authenticated;

-- p_patch holds only the fields to change, as a JSON object. A key that is present is written (a
-- JSON null clears it); a key that is absent is left alone. Votes and counters cannot be written.
create or replace function public.admin_update_build(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    k       text;
    allowed text[] := array[
        'car_name', 'vibe', 'title', 'tagline', 'mods', 'est_cost_usd', 'model',
        'render_url', 'render_model', 'rendered_at',
        'image_url', 'image_source_url', 'image_credit', 'image_license'
    ];
begin
    if not public.is_superadmin() then
        raise exception 'Admins only.' using errcode = '42501';
    end if;
    if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
        raise exception 'Nothing to change.' using errcode = '22023';
    end if;

    for k in select jsonb_object_keys(p_patch) loop
        if not (k = any (allowed)) then
            raise exception 'The admin panel cannot change "%".', k using errcode = '22023';
        end if;
    end loop;

    if p_patch ? 'mods' and not public.admin_valid_mods(p_patch -> 'mods') then
        raise exception 'The list of parts must have 1 to 12 parts.' using errcode = '22023';
    end if;
    if p_patch ? 'est_cost_usd'
       and (p_patch ->> 'est_cost_usd') is not null
       and ((p_patch ->> 'est_cost_usd')::integer < 0 or (p_patch ->> 'est_cost_usd')::integer > 10000000) then
        raise exception 'That cost is not valid.' using errcode = '22023';
    end if;

    update public.builds b set
        car_name         = case when p_patch ? 'car_name'         then p_patch ->> 'car_name'         else b.car_name end,
        vibe             = case when p_patch ? 'vibe'             then p_patch ->> 'vibe'             else b.vibe end,
        title            = case when p_patch ? 'title'            then p_patch ->> 'title'            else b.title end,
        tagline          = case when p_patch ? 'tagline'          then p_patch ->> 'tagline'          else b.tagline end,
        mods             = case when p_patch ? 'mods'             then p_patch -> 'mods'              else b.mods end,
        est_cost_usd     = case when p_patch ? 'est_cost_usd'     then (p_patch ->> 'est_cost_usd')::integer else b.est_cost_usd end,
        model            = case when p_patch ? 'model'            then p_patch ->> 'model'            else b.model end,
        render_url       = case when p_patch ? 'render_url'       then p_patch ->> 'render_url'       else b.render_url end,
        render_model     = case when p_patch ? 'render_model'     then p_patch ->> 'render_model'     else b.render_model end,
        rendered_at      = case when p_patch ? 'rendered_at'      then (p_patch ->> 'rendered_at')::timestamptz else b.rendered_at end,
        image_url        = case when p_patch ? 'image_url'        then p_patch ->> 'image_url'        else b.image_url end,
        image_source_url = case when p_patch ? 'image_source_url' then p_patch ->> 'image_source_url' else b.image_source_url end,
        image_credit     = case when p_patch ? 'image_credit'     then p_patch ->> 'image_credit'     else b.image_credit end,
        image_license    = case when p_patch ? 'image_license'    then p_patch ->> 'image_license'    else b.image_license end
     where b.id = p_id;

    if not found then
        raise exception 'That build does not exist.' using errcode = 'P0002';
    end if;
end;
$$;

revoke all on function public.admin_update_build(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_build(uuid, jsonb) to authenticated;


-- Tell the API to pick up the new column and functions.
notify pgrst, 'reload schema';

-- Optional checks after running:
--   select id, first_name, is_superadmin from public.profiles;
--   select tgname from pg_trigger where tgname = 'profiles_protect_superadmin';
--   select proname from pg_proc where proname like 'admin\_%' or proname = 'is_superadmin';
