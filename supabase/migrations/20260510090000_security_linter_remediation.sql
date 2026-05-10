-- Address Supabase database linter warnings:
--   0014 extension_in_public (pg_trgm, vector)
--   0028/0029 security definer function executable by anon/authenticated

-- 1) Move extensions out of public schema.
create schema if not exists extensions;

alter extension if exists pg_trgm set schema extensions;
alter extension if exists vector set schema extensions;

-- 2) Restrict SECURITY DEFINER RPC exposure.
-- Revoke EXECUTE only if public.mobile_app_user_role() exists.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mobile_app_user_role'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke execute on function public.mobile_app_user_role() from public;
    revoke execute on function public.mobile_app_user_role() from anon;
    revoke execute on function public.mobile_app_user_role() from authenticated;
  end if;
end
$$;
