-- Mod Squad Admin Panel, Week 7: the tables behind the "observability" pages.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER supabase/admin.sql (it uses is_superadmin()). Safe to re-run.
--
-- What the admin panel does with each one (this is also exactly what the database allows):
--
--   prompt_chains            read
--   prompt_chain_steps       read
--   prompt_chain_mix         read, update the weight (nothing else)
--   terms                    create, read, update, delete
--   generation_requests      read   (a view over builds: nothing to keep in sync)
--   generation_examples      create, read, update, delete
--   llm_providers            create, read, update, delete
--   llm_models               create, read, update, delete
--   llm_responses            read   (a view over builds: the text and the render each model gave)
--   allowed_signup_domains   create, read, update, delete
--   whitelisted_emails       create, read, update, delete
--
-- Like the rest of the admin area, every rule here asks public.is_superadmin(). A normal signed-in
-- user, and anyone with only the anon key, gets nothing from these tables or views, and the admin
-- panel gets no more than the list above: for example there is no insert or delete right on
-- prompt_chains, so even a bug in the app could not change one.
--
-- Two of the lists, allowed_signup_domains and whitelisted_emails, are only the lists. Supabase
-- decides who may sign in; wiring these two tables into that (an auth hook, or a check in Mod
-- Squad's sign-in callback) is a separate step.


-- 0. make sure admin.sql has been run ------------------------------------------------
do $$
begin
    if to_regprocedure('public.is_superadmin()') is null then
        raise exception 'Run supabase/admin.sql first: public.is_superadmin() is missing.';
    end if;
    if to_regclass('public.builds') is null or to_regclass('public.profiles') is null then
        raise exception 'Run the Mod Squad SQL files first: profiles or builds is missing.';
    end if;
end $$;

-- "create table if not exists" skips a table that is already there, whatever its columns. If the
-- project already has a table of one of these names that is not the one described below, stop here
-- with a clear message rather than put row-level security rules on a table this script never made.
do $$
declare
    t record;
begin
    for t in
        select * from (values
            ('llm_providers',          'base_url'),
            ('llm_models',             'kind'),
            ('prompt_chains',          'is_active'),
            ('prompt_chain_steps',     'step_order'),
            ('prompt_chain_mix',       'weight'),
            ('terms',                  'definition'),
            ('generation_examples',    'expected_output'),
            ('allowed_signup_domains', 'domain'),
            ('whitelisted_emails',     'email')
        ) as v(tbl, col)
    loop
        if to_regclass('public.' || t.tbl) is not null
           and not exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = t.tbl and column_name = t.col) then
            raise exception 'public.% already exists but is not the table this script expects (it has no "%" column). Rename or drop it first, or adapt this file and lib/resources.js to it.', t.tbl, t.col;
        end if;
    end loop;

    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name in ('generation_requests', 'llm_responses')
                  and table_type = 'BASE TABLE') then
        raise exception 'public.generation_requests and public.llm_responses must be views over builds, but one of them is already a table. Rename or drop it first.';
    end if;
end $$;


-- 1. a helper that keeps updated_at honest --------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;


