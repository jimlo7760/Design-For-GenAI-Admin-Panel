-- Mod Squad Admin Panel, Week 7: optional sample rows.
--
-- Run in the Supabase SQL Editor AFTER supabase/week7.sql, if you want the new admin pages to have
-- something to show. Every row is an EXAMPLE written for the demo, not a record of how Mod Squad's
-- generator is actually configured: edit or delete them in the admin panel (providers, models,
-- terms, examples, domains) or in the SQL editor (prompt chains, steps), and replace the prompts
-- with your real ones. Safe to re-run: anything that already exists is skipped.

-- LLM providers. Models Mod Squad has already used were registered by week7.sql with no provider;
-- this links the obvious ones. It only touches models that have no provider yet.
insert into public.llm_providers (name, base_url, notes) values
    ('Google',    'https://generativelanguage.googleapis.com', 'Sample row.'),
    ('OpenAI',    'https://api.openai.com',                    'Sample row.'),
    ('Anthropic', 'https://api.anthropic.com',                 'Sample row.')
on conflict (name) do nothing;

update public.llm_models m set provider_id = p.id
  from public.llm_providers p
 where m.provider_id is null
   and ((p.name = 'Google'    and (m.name ilike 'gemini%' or m.name ilike 'imagen%' or m.name ilike 'veo%'))
     or (p.name = 'OpenAI'    and (m.name ilike 'gpt%' or m.name ilike 'dall%' or m.name ilike 'o1%' or m.name ilike 'o3%'))
     or (p.name = 'Anthropic' and m.name ilike 'claude%'));

-- Prompt chains and steps. The chains and steps pages only read, so these are the only way in.
insert into public.prompt_chains (name, description) values
    ('Build designer',       'Sample chain. Designs the build (title, tagline, parts and prices), then renders it.'),
    ('Build designer: quick', 'Sample chain. One step, no render. Gets a small share of traffic in the mix.')
on conflict (name) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, llm_model_id, system_prompt, user_prompt)
select c.id, s.step_order, s.name,
       (select m.id from public.llm_models m where m.kind = s.kind order by m.created_at limit 1),
       s.system_prompt, s.user_prompt
  from public.prompt_chains c
  join (values
    ('Build designer', 1, 'Design the build', 'text',
     'You are an automotive build designer. Given a car and a vibe, answer with JSON only: a title, a one-line tagline, and 1 to 12 parts. Each part has a category, a part name, a short detail and an estimated price in US dollars.',
     'Car: {{car}}. Vibe: {{vibe}}.'),
    ('Build designer', 2, 'Render the build', 'image',
     'You draw one photorealistic image of a finished car build. No text in the image.',
     'A {{car}} with {{parts}}, styled for the vibe: {{vibe}}.'),
    ('Build designer: quick', 1, 'Design the build', 'text',
     'You are an automotive build designer. Answer with JSON only: a title, a tagline and up to 6 parts with prices.',
     'Car: {{car}}. Vibe: {{vibe}}.')
  ) as s(chain_name, step_order, name, kind, system_prompt, user_prompt) on s.chain_name = c.name
on conflict (chain_id, step_order) do nothing;

-- The mix. week7.sql made a row per chain with weight 0; give the sample chains a 70 / 30 split,
-- but only while both are still at 0, so a mix you have already edited is left alone.
update public.prompt_chain_mix mix set weight = case c.name when 'Build designer' then 70 else 30 end
  from public.prompt_chains c
 where mix.chain_id = c.id
   and c.name in ('Build designer', 'Build designer: quick')
   and not exists (select 1 from public.prompt_chain_mix x where x.weight <> 0);

-- Terms.
insert into public.terms (term, definition, example) values
    ('Touge',       'Japanese for a winding mountain pass, and the kind of road drivers tune a car for.', 'Light wheels and a stiff chassis for a Sunday touge run.'),
    ('Restomod',    'A classic car restored on the outside and updated underneath with modern parts.',    'A 1969 Camaro with a modern fuel-injected V8 and disc brakes.'),
    ('Sleeper',     'A fast car that looks ordinary on purpose.',                                         'A plain family wagon hiding a turbocharged engine.'),
    ('Stance',      'How a car sits: ride height, wheel fitment and camber.',                             'Coilovers and wide wheels for an aggressive stance.'),
    ('Daily driver', 'The car you use every day, as opposed to a weekend or track car.',                  'A reliable hatchback with a few sensible upgrades.')
on conflict do nothing;

-- Generation examples.
insert into public.generation_examples (title, input_prompt, expected_output, chain_id)
select e.title, e.input_prompt, e.expected_output, (select id from public.prompt_chains where name = 'Build designer')
  from (values
    ('Sunday touge Miata',
     'Car: Mazda MX-5 Miata (NA). Vibe: touge sunday.',
     '{"title":"Sunday Special","tagline":"Small car, loud opinions","mods":[{"category":"Wheels","part":"Enkei RPF1 15x7","detail":"Light, strong, cheap to replace","cost_usd":1200},{"category":"Suspension","part":"Coilovers","detail":"Firm, adjustable","cost_usd":1100}]}'),
    ('Quiet sleeper wagon',
     'Car: Volvo V70. Vibe: sleeper, nobody should notice.',
     '{"title":"Grocery Getter","tagline":"Looks like errands, goes like a rumour","mods":[{"category":"Engine","part":"Stage 2 ECU tune","detail":"More boost, same sound","cost_usd":900}]}')
  ) as e(title, input_prompt, expected_output)
 where not exists (select 1 from public.generation_examples x where x.title = e.title);

-- Who may sign up. A course domain as an example; remove it if it is not yours.
insert into public.allowed_signup_domains (domain, note) values
    ('columbia.edu', 'Sample row.')
on conflict (domain) do nothing;
