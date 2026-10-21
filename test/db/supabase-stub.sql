-- Just enough of Supabase for Mod Squad's SQL and supabase/admin.sql to run on a plain Postgres:
-- the API roles, auth.users / auth.uid(), and the storage tables. Local testing only.
-- Never run this against a real Supabase project.

-- Roles belong to the whole Postgres server, not to one database, so they may already exist.
do $$
begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to current_user;

create schema auth;
create table auth.users (
    id                uuid primary key default gen_random_uuid(),
    email             text,
    raw_app_meta_data jsonb not null default '{"provider": "google"}',
    created_at        timestamptz not null default now(),
    last_sign_in_at   timestamptz
);
create function auth.uid() returns uuid
language sql stable as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language plpgsql as $$
declare _parts text[];
begin
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

-- What Supabase does for everything created in the public schema: hand it to the API roles.
-- Mod Squad's files then revoke what they do not want, which is the behaviour being tested.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Created by an earlier course assignment; Mod Squad's SQL expects it.
create table public."Car" ("Brand" text, "Model" text);
