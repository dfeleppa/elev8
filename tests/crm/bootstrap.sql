-- Disposable local/CI fixture ONLY. This is not a production schema snapshot.
-- Do not install in hosted projects or move into supabase/migrations.
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  supabase_auth_uid uuid references auth.users(id),
  email text not null unique,
  role text not null default 'member' check (role in ('member','coach','admin','owner')),
  full_name text,
  password_hash text,
  updated_at timestamptz not null default now()
);
alter table public.app_users enable row level security;
revoke all on public.app_users from public, anon, authenticated;
grant all on public.app_users to service_role;
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
