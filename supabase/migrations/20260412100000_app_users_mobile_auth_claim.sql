-- app_users mobile auth claim policy
--
-- The mobile app needs to stamp its Supabase Auth UID onto the existing
-- app_users row (created by NextAuth on the web) so that
-- mobile_app_user_id() can resolve auth.uid() → app_users.id.
--
-- SELECT: lets each mobile user read their own row (needed by
--   _resolveAppUserId() which looks up app_users.id by supabase_auth_uid).
-- UPDATE: lets mobile stamp supabase_auth_uid on login.
-- No INSERT — mobile cannot create orphan rows; rows come from NextAuth.

alter table public.app_users enable row level security;

-- Allow mobile users to read their own row so _resolveAppUserId() works.
drop policy if exists app_users_mobile_self_read on public.app_users;
create policy app_users_mobile_self_read
  on public.app_users
  for select
  to authenticated
  using (supabase_auth_uid = auth.uid());

drop policy if exists app_users_mobile_auth_claim on public.app_users;
create policy app_users_mobile_auth_claim
  on public.app_users
  for update
  to authenticated
  using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));
