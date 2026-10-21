-- Tests for supabase/admin.sql. Run by test/db/run.sh after Mod Squad's SQL and admin.sql are loaded.
-- Any failed check raises an exception, which stops psql with a non-zero exit code.

create schema test;

-- Pretend the next statements come from this signed-in user, through the API.
create function test.as_user(uid uuid) returns void language plpgsql as $$
begin
    perform set_config('request.jwt.claim.sub', uid::text, true);
    set local role authenticated;
end $$;

create function test.as_anon() returns void language plpgsql as $$
begin
    perform set_config('request.jwt.claim.sub', '', true);
    set local role anon;
end $$;

create function test.ok(cond boolean, what text) returns void language plpgsql as $$
begin
    if cond is not true then
        raise exception 'FAIL: %', what;
    end if;
    raise notice 'PASS: %', what;
end $$;

-- Runs one statement and checks it fails with the given SQLSTATE (42501 = not allowed).
create function test.denied(stmt text, expected text, what text, msg_like text default null) returns void language plpgsql as $$
declare got text; msg text := '';
begin
    begin
        execute stmt;
        got := 'no error';
    exception when others then
        got := sqlstate;
        msg := sqlerrm;
    end;
    if got is distinct from expected then
        raise exception 'FAIL: % (expected %, got % %)', what, expected, got, msg;
    end if;
    if msg_like is not null and msg not like msg_like then
        raise exception 'FAIL: % (refused, but by something else: %)', what, msg;
    end if;
    raise notice 'PASS: %', what;
end $$;

grant usage on schema test to anon, authenticated;
grant execute on all functions in schema test to anon, authenticated;

