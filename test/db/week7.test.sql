-- Tests for supabase/week7.sql. Run by test/db/run.sh right after admin.test.sql, which creates the
-- test.* helpers and the three users (admin, bee, cee) used here. Any failed check raises an
-- exception, which stops psql with a non-zero exit code.

\set admin '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bee   '''bbbbbbbb-0000-0000-0000-000000000002'''
\set cee   '''cccccccc-0000-0000-0000-000000000003'''

-- Fixtures, created the way the project owner would: as the superuser, no API role. ---------------
insert into public.builds (id, user_id, car_name, vibe, prompt, model, title, tagline, mods, est_cost_usd, render_url, render_model, rendered_at) values
    -- an AI build with a render
    ('e1e1e1e1-0000-0000-0000-000000000001', :bee, 'Mazda MX-5 Miata (NA)', 'touge', 'Design a build', 'w7-text-model', 'W7 Rendered', 'tag',
     '[{"category":"Wheels","part":"Rays","detail":"d","cost_usd":1200}]', 1200,
     'https://x.supabase.co/storage/v1/object/public/build-renders/u/b.png', 'w7-image-model', now()),
    -- an AI build without one
    ('e2e2e2e2-0000-0000-0000-000000000002', :cee, 'BMW M3 (E46)', 'track', 'Design a build', 'w7-text-model', 'W7 Plain', 'tag',
     '[{"category":"Engine","part":"Intake","detail":"d","cost_usd":400}]', 400, null, null, null),
    -- made by hand in the admin panel, with a render an admin uploaded: neither is AI output
    ('e3e3e3e3-0000-0000-0000-000000000003', :cee, 'Hand made', 'x', 'Created in the admin panel.', 'admin (manual)', 'W7 By hand', 'tag',
     '[{"category":"Engine","part":"Intake","detail":"d","cost_usd":400}]', 400,
     'https://x.supabase.co/storage/v1/object/public/build-renders/u/c.png', 'admin upload', now());

-- The owner makes a chain and a step in the SQL editor (the panel can only read them).
insert into public.prompt_chains (id, name, description) values ('c1c1c1c1-0000-0000-0000-0000000000c1', 'W7 Chain', 'd');
insert into public.prompt_chain_steps (id, chain_id, step_order, name, system_prompt)
    values ('d1d1d1d1-0000-0000-0000-0000000000d1', 'c1c1c1c1-0000-0000-0000-0000000000c1', 1, 'W7 Step', 'sys');

-- A term with an old updated_at, to prove the trigger moves it.
insert into public.terms (id, term, definition, updated_at)
    values ('a1a1a1a1-0000-0000-0000-0000000000a1', 'W7 Term', 'def', '2000-01-01');

-- Re-running the file with data in place must work, and registers the models the builds used.
\set ON_ERROR_STOP on
\i :week7_sql


-- 1. The owner's view of things -------------------------------------------------------------
select test.ok((select count(*) from public.prompt_chain_mix where chain_id = 'c1c1c1c1-0000-0000-0000-0000000000c1') = 1,
               'a new chain gets its mix row automatically');
select test.ok((select weight from public.prompt_chain_mix where chain_id = 'c1c1c1c1-0000-0000-0000-0000000000c1') = 0,
               'and it starts at weight 0');
select test.ok((select count(*) from public.llm_models where name = 'w7-text-model' and kind = 'text') = 1,
               'models used by builds are registered as text models');
select test.ok((select count(*) from public.llm_models where name = 'w7-image-model' and kind = 'image') = 1,
               'render models are registered as image models');
select test.ok(not exists (select 1 from public.llm_models where name in ('admin (manual)', 'admin upload')),
               'hand-made builds and admin uploads are not registered as models');


-- 2. Normal users and anon get nothing ----------------------------------------------------------
begin;
select test.as_user(:bee);
select test.ok((select count(*) from public.llm_models) = 0, 'normal user reads no models');
select test.ok((select count(*) from public.terms) = 0, 'normal user reads no terms');
select test.ok((select count(*) from public.prompt_chains) = 0, 'normal user reads no prompt chains');
select test.ok((select count(*) from public.prompt_chain_mix) = 0, 'normal user reads no mix');
select test.ok((select count(*) from public.allowed_signup_domains) = 0 and (select count(*) from public.whitelisted_emails) = 0,
               'normal user reads neither signup list');
select test.ok((select count(*) from public.generation_requests) = 0, 'normal user sees nothing in generation_requests (although builds are public)');
select test.ok((select count(*) from public.llm_responses) = 0, 'normal user sees nothing in llm_responses');
select test.denied($$insert into public.terms (term, definition) values ('hax', 'hax')$$, '42501', 'normal user cannot create a term');
select test.denied($$insert into public.allowed_signup_domains (domain) values ('evil.example')$$, '42501', 'normal user cannot allow a signup domain');
select test.denied($$insert into public.whitelisted_emails (email) values ('me@evil.example')$$, '42501', 'normal user cannot whitelist an email');
select test.denied($$insert into public.llm_providers (name) values ('hax')$$, '42501', 'normal user cannot create a provider');
with u as (update public.terms set definition = 'hax' returning 1)
select test.ok((select count(*) from u) = 0, 'normal user cannot update a term (no row is visible to them)');
with d as (delete from public.terms returning 1)
select test.ok((select count(*) from d) = 0, 'normal user cannot delete a term');
with u as (update public.prompt_chain_mix set weight = 1000 returning 1)
select test.ok((select count(*) from u) = 0, 'normal user cannot change the mix');
rollback;

begin;
select test.as_anon();
select test.denied($$select * from public.terms$$, '42501', 'anon cannot read terms');
select test.denied($$select * from public.llm_models$$, '42501', 'anon cannot read models');
select test.denied($$select * from public.generation_requests$$, '42501', 'anon cannot read generation_requests');
select test.denied($$select * from public.llm_responses$$, '42501', 'anon cannot read llm_responses');
select test.denied($$insert into public.terms (term, definition) values ('hax', 'hax')$$, '42501', 'anon cannot create a term');
rollback;


-- 3. Admins: create, read, update, delete ---------------------------------------------------------
begin;
select test.as_user(:admin);

-- providers and models
insert into public.llm_providers (name, base_url) values ('W7 Provider', 'https://api.example.com');
select test.ok((select count(*) from public.llm_providers where name = 'W7 Provider') = 1, 'admin can create and read a provider');
update public.llm_providers set name = 'W7 Provider 2', notes = 'changed' where name = 'W7 Provider';
select test.ok((select notes from public.llm_providers where name = 'W7 Provider 2') = 'changed', 'admin can update a provider');
insert into public.llm_models (name, provider_id, kind)
    select 'W7 Model', id, 'text' from public.llm_providers where name = 'W7 Provider 2';
select test.ok((select count(*) from public.llm_models where name = 'W7 Model') = 1, 'admin can create a model that points at a provider');
update public.llm_models set is_active = false where name = 'W7 Model';
select test.ok((select not is_active from public.llm_models where name = 'W7 Model'), 'admin can update a model');
select test.denied($$delete from public.llm_providers where name = 'W7 Provider 2'$$, '23503', 'a provider that a model still uses cannot be deleted');
select test.denied($$insert into public.llm_providers (name, base_url) values ('Bad URL', 'ftp://example.com')$$, '23514', 'a provider URL must be http or https');
select test.denied($$insert into public.llm_providers (name) values ('W7 Provider 2')$$, '23505', 'provider names are unique');
select test.denied($$insert into public.llm_models (name, kind) values ('Odd', 'video')$$, '23514', 'a model is a text or an image model');
delete from public.llm_models where name = 'W7 Model';
delete from public.llm_providers where name = 'W7 Provider 2';
select test.ok(not exists (select 1 from public.llm_providers where name = 'W7 Provider 2'), 'admin can delete a model, then its provider');

-- terms
insert into public.terms (term, definition, example) values ('Boost', 'Extra air pressure into the engine.', 'A turbo adds boost.');
select test.ok((select count(*) from public.terms where term = 'Boost') = 1, 'admin can create and read a term');
select test.denied($$insert into public.terms (term, definition) values ('BOOST', 'again')$$, '23505', 'terms are unique whatever the capitals');
update public.terms set definition = 'Changed.' where term = 'Boost';
select test.ok((select definition from public.terms where term = 'Boost') = 'Changed.', 'admin can update a term');
update public.terms set definition = 'Moved.' where term = 'W7 Term';
select test.ok((select updated_at > '2000-01-02' from public.terms where term = 'W7 Term'), 'updating a term moves updated_at');
delete from public.terms where term = 'Boost';
select test.ok(not exists (select 1 from public.terms where term = 'Boost'), 'admin can delete a term');

-- generation examples
insert into public.generation_examples (title, input_prompt, expected_output, chain_id)
    values ('W7 Example', 'in', 'out', 'c1c1c1c1-0000-0000-0000-0000000000c1');
select test.ok((select count(*) from public.generation_examples where title = 'W7 Example') = 1, 'admin can create and read a generation example');
update public.generation_examples set expected_output = 'new out' where title = 'W7 Example';
select test.ok((select expected_output from public.generation_examples where title = 'W7 Example') = 'new out', 'admin can update a generation example');
select test.denied($$insert into public.generation_examples (title, input_prompt, expected_output) values ('', 'in', 'out')$$, '23514', 'an example needs a title');
delete from public.generation_examples where title = 'W7 Example';
select test.ok(not exists (select 1 from public.generation_examples where title = 'W7 Example'), 'admin can delete a generation example');

-- allowed signup domains
insert into public.allowed_signup_domains (domain, note) values ('w7.edu', 'n');
select test.ok((select count(*) from public.allowed_signup_domains where domain = 'w7.edu') = 1, 'admin can create and read a signup domain');
select test.denied($$insert into public.allowed_signup_domains (domain) values ('W7.EDU')$$, '23514', 'domains must be lower case');
select test.denied($$insert into public.allowed_signup_domains (domain) values ('localhost')$$, '23514', 'a domain needs a dot and a real ending');
select test.denied($$insert into public.allowed_signup_domains (domain) values ('a b.edu')$$, '23514', 'a domain cannot hold spaces');
select test.denied($$insert into public.allowed_signup_domains (domain) values ('w7.edu')$$, '23505', 'domains are unique');
update public.allowed_signup_domains set note = 'changed' where domain = 'w7.edu';
select test.ok((select note from public.allowed_signup_domains where domain = 'w7.edu') = 'changed', 'admin can update a signup domain');
delete from public.allowed_signup_domains where domain = 'w7.edu';
select test.ok(not exists (select 1 from public.allowed_signup_domains where domain = 'w7.edu'), 'admin can delete a signup domain');

-- whitelisted emails
insert into public.whitelisted_emails (email, note) values ('friend@example.com', 'n');
select test.ok((select count(*) from public.whitelisted_emails where email = 'friend@example.com') = 1, 'admin can create and read a whitelisted email');
select test.denied($$insert into public.whitelisted_emails (email) values ('Friend2@Example.com')$$, '23514', 'emails must be lower case');
select test.denied($$insert into public.whitelisted_emails (email) values ('not-an-email')$$, '23514', 'an email needs an @ and a domain');
select test.denied($$insert into public.whitelisted_emails (email) values ('friend@example.com')$$, '23505', 'emails are unique');
update public.whitelisted_emails set email = 'friend2@example.com' where email = 'friend@example.com';
select test.ok(exists (select 1 from public.whitelisted_emails where email = 'friend2@example.com'), 'admin can update a whitelisted email');
delete from public.whitelisted_emails where email = 'friend2@example.com';
select test.ok(not exists (select 1 from public.whitelisted_emails where email = 'friend2@example.com'), 'admin can delete a whitelisted email');
rollback;


-- 4. Read-only means read-only, even for admins ------------------------------------------------------
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.prompt_chains where id = 'c1c1c1c1-0000-0000-0000-0000000000c1') = 1, 'admin reads prompt chains');
select test.ok((select count(*) from public.prompt_chain_steps where id = 'd1d1d1d1-0000-0000-0000-0000000000d1') = 1, 'admin reads prompt chain steps');
select test.denied($$insert into public.prompt_chains (name) values ('hax')$$, '42501', 'admin cannot create a prompt chain');
select test.denied($$update public.prompt_chains set name = 'hax'$$, '42501', 'admin cannot update a prompt chain');
select test.denied($$delete from public.prompt_chains$$, '42501', 'admin cannot delete a prompt chain');
select test.denied($$insert into public.prompt_chain_steps (chain_id, step_order, name) values ('c1c1c1c1-0000-0000-0000-0000000000c1', 2, 'hax')$$,
                   '42501', 'admin cannot create a step');
select test.denied($$update public.prompt_chain_steps set system_prompt = 'hax'$$, '42501', 'admin cannot update a step');
select test.denied($$delete from public.prompt_chain_steps$$, '42501', 'admin cannot delete a step');
select test.denied($$insert into public.generation_requests (id) values (gen_random_uuid())$$, '55000', 'generation_requests is a view: nobody can write to it');
select test.denied($$update public.llm_responses set response = 'hax'$$, '55000', 'llm_responses is a view: nobody can write to it');
rollback;

-- the mix: update the weight, and only the weight
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.prompt_chain_mix where chain_id = 'c1c1c1c1-0000-0000-0000-0000000000c1') = 1, 'admin reads the mix');
update public.prompt_chain_mix set weight = 40 where chain_id = 'c1c1c1c1-0000-0000-0000-0000000000c1';
select test.ok((select weight from public.prompt_chain_mix where chain_id = 'c1c1c1c1-0000-0000-0000-0000000000c1') = 40, 'admin can update a chain''s weight');
select test.denied($$update public.prompt_chain_mix set weight = 1001$$, '23514', 'a weight is 0 to 1000');
select test.denied($$update public.prompt_chain_mix set weight = -1$$, '23514', 'a weight cannot be negative');
select test.denied($$update public.prompt_chain_mix set chain_id = gen_random_uuid()$$, '42501', 'admin cannot point a mix row at another chain');
select test.denied($$insert into public.prompt_chain_mix (chain_id, weight) values (gen_random_uuid(), 5)$$, '42501', 'admin cannot create a mix row');
select test.denied($$delete from public.prompt_chain_mix$$, '42501', 'admin cannot delete a mix row');
rollback;


-- 5. The two views --------------------------------------------------------------------------------
begin;
select test.as_user(:admin);
select test.ok((select count(*) from public.generation_requests where build_id in
                    ('e1e1e1e1-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000002', 'e3e3e3e3-0000-0000-0000-000000000003')) = 2,
               'generation_requests lists the AI builds and leaves out the hand-made one');
select test.ok((select has_render from public.generation_requests where build_id = 'e1e1e1e1-0000-0000-0000-000000000001')
               and not (select has_render from public.generation_requests where build_id = 'e2e2e2e2-0000-0000-0000-000000000002'),
               'generation_requests says which builds got a render');
select test.ok((select prompt = 'Design a build' and model_name = 'w7-text-model' and user_name is not null
                  from public.generation_requests where build_id = 'e1e1e1e1-0000-0000-0000-000000000001'),
               'generation_requests carries the prompt, the model and the person''s name');

select test.ok((select count(*) from public.llm_responses where request_id in
                    ('e1e1e1e1-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000002', 'e3e3e3e3-0000-0000-0000-000000000003')) = 3,
               'llm_responses has a text row per AI build and an image row per AI render (and nothing for the hand-made build)');
select test.ok((select count(*) filter (where kind = 'image') = 1 and count(*) filter (where kind = 'text') = 2
                  from public.llm_responses where request_id in ('e1e1e1e1-0000-0000-0000-000000000001', 'e2e2e2e2-0000-0000-0000-000000000002')),
               'llm_responses tells text from image');
select test.ok((select count(distinct id) = count(*) from public.llm_responses), 'llm_responses ids are unique');
select test.ok((select model_id is not null from public.llm_responses where request_id = 'e1e1e1e1-0000-0000-0000-000000000001' and kind = 'text'),
               'a response is linked to its registered model');
select test.ok((select response like '%W7 Rendered%' from public.llm_responses where request_id = 'e1e1e1e1-0000-0000-0000-000000000001' and kind = 'text'),
               'the text response holds what the model wrote');
rollback;

select 'done' as result;
