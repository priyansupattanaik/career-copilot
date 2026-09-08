-- Idempotent grants for an already-created Career Copilot schema.
-- Run this in the Supabase SQL Editor if tables exist but the API returns
-- HTTP 403 / Postgres 42501 "permission denied for table ...".
-- Safe to re-run.
--
-- FastAPI uses the secret / service_role key only. Do not grant table DML to
-- anon or authenticated here; those roles are for direct PostgREST, which this
-- app does not use. Apply docs/database/supabase-schema.sql first.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

do $$
begin
  if to_regclass('public._setup_checks') is not null then
    execute 'alter table public._setup_checks enable row level security';
  end if;
end $$;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;

notify pgrst, 'reload schema';