-- Fixtures, created the way the project owner would: as the superuser, no API role. ---------------
\set admin '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bee   '''bbbbbbbb-0000-0000-0000-000000000002'''
\set cee   '''cccccccc-0000-0000-0000-000000000003'''

insert into auth.users (id, email, last_sign_in_at) values
    (:admin, 'admin@example.com', now()),
    (:bee,   'bee@example.com',   now() - interval '2 days'),
    (:cee,   'cee@example.com',   null);
-- the on_auth_user_created trigger made the three profiles
update public.profiles set first_name = 'Ada', last_name = 'Admin' where id = :admin;
update public.profiles set first_name = 'Bee', last_name = 'Builder' where id = :bee;

insert into public.builds (id, user_id, car_name, vibe, prompt, model, title, tagline, mods, est_cost_usd) values
    ('b1b1b1b1-0000-0000-0000-000000000001', :bee, 'Mazda MX-5 Miata (NA)', 'touge', 'p', 'gemini-test', 'Bee Build',  'tag', '[{"category":"Wheels","part":"Rays","detail":"d","cost_usd":1200}]', 1200),
    ('b2b2b2b2-0000-0000-0000-000000000002', :cee, 'BMW M3 (E46)',         'track', 'p', 'gemini-test', 'Cee Build',  'tag', '[{"category":"Engine","part":"Intake","detail":"d","cost_usd":400}]',  400);

insert into public.build_votes (build_id, user_id, value) values
    ('b1b1b1b1-0000-0000-0000-000000000001', :admin, 1),
    ('b1b1b1b1-0000-0000-0000-000000000001', :cee,  -1),
    ('b2b2b2b2-0000-0000-0000-000000000002', :bee,   1);

insert into public.part_searches (user_id, build_id, query) values (:bee, 'b1b1b1b1-0000-0000-0000-000000000001', 'coilovers');

select test.ok((select count(*) from public.profiles) = 3, 'sign-up trigger made three profiles');
select test.ok(not (select bool_or(is_superadmin) from public.profiles), 'nobody is an admin to begin with');

-- 1. The project owner can make the first admin (SQL editor, no API role). -------------------------
update public.profiles set is_superadmin = true where id = :admin;
select test.ok((select is_superadmin from public.profiles where id = :admin), 'owner can promote the first admin from the SQL editor');

-- 2. A normal user cannot promote themselves, by any route. ----------------------------------------
begin;
select test.as_user(:bee);
select test.denied($$update public.profiles set is_superadmin = true where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
                   '42501', 'user cannot set is_superadmin on their own profile with UPDATE', '%SQL editor%');
select test.denied($$insert into public.profiles (id, is_superadmin) values ('bbbbbbbb-0000-0000-0000-000000000002', true)
                     on conflict (id) do update set is_superadmin = excluded.is_superadmin$$,
                   '42501', 'user cannot set is_superadmin with an upsert', '%SQL editor%');
rollback;

-- a user whose profile row is missing (the form's upsert path) still cannot insert themselves as admin
begin;
delete from public.profiles where id = :cee;
select test.as_user(:cee);
select test.denied($$insert into public.profiles (id, is_superadmin) values ('cccccccc-0000-0000-0000-000000000003', true)$$,
                   '42501', 'user cannot insert their own profile as an admin', '%SQL editor%');
insert into public.profiles (id, first_name) values (:cee, 'Cee');
select test.ok((select not is_superadmin from public.profiles where id = :cee), 'a plain profile insert still works');
rollback;

begin;
select test.as_anon();
select test.denied($$update public.profiles set is_superadmin = true$$, '42501', 'anon cannot touch profiles at all');
rollback;

-- Even an admin cannot flip the flag through the API (the owner does that in the SQL editor).
begin;
select test.as_user(:admin);
select test.denied($$update public.profiles set is_superadmin = false where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
                   '42501', 'an admin cannot demote themselves through the API either', '%SQL editor%');
rollback;

-- 3. Mod Squad's own profile form still works: it upserts id + names, and id + avatar_url. ---------
begin;
select test.as_user(:bee);
insert into public.profiles (id, first_name, last_name) values (:bee, 'Beatrice', 'Builder')
    on conflict (id) do update set id = excluded.id, first_name = excluded.first_name, last_name = excluded.last_name;
insert into public.profiles (id, avatar_url) values (:bee, 'https://example.com/a.png')
    on conflict (id) do update set id = excluded.id, avatar_url = excluded.avatar_url;
select test.ok((select first_name = 'Beatrice' and avatar_url is not null and not is_superadmin from public.profiles where id = :bee),
               'Mod Squad profile upserts still work and leave the flag false');
rollback;

-- 4. Re-running Mod Squad's profiles.sql puts the table-wide grants back; the trigger must not care. -
\set ON_ERROR_STOP on
\i :mod_squad_profiles_sql
begin;
select test.as_user(:bee);
select test.denied($$update public.profiles set is_superadmin = true where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
                   '42501', 'still blocked after profiles.sql re-grants table-wide update', '%SQL editor%');
rollback;

-- 5. is_superadmin() and the admin-only functions. -----------------------------------------------
begin;
select test.as_user(:admin);
select test.ok(public.is_superadmin(), 'is_superadmin() is true for the admin');
rollback;

begin;
select test.as_user(:bee);
select test.ok(not public.is_superadmin(), 'is_superadmin() is false for a normal user');
select test.denied($$select * from public.admin_users()$$,        '42501', 'normal user cannot call admin_users');
select test.denied($$select * from public.admin_votes()$$,        '42501', 'normal user cannot call admin_votes');
select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"title":"hacked"}')$$,
                   '42501', 'normal user cannot call admin_update_build, even on their own build');
select test.denied($$select public.admin_create_build('bbbbbbbb-0000-0000-0000-000000000002','Car','vibe','t','t','[{"part":"x"}]',1,'m')$$,
                   '42501', 'normal user cannot call admin_create_build');
rollback;

begin;
select test.as_anon();
select test.denied($$select * from public.admin_users()$$, '42501', 'signed-out visitor cannot call admin_users');
select test.denied($$select public.is_superadmin()$$,      '42501', 'signed-out visitor cannot call is_superadmin');
rollback;

-- 6. Votes: a user sees only their own; an admin sees all, and cannot write any. -------------------
begin;
select test.as_user(:bee);
select test.ok((select count(*) from public.build_votes) = 1, 'normal user sees only their own vote');
rollback;

begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.build_votes) = 3, 'admin reads every vote');
select test.denied($$insert into public.build_votes (build_id, user_id, value) values ('b2b2b2b2-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 1)$$,
                   '42501', 'admin cannot cast a vote for someone else');
with changed as (update public.build_votes set value = 1 returning 1)
select test.ok((select count(*) from changed) = 1, 'an UPDATE by the admin reaches only the admin''s own vote, not the other two');
rollback;
select test.ok((select count(*) from public.build_votes where value = -1) = 1, 'the other votes were left alone');

-- 7. Deleting builds. -------------------------------------------------------------------------
begin;
select test.as_user(:bee);
with gone as (delete from public.builds where id = 'b2b2b2b2-0000-0000-0000-000000000002' returning 1)
select test.ok((select count(*) from gone) = 0, 'normal user cannot delete someone else''s build');
rollback;

-- 8. admin_users ----------------------------------------------------------------------------
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.admin_users()) = 3, 'admin_users lists all users');
select test.ok((select total_count from public.admin_users(p_limit => 1) limit 1) = 3, 'admin_users reports the total before paging');
select test.ok((select count(*) from public.admin_users(p_limit => 1, p_offset => 2)) = 1, 'admin_users pages');
select test.ok((select email from public.admin_users(p_id => 'bbbbbbbb-0000-0000-0000-000000000002')) = 'bee@example.com', 'admin_users returns the email');
select test.ok((select count(*) from public.admin_users(p_search => 'cee@')) = 1, 'admin_users searches by email');
select test.ok((select count(*) from public.admin_users(p_search => 'builder')) = 1, 'admin_users searches by name');
select test.ok((select builds_count from public.admin_users(p_id => 'bbbbbbbb-0000-0000-0000-000000000002')) = 1, 'admin_users counts builds');
select test.ok((select votes_cast from public.admin_users(p_id => 'bbbbbbbb-0000-0000-0000-000000000002')) = 1, 'admin_users counts votes cast');
select test.ok((select downvotes_received from public.admin_users(p_id => 'bbbbbbbb-0000-0000-0000-000000000002')) = 1, 'admin_users counts downvotes received');
select test.ok((select score_total from public.admin_users(p_id => 'bbbbbbbb-0000-0000-0000-000000000002')) = 0, 'admin_users sums score (1 up - 1 down)');
select test.ok((select id from public.admin_users(p_sort => 'builds') limit 1) in ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003'), 'admin_users sorts by builds');
select test.ok((select is_superadmin from public.admin_users(p_id => 'aaaaaaaa-0000-0000-0000-000000000001')), 'admin_users shows who is an admin');
rollback;

-- 9. admin_votes ----------------------------------------------------------------------------
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.admin_votes()) = 3, 'admin_votes lists every vote');
select test.ok((select count(*) from public.admin_votes(p_value => -1)) = 1, 'admin_votes filters by direction');
select test.ok((select count(*) from public.admin_votes(p_build_id => 'b1b1b1b1-0000-0000-0000-000000000001')) = 2, 'admin_votes filters by build');
select test.ok((select count(*) from public.admin_votes(p_user_id => 'cccccccc-0000-0000-0000-000000000003')) = 1, 'admin_votes filters by voter');
select test.ok((select voter_email from public.admin_votes(p_value => -1)) = 'cee@example.com', 'admin_votes shows the voter email');
select test.ok((select build_owner_name from public.admin_votes(p_value => -1)) = 'Bee Builder', 'admin_votes shows the build owner');
select test.ok((select count(*) from public.admin_votes(p_search => 'miata')) = 2, 'admin_votes searches the build name');
rollback;

-- 10. Create, update and delete builds as an admin. ----------------------------------------------
begin;
select test.as_user(:admin);

select public.admin_create_build(:cee, 'Honda Civic (EK)', 'daily', 'Admin Made', 'tagline',
                                 '[{"category":"Wheels","part":"Enkei","detail":"d","cost_usd":900}]', 900, 'admin (manual)') as new_id \gset
select test.ok((select user_id = 'cccccccc-0000-0000-0000-000000000003' and model = 'admin (manual)' and prompt = 'Created in the admin panel.'
                  from public.builds where id = :'new_id'), 'admin_create_build makes a build for the chosen user');
select test.ok((select upvotes = 0 and downvotes = 0 from public.builds where id = :'new_id'), 'a new build starts with no votes');

select test.denied($$select public.admin_create_build('cccccccc-0000-0000-0000-000000000003','Car','vibe','t','t','[]',1,'m')$$,
                   '22023', 'admin_create_build refuses an empty parts list');
select test.denied($$select public.admin_create_build(gen_random_uuid(),'Car','vibe','t','t','[{"part":"x"}]',1,'m')$$,
                   '22023', 'admin_create_build refuses an unknown user');
select test.denied($$select public.admin_create_build('cccccccc-0000-0000-0000-000000000003','Car','vibe','t','t',
                      (select jsonb_agg(jsonb_build_object('part', 'p' || g)) from generate_series(1, 13) g),1,'m')$$,
                   '22023', 'admin_create_build refuses more than 12 parts');
select test.denied($$select public.admin_create_build('cccccccc-0000-0000-0000-000000000003',repeat('x', 81),'vibe','t','t','[{"part":"x"}]',1,'m')$$,
                   '23514', 'table constraints still apply (car name over 80 characters)');

select public.admin_update_build(:'new_id', '{"title":"Renamed","tagline":"new line","est_cost_usd":1234}');
select test.ok((select title = 'Renamed' and tagline = 'new line' and est_cost_usd = 1234 and car_name = 'Honda Civic (EK)'
                  from public.builds where id = :'new_id'), 'admin_update_build changes only the fields it is given');

select public.admin_update_build(:'new_id', '{"mods":[{"category":"Engine","part":"Header","detail":"d","cost_usd":500}]}');
select test.ok((select mods -> 0 ->> 'part' = 'Header' and mods_edited_at is null and ai_original is null from public.builds where id = :'new_id'),
               'an admin edit of the parts leaves the owner''s edit history alone');

select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"upvotes": 999}')$$,
                   '22023', 'admin_update_build refuses to write vote counters');
select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"user_id": "aaaaaaaa-0000-0000-0000-000000000001"}')$$,
                   '22023', 'admin_update_build refuses to change the owner');
select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"mods": []}')$$,
                   '22023', 'admin_update_build refuses an empty parts list');
select test.denied($$select public.admin_update_build(gen_random_uuid(), '{"title":"x"}')$$,
                   'P0002', 'admin_update_build reports a missing build');
select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"render_url":"https://evil.example/x.png"}')$$,
                   '23514', 'a render link outside our bucket is still refused');
select test.denied($$select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"image_url":"https://evil.example/x.png"}')$$,
                   '23514', 'a photo link outside Wikimedia is still refused');

select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001',
    '{"render_url":"https://x.supabase.co/storage/v1/object/public/build-renders/u/b.png","render_model":"admin upload","rendered_at":"2026-10-01T12:00:00Z"}');
select test.ok((select render_model = 'admin upload' from public.builds where id = 'b1b1b1b1-0000-0000-0000-000000000001'), 'admin can attach a render');
select public.admin_update_build('b1b1b1b1-0000-0000-0000-000000000001', '{"render_url":null,"render_model":null,"rendered_at":null}');
select test.ok((select render_url is null and rendered_at is null from public.builds where id = 'b1b1b1b1-0000-0000-0000-000000000001'), 'admin can remove a render (JSON null clears a field)');

-- delete: the build and its votes go
with gone as (delete from public.builds where id = 'b1b1b1b1-0000-0000-0000-000000000001' returning 1)
select test.ok((select count(*) from gone) = 1, 'admin can delete any build');
select test.ok((select count(*) from public.build_votes where build_id = 'b1b1b1b1-0000-0000-0000-000000000001') = 0, 'deleting a build removes its votes');
rollback;

-- 11. Part searches: admins only. ---------------------------------------------------------------
begin;
select test.as_user(:bee);
select test.ok((select count(*) from public.part_searches) = 0, 'normal user reads no part searches (not even their own)');
rollback;
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.part_searches) = 1, 'admin reads part searches');
rollback;

-- 12. Storage: admins manage renders; nobody else touches other people's folders. -----------------
begin;
select test.as_user(:admin);
insert into storage.objects (bucket_id, name) values ('build-renders', 'bbbbbbbb-0000-0000-0000-000000000002/x.png');
select test.ok((select count(*) from storage.objects where bucket_id = 'build-renders') = 1, 'admin can add and see a render in someone else''s folder');
with gone as (delete from storage.objects where bucket_id = 'build-renders' returning 1)
select test.ok((select count(*) from gone) = 1, 'admin can remove a render file');
rollback;

begin;
select test.as_user(:bee);
select test.denied($$insert into storage.objects (bucket_id, name) values ('build-renders', 'cccccccc-0000-0000-0000-000000000003/x.png')$$,
                   '42501', 'normal user cannot add a render to someone else''s folder');
select test.denied($$insert into storage.objects (bucket_id, name) values ('car-photos', 'cccccccc-0000-0000-0000-000000000003/x.png')$$,
                   '42501', 'admin storage rights do not leak to other buckets for normal users');
rollback;

-- 13. Users who deleted... nothing else changed for normal users: Mod Squad's own rules. -----------
begin;
select test.as_user(:bee);
select test.ok((select count(*) from public.builds) = 2, 'normal users still read every build');
select test.denied($$update public.builds set title = 'hax' where id = 'b1b1b1b1-0000-0000-0000-000000000001'$$,
                   '42501', 'normal users still cannot update build text (no column grant)');
rollback;

select 'done' as result;
