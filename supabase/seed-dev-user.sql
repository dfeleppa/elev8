-- Local dev owner account.
--
-- 1. Replace CHANGE_ME_BEFORE_RUNNING with your password.
-- 2. Run this in Supabase Studio SQL editor.
-- 3. Sign in locally as dev.owner@lyfe.local, or rely on DEV_AUTH_EMAIL.
--
-- The app's credentials login will migrate this legacy password_hash into
-- Supabase Auth the first time you sign in successfully.

begin;

create extension if not exists pgcrypto;

do $$
declare
  seed_password text := 'CHANGE_ME_BEFORE_RUNNING';
begin
  if seed_password = 'CHANGE_ME_BEFORE_RUNNING' then
    raise exception 'Edit seed_password before running this seed.';
  end if;

  insert into public.app_users (
    id,
    email,
    full_name,
    first_name,
    last_name,
    role,
    password_hash,
    membership,
    status,
    tracks,
    created_at,
    updated_at
  )
  values (
    '10000000-0000-4000-8000-000000000001',
    'dev.owner@lyfe.local',
    'Dev Owner',
    'Dev',
    'Owner',
    'owner',
    crypt(seed_password, gen_salt('bf', 10)),
    'Staff',
    'active',
    'Main',
    now(),
    now()
  )
  on conflict (email) do update set
    full_name = excluded.full_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    password_hash = excluded.password_hash,
    membership = excluded.membership,
    status = excluded.status,
    tracks = excluded.tracks,
    updated_at = now();
end $$;

commit;
