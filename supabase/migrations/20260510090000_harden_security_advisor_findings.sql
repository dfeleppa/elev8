-- Harden Supabase Security Advisor findings
-- - Restrict SECURITY DEFINER RPC exposure
-- - Pin search_path on exposed helper functions
-- - Move extensions out of public schema

begin;

-- 1) Restrict EXECUTE on mobile helper functions.
-- mobile_app_user_id(): keep authenticated access (intentional mobile RPC),
-- but remove broad PUBLIC/anon access.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('mobile_app_user_id', 'mobile_app_user_role')
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;

-- Ensure mobile_app_user_id() remains callable by signed-in users.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mobile_app_user_id'
  loop
    execute format(
      'grant execute on function %I.%I(%s) to authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;

-- 2) Pin search_path on SECURITY DEFINER mobile helpers if present.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('mobile_app_user_id', 'mobile_app_user_role')
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;

-- 3) Move extensions to a dedicated schema.
create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    alter extension vector set schema extensions;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

commit;