-- 2. LLM providers and models ----------------------------------------------------------
create table if not exists public.llm_providers (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique check (btrim(name) <> '' and char_length(name) <= 80),
    base_url   text check (base_url is null or (char_length(base_url) <= 300 and base_url ~* '^https?://')),
    notes      text check (notes is null or char_length(notes) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- name is what Mod Squad writes into builds.model / builds.render_model, so the two lists line up.
-- A provider cannot be deleted while a model still points at it (on delete restrict).
create table if not exists public.llm_models (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique check (btrim(name) <> '' and char_length(name) <= 120),
    provider_id uuid references public.llm_providers (id) on delete restrict,
    kind        text not null default 'text' check (kind in ('text', 'image')),
    is_active   boolean not null default true,
    notes       text check (notes is null or char_length(notes) <= 1000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists llm_models_provider_idx on public.llm_models (provider_id);


-- 3. prompt chains, their steps and their mix -------------------------------------------
create table if not exists public.prompt_chains (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique check (btrim(name) <> '' and char_length(name) <= 120),
    description text check (description is null or char_length(description) <= 2000),
    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
    id           uuid primary key default gen_random_uuid(),
    chain_id     uuid not null references public.prompt_chains (id) on delete cascade,
    step_order   integer not null check (step_order >= 1),
    name         text not null check (btrim(name) <> '' and char_length(name) <= 120),
    llm_model_id uuid references public.llm_models (id) on delete set null,
    system_prompt text check (system_prompt is null or char_length(system_prompt) <= 20000),
    user_prompt  text check (user_prompt is null or char_length(user_prompt) <= 20000),
    created_at   timestamptz not null default now(),
    unique (chain_id, step_order)
);
create index if not exists prompt_chain_steps_model_idx on public.prompt_chain_steps (llm_model_id);

-- The mix: how much of the traffic each chain should get. Weights are relative (3 and 1 is
-- 75% / 25%), and the admin panel shows each chain's share. There is exactly one row per chain,
-- created automatically below, so the panel only ever updates a weight.
create table if not exists public.prompt_chain_mix (
    id         uuid primary key default gen_random_uuid(),
    chain_id   uuid not null unique references public.prompt_chains (id) on delete cascade,
    weight     integer not null default 0 check (weight between 0 and 1000),
    updated_at timestamptz not null default now()
);

create or replace function public.create_chain_mix_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.prompt_chain_mix (chain_id) values (new.id) on conflict (chain_id) do nothing;
    return new;
end;
$$;
revoke all on function public.create_chain_mix_row() from public, anon, authenticated;

drop trigger if exists prompt_chains_create_mix on public.prompt_chains;
create trigger prompt_chains_create_mix
    after insert on public.prompt_chains
    for each row execute function public.create_chain_mix_row();

insert into public.prompt_chain_mix (chain_id)
select c.id from public.prompt_chains c
on conflict (chain_id) do nothing;


-- 4. terms, generation examples -----------------------------------------------------------
create table if not exists public.terms (
    id         uuid primary key default gen_random_uuid(),
    term       text not null check (btrim(term) <> '' and char_length(term) <= 80),
    definition text not null check (btrim(definition) <> '' and char_length(definition) <= 2000),
    example    text check (example is null or char_length(example) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index if not exists terms_term_lower_idx on public.terms (lower(term));

-- An example of what the AI is given and what a good answer looks like.
create table if not exists public.generation_examples (
    id              uuid primary key default gen_random_uuid(),
    title           text not null check (btrim(title) <> '' and char_length(title) <= 120),
    input_prompt    text not null check (btrim(input_prompt) <> '' and char_length(input_prompt) <= 4000),
    expected_output text not null check (btrim(expected_output) <> '' and char_length(expected_output) <= 8000),
    chain_id        uuid references public.prompt_chains (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists generation_examples_chain_idx on public.generation_examples (chain_id);


-- 5. who may sign up ------------------------------------------------------------------------
-- Stored lower case, one per row. The checks are the same ones the admin form applies.
create table if not exists public.allowed_signup_domains (
    id         uuid primary key default gen_random_uuid(),
    domain     text not null unique check (
        domain = lower(domain) and char_length(domain) <= 253
        and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    ),
    note       text check (note is null or char_length(note) <= 200),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
    id         uuid primary key default gen_random_uuid(),
    email      text not null unique check (
        email = lower(email) and char_length(email) <= 254
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
    note       text check (note is null or char_length(note) <= 200),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- 6. updated_at triggers ---------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array[
        'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_mix', 'terms',
        'generation_examples', 'allowed_signup_domains', 'whitelisted_emails'
    ] loop
        execute format('drop trigger if exists %1$I on public.%2$I', t || '_touch', t);
        execute format(
            'create trigger %1$I before update on public.%2$I for each row execute function public.touch_updated_at()',
            t || '_touch', t
        );
    end loop;
end $$;


-- 7. who can do what --------------------------------------------------------------------------
-- Nothing is granted to anon. authenticated gets exactly the verbs in the list at the top, and
-- each verb also needs a policy that asks is_superadmin(), so a normal user who calls the API
-- still gets zero rows and "permission denied" on writes.
do $$
declare
    t record;
begin
    for t in
        select * from (values
            --  table                    select  insert  update  delete
            ('llm_providers',           true,   true,   true,   true),
            ('llm_models',              true,   true,   true,   true),
            ('prompt_chains',           true,   false,  false,  false),
            ('prompt_chain_steps',      true,   false,  false,  false),
            ('prompt_chain_mix',        true,   false,  true,   false),
            ('terms',                   true,   true,   true,   true),
            ('generation_examples',     true,   true,   true,   true),
            ('allowed_signup_domains',  true,   true,   true,   true),
            ('whitelisted_emails',      true,   true,   true,   true)
        ) as v(tbl, can_select, can_insert, can_update, can_delete)
    loop
        execute format('alter table public.%I enable row level security', t.tbl);
        execute format('revoke all on public.%I from public, anon, authenticated', t.tbl);

        execute format('drop policy if exists "Superadmins can read" on public.%I', t.tbl);
        execute format('drop policy if exists "Superadmins can insert" on public.%I', t.tbl);
        execute format('drop policy if exists "Superadmins can update" on public.%I', t.tbl);
        execute format('drop policy if exists "Superadmins can delete" on public.%I', t.tbl);

        if t.can_select then
            execute format('grant select on public.%I to authenticated', t.tbl);
            execute format('create policy "Superadmins can read" on public.%I for select to authenticated using ((select public.is_superadmin()))', t.tbl);
        end if;
        if t.can_insert then
            execute format('grant insert on public.%I to authenticated', t.tbl);
            execute format('create policy "Superadmins can insert" on public.%I for insert to authenticated with check ((select public.is_superadmin()))', t.tbl);
        end if;
        if t.can_update then
            execute format('grant update on public.%I to authenticated', t.tbl);
            execute format('create policy "Superadmins can update" on public.%I for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t.tbl);
        end if;
        if t.can_delete then
            execute format('grant delete on public.%I to authenticated', t.tbl);
            execute format('create policy "Superadmins can delete" on public.%I for delete to authenticated using ((select public.is_superadmin()))', t.tbl);
        end if;
    end loop;
end $$;

-- The mix is the one table where the panel may update, and then only the weight.
revoke update on public.prompt_chain_mix from authenticated;
grant update (weight) on public.prompt_chain_mix to authenticated;


-- 8. the models Mod Squad has already used ----------------------------------------------------
-- Registers each model name found on a build, so the models list starts with real names. The
-- provider is left empty: choose it on the Models page. Runs again harmlessly.
insert into public.llm_models (name, kind)
select distinct b.model, 'text'
  from public.builds b
 where b.model is not null and btrim(b.model) <> '' and char_length(b.model) <= 120
   and b.prompt <> 'Created in the admin panel.'
on conflict (name) do nothing;

insert into public.llm_models (name, kind)
select distinct b.render_model, 'image'
  from public.builds b
 where b.render_model is not null and btrim(b.render_model) <> '' and char_length(b.render_model) <= 120
   and b.render_model <> 'admin upload'
on conflict (name) do nothing;


-- 9. generation requests and LLM responses: read-only views over builds -----------------------
-- Mod Squad keeps the prompt, the model and the result on the build itself, so these two pages
-- are views of it. They are always current and there is nothing to keep in sync. The caveats:
--   * A request that failed before a build was saved leaves no row to show.
--   * Builds made by hand in the admin panel without a prompt are not AI output, so they are left
--     out, and so are renders uploaded by an admin.
-- security_invoker makes the views read as the caller, so row security on builds, profiles and
-- llm_models still applies; the is_superadmin() test makes them empty for everyone else.
create or replace view public.generation_requests
with (security_invoker = true) as
select b.id,
       b.user_id,
       nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') as user_name,
       p.avatar_url,
       b.id        as build_id,
       b.title     as build_title,
       b.car_name,
       b.vibe,
       b.prompt,
       b.model     as model_name,
       (b.render_url is not null) as has_render,
       b.created_at
  from public.builds b
  left join public.profiles p on p.id = b.user_id
 where (select public.is_superadmin())
   and b.prompt <> 'Created in the admin panel.';

-- One row per thing a model returned: the build's text, and its render if it has one. The id is
-- derived from the build id, so it is stable and unique.
create or replace view public.llm_responses
with (security_invoker = true) as
select md5(b.id::text || ':text')::uuid as id,
       b.id        as request_id,
       b.title     as build_title,
       'text'::text as kind,
       b.model     as model_name,
       m.id        as model_id,
       b.prompt    as prompt,
       jsonb_pretty(jsonb_build_object('title', b.title, 'tagline', b.tagline, 'est_cost_usd', b.est_cost_usd, 'mods', b.mods)) as response,
       b.created_at
  from public.builds b
  left join public.llm_models m on m.name = b.model
 where (select public.is_superadmin())
   and b.prompt <> 'Created in the admin panel.'
union all
select md5(b.id::text || ':image')::uuid,
       b.id,
       b.title,
       'image'::text,
       b.render_model,
       m.id,
       null::text,
       b.render_url,
       coalesce(b.rendered_at, b.created_at)
  from public.builds b
  left join public.llm_models m on m.name = b.render_model
 where (select public.is_superadmin())
   and b.render_url is not null
   and b.render_model is distinct from 'admin upload';

revoke all on public.generation_requests, public.llm_responses from public, anon, authenticated;
grant select on public.generation_requests, public.llm_responses to authenticated;


-- Tell the API to pick up the new tables and views.
notify pgrst, 'reload schema';

-- Optional checks after running:
--   select table_name from information_schema.tables where table_schema = 'public'
--    and table_name in ('llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
--                       'terms', 'generation_requests', 'generation_examples', 'llm_responses',
--                       'allowed_signup_domains', 'whitelisted_emails');
--   select * from public.llm_models;
