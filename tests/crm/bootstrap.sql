-- Disposable local/CI fixture ONLY. This is not a production schema snapshot.
-- Do not install in hosted projects or move into supabase/migrations.
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_uid uuid references auth.users(id),
  email text not null unique,
  role text not null default 'member' check (role in ('member','coach','admin','owner')),
  full_name text,
  password_hash text,
  sex text, birth_date date, height_cm numeric, current_weight_kg numeric,
  body_fat_percent numeric, created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
-- Keep duplicate links possible only in this bounded fixture so the API and
-- SQL resolvers face a corrupted-data case. The PGlite identity fixture also
-- verifies the unique constraint that exists in production.
alter table public.app_users enable row level security;
revoke all on public.app_users from public, anon, authenticated;
grant all on public.app_users to service_role;
grant update (supabase_auth_uid, role) on public.app_users to authenticated;
create policy unsafe_fixture_claim on public.app_users for update to authenticated
  using (true) with check (true);
create function public.sync_supabase_auth_uid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.app_users set supabase_auth_uid = new.id
  where lower(email) = lower(new.email)
    and (supabase_auth_uid is null or supabase_auth_uid <> new.id);
  return new;
end;
$$;
create trigger on_auth_user_login after insert or update on auth.users
  for each row execute function public.sync_supabase_auth_uid();
-- Reproduce Supabase's default table grants, which the CRM migration must narrow.
alter default privileges for role postgres in schema public grant all on tables to service_role;

-- Read-only sidebar dependencies; no membership, messaging or provider data.
create table public.gym_settings (id integer primary key, name text);
create table public.workout_results (id uuid primary key, member_id uuid, track_id uuid, day_date date, created_at timestamptz);
create table public.programming_tracks (
  id uuid primary key, name text, code text, description text, is_active boolean,
  is_private boolean, number_of_levels integer, hide_workouts_days_prior integer,
  hide_workouts_hour integer, hide_workouts_minute integer, created_at timestamptz, updated_at timestamptz
);
alter table public.gym_settings enable row level security;
alter table public.workout_results enable row level security;
alter table public.programming_tracks enable row level security;
revoke all on public.gym_settings, public.workout_results, public.programming_tracks from public, anon, authenticated;
grant select on public.gym_settings, public.workout_results, public.programming_tracks to service_role;
