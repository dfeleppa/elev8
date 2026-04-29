-- Broaden the mobile self-read RLS policy to also match by JWT email.
--
-- The existing policy only allowed reading rows where
-- supabase_auth_uid = auth.uid(), but on a user's first mobile login
-- the supabase_auth_uid is still NULL (the row was created by NextAuth
-- on web, which doesn't know about Supabase Auth). The mobile app then
-- has no way to read its own row to populate name/role/etc., and the
-- async UPDATE in main.dart that stamps the uid races against the
-- screens that try to render the user.
--
-- Allowing the SELECT to additionally match by JWT email closes the
-- chicken-and-egg without weakening the security envelope: Supabase
-- Auth verifies the email claim, so a user can still only see their
-- own row.
--
-- The UPDATE policy that lets mobile stamp supabase_auth_uid is
-- unchanged.

drop policy if exists app_users_mobile_self_read on public.app_users;
create policy app_users_mobile_self_read
  on public.app_users
  for select
  to authenticated
  using (
    supabase_auth_uid = auth.uid()
    or email = (auth.jwt() ->> 'email')
  );
