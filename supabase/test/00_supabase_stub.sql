-- Заглушки окружения Supabase (роли, auth.uid(), auth.jwt()),
-- чтобы прогнать schema.sql и проверить RLS на чистом Postgres.

-- Заглушки окружения Supabase, чтобы прогнать schema.sql на чистом Postgres.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create table auth._ctx (uid uuid, jwt jsonb);
insert into auth._ctx values (null, '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select uid from auth._ctx limit 1 $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select jwt from auth._ctx limit 1 $$;
-- В боевом Supabase anon/authenticated имеют доступ к auth.uid()/auth.jwt().
grant usage on schema auth to anon, authenticated;
grant select on auth._ctx to anon, authenticated;
