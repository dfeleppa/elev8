# Google and Apple sign-in for the Lyfe web app

The web app accepts only Google and Apple OAuth. There is no Credentials provider, password form, or password recovery flow. Existing password-issued web sessions must sign in again. Native app projects retain their separate authentication flow and are outside this web change.

## Configuration and release

1. Apply `supabase/migrations/20261027155832_oauth_only_web_identity.sql` in staging first.
2. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `NEXTAUTH_URL` (HTTPS), and `NEXTAUTH_SECRET`. Apple requires a Services ID and a signed client-secret JWT; renew the JWT before it expires. No secrets belong in browser code.
3. Register exact callbacks `/api/auth/callback/google` and `/api/auth/callback/apple` on the web app origin in the respective provider consoles. Apple uses a cross-site form POST; state, nonce, and invitation cookies use Secure/SameSite=None in production. NextAuth validates the OIDC token and state/nonce; Google also uses PKCE.
4. Review and create provider-subject bindings for existing accounts before switching production. The migration deliberately does not infer ownership from matching email addresses or from Supabase's automatic email linking. Provider subjects must come from an independently verified provider authorization flow; do not accept a client-entered subject as evidence. For existing staff/owners, document the ownership review and intended app account before inserting a binding. Never copy a binding to a different audience/client.
5. Run real Google and Apple sign-ins, sign-out, account switch, registration, redirect, and revocation checks on an HTTPS staging deployment before production rollout. Missing credentials, missing migrations, or unbound existing accounts prevent sign-in; password fallback is unavailable.

An existing-account binding is an operator-reviewed SQL operation in `private.web_oauth_identities`: record `provider`, canonical `issuer`, exact OAuth client `audience`, verified provider `subject`, canonical `app_user_id`, the account's current `supabase_auth_uid` (including NULL), `verified_by`, and `verification_method`. The table records verification time and preserves immutable history. Revoke with `revoked_at = now()`; identities cannot be reassigned or reactivated. No production bindings are created by the application on email match.

New members enter the gym invitation code, then choose Google or Apple. A verified provider email and signed invitation ticket permit a transactional new member account and identity binding. An existing email, duplicate provider binding, invalid invitation, or unverified email cannot claim an account. New accounts always receive the member role. Apple relay addresses are contact data, not identity keys.

Web sessions store only the provider/issuer/audience/subject tuple. Every protected request resolves the active binding and reads the current database role. Revocation takes effect on the next protected request. Session updates and editable provider metadata cannot set app IDs or roles. Password-issued web sessions are rejected even if they contain an old verified UID.

Supabase password auth and native bearer access have not been globally disabled by this web change. The existing native AMR/RLS restrictions remain intact; changing those requires a separate subject-bound native OAuth exchange. Do not remove that gate based only on a Supabase UID or an OAuth AMR claim.
