-- STAGING FIRST. No identity data is backfilled or inferred by this migration.
-- Review the schema reconciliation manifest before choosing an environment.
begin;

drop trigger if exists on_auth_user_login on auth.users;
-- No CASCADE: an unexpected dependency must stop the rollout for review.
drop function if exists public.sync_supabase_auth_uid();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_password_identity_proof()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select case when jsonb_typeof(auth.jwt()->'amr') = 'array' then (
    select coalesce(
      bool_or(entry->>'method' = 'password') and
      bool_and(coalesce(entry->>'method' in ('password', 'totp', 'token_refresh'), false)),
      false
    )
    from jsonb_array_elements(auth.jwt()->'amr') entry
  ) else false end;
$$;
revoke all on function private.has_password_identity_proof() from public, anon;
grant execute on function private.has_password_identity_proof() to authenticated, service_role;

-- Privilege elevation is limited to a lookup derived from the caller's
-- verified UID. This avoids recursive app_users RLS without exposing rows.
create or replace function private.resolve_mobile_app_user_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when count(*) = 1 and bool_and(app_user.role in ('member', 'coach', 'admin', 'owner'))
    then (array_agg(app_user.id))[1] else null end
  from public.app_users app_user
  join auth.users auth_user on auth_user.id = app_user.supabase_auth_uid
  where app_user.supabase_auth_uid = (select auth.uid())
    and private.has_password_identity_proof();
$$;
revoke all on function private.resolve_mobile_app_user_id() from public, anon;
grant execute on function private.resolve_mobile_app_user_id() to authenticated, service_role;

create or replace function private.resolve_mobile_app_user_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select app_user.role from public.app_users app_user
  where app_user.id = private.resolve_mobile_app_user_id();
$$;
revoke all on function private.resolve_mobile_app_user_role() from public, anon;
grant execute on function private.resolve_mobile_app_user_role() to authenticated, service_role;

create or replace function public.mobile_app_user_id()
returns uuid
language sql stable security invoker set search_path = ''
as $$ select private.resolve_mobile_app_user_id(); $$;
create or replace function public.mobile_app_user_role()
returns text
language sql stable security invoker set search_path = ''
as $$ select private.resolve_mobile_app_user_role(); $$;
revoke all on function public.mobile_app_user_id() from public, anon;
revoke all on function public.mobile_app_user_role() from public, anon;
grant execute on function public.mobile_app_user_id() to authenticated, service_role;
grant execute on function public.mobile_app_user_role() to authenticated, service_role;

alter table public.app_users enable row level security;
-- Remove every old app_users policy: an additional permissive policy would OR
-- with the strict one. Unexpected policies must be inventoried before rollout.
do $$
declare policy_row record; column_names text;
begin
  for policy_row in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'app_users'
  loop
    execute format('drop policy %I on public.app_users', policy_row.policyname);
  end loop;
  -- Table REVOKE does not remove independent column privileges.
  select string_agg(quote_ident(attname), ', ' order by attnum) into column_names
    from pg_attribute where attrelid = 'public.app_users'::regclass
      and attnum > 0 and not attisdropped;
  execute format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on public.app_users from public, anon, authenticated',
    column_names
  );
end $$;
revoke all on public.app_users from public, anon, authenticated;
grant select (
  id, email, full_name, role, sex, birth_date, height_cm,
  current_weight_kg, body_fat_percent, supabase_auth_uid, created_at
) on public.app_users to authenticated;
create policy app_users_mobile_self_read on public.app_users
  for select to authenticated using (id = public.mobile_app_user_id());

commit;
