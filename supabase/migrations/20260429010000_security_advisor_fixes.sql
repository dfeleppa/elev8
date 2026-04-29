-- Address Supabase advisor warnings:
--   0011 function_search_path_mutable
--   0028/0029 SECURITY DEFINER functions executable by anon/authenticated

-- 1. Lock down search_path on programming.* functions.
alter function programming.search_workouts(
  vector, text[], text[], text[], text, uuid, text, date, date, integer
) set search_path = '';

alter function programming.set_updated_at() set search_path = '';

-- 2. sync_supabase_auth_uid is a trigger function; it should never be
--    callable via PostgREST. Triggers fire regardless of EXECUTE ACL.
revoke execute on function public.sync_supabase_auth_uid() from public;
revoke execute on function public.sync_supabase_auth_uid() from anon;
revoke execute on function public.sync_supabase_auth_uid() from authenticated;

-- 3. mobile_app_user_id is an intentional RPC for signed-in mobile users.
--    Revoke from PUBLIC/anon (returns null for unauthenticated callers
--    anyway); leave EXECUTE on authenticated for intentional RPC usage.
revoke execute on function public.mobile_app_user_id() from public;
revoke execute on function public.mobile_app_user_id() from anon;
