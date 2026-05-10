-- mobile_app_user_id() only needs the caller's own app_users row.
-- app_users RLS already permits that lookup for authenticated users,
-- so this helper does not need SECURITY DEFINER privileges.

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mobile_app_user_id'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    alter function public.mobile_app_user_id() security invoker;
    alter function public.mobile_app_user_id() set search_path = public, pg_temp;

    revoke execute on function public.mobile_app_user_id() from public;
    revoke execute on function public.mobile_app_user_id() from anon;
    grant execute on function public.mobile_app_user_id() to authenticated;
  end if;
end
$$;
