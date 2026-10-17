-- Synthetic test fixture, shaped around the inspected production identity
-- columns/grants/trigger. NOT a full schema baseline or a hosted seed.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid;
$$;
create table public.app_users (
  id uuid primary key, email text not null unique, role text,
  supabase_auth_uid uuid unique, full_name text, password_hash text,
  sex text, birth_date date, height_cm numeric, current_weight_kg numeric,
  body_fat_percent numeric, created_at timestamptz default now(),
  updated_at timestamptz
);
grant all on public.app_users to service_role;
alter table public.app_users enable row level security;
grant select on public.app_users to authenticated;
grant update (supabase_auth_uid, role) on public.app_users to authenticated;
create policy legacy_email_read on public.app_users for select to authenticated
  using (lower(email) = lower(auth.jwt()->>'email'));
create policy legacy_claim on public.app_users for update to authenticated
  using (true) with check (true);
-- The inspected trigger can even overwrite an existing non-null link.
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
