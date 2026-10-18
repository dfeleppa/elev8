# Trusted identity boundary

Local proposal on `codex/crm-foundation-gate`, October 17, 2026. Not deployed. No production identity rows were changed.

## Enforced behavior

Both the existing `member.ts` helpers and CRM helpers now delegate to `identity-context.ts`. A request needs a server-verified Supabase Auth UID, exactly one existing `app_users.supabase_auth_uid` match, and a valid current database role (`member`, `coach`, `admin`, `owner`). The returned ID is the canonical `app_users.id`, which may differ from Auth UID. Database errors, missing/duplicate links and null/unknown roles deny access. Roles are re-read on every request.

Web requests require a NextAuth cookie containing `verifiedAuthUid` issued by successful Supabase password authentication. Legacy email-only sessions and `DEV_AUTH_EMAIL` do not resolve an identity. Client-triggered session updates cannot supply that UID. Login uses an isolated nonpersistent Auth client and never creates an app user, migrates a legacy bcrypt password or repairs a link.

Bearer requests verify JWT claims through Supabase `getClaims`, require a signed password authentication method, validate the Auth user with `getUser`, and require matching subjects. An Authorization header always takes precedence over a cookie, including an empty or malformed header. Editable user metadata, email, app-user primary-key coincidence and OAuth provider metadata are not identity proof.

Allowed signed AMR methods are `password`, `totp`, and `token_refresh`, with `password` mandatory. OAuth, recovery, OTP-only, missing and mixed password/OAuth proof fail closed. SQL enforces the same rule for direct client access. This is deliberately restrictive pending actual hosted password/MFA/refresh verification. It does not claim immediate revocation of every outstanding bearer or NextAuth session; password reset, Auth ban/deletion, session expiry/revocation and account recovery require their own end-to-end release checks.

The new migration `20261017233030_trusted_identity_boundary.sql`:

- Removes `on_auth_user_login` and `sync_supabase_auth_uid`, which previously linked or overwrote app ownership on Auth insert/update by matching email. Unexpected dependencies abort the transaction; no `CASCADE` is used.
- Replaces the September email-fallback resolver with one exact UID lookup, requires a matching Auth user, rejects ambiguity/invalid roles, and keeps definer lookups private with an empty search path. Public RPC wrappers remain invoker functions.
- Replaces permissive `app_users` policies with exact self-read and revokes independent column-write grants as well as table grants. Only the existing safe profile-column SELECT list is restored to authenticated clients. Service-role access remains server-only.
- Makes no changes to account IDs, email addresses, roles, passwords or links. It preserves the existing unique UID constraint.

The full inspected policy set must be reviewed before any rollout because PostgreSQL permissive policies combine with OR; silently leaving a legacy policy would reopen access. The test fixture reproduces a dangerous column UPDATE grant as well as the email trigger, and proves they are removed.

## Rollout impact and ownership review

The production audit found 12 app users: three linked owners, six unlinked members and three unlinked coaches; no duplicate or orphan links; one legacy password-hash row. These are counts, not ownership verification. All three existing links need an ownership audit because the old trigger could replace a link. Nine unlinked accounts and any account relying on the legacy password bridge need an explicit recovery/link process before this can be released to them.

Google and Apple sign-in callbacks are gated across the web application with a clear login message. This is broader than the earlier CRM-only gate. Existing email-only sessions must sign in again; OAuth-only and unlinked users remain unable to access protected data. Do not deploy this proposal before proving required staff/member access in staging and planning recovery. No automatic migration of these users is included.

## Provider-subject mapping design before enabling OAuth

This is a design gate, not an implemented endpoint or binding table. Keep OAuth disabled until all of the following exist:

1. A server-only binding record ties a unique `(issuer, audience/client, provider, subject)` to one canonical app user and the intended Supabase UID. Enforce uniqueness and foreign keys. Bindings carry creator/reviewer, verification method/time and revocation metadata; history is append-only/audited. Email is display/contact information, never the binding key.
2. A signed-in user reauthenticates their already-linked account, then completes the new provider's verified authorization flow using state, nonce and PKCE where supported. Server validation checks signature, issuer, audience, expiry and exact subject. Use an expiring single-use binding challenge; consume it transactionally. Client-selected role/app IDs cannot authorize the link. OAuth-only legacy accounts need separately documented ownership recovery with explicit review.
3. Session issuance resolves the verified provider subject through this binding. Account switch, conflicting binding, revoke/rebind and duplicate attempts fail closed or require explicit recovery. Supabase automatic same-email provider linking must not grant app access: a shared Auth UID alone does not establish which provider proved ownership. Do not simply remove the AMR gate from native bearer authorization; implement a verifiable subject-bound native session/token-exchange path first.
4. Browser and native tests cover forged/mismatched issuer/audience/subject, same-email different subjects, unverified/missing email, conflicting and revoked bindings, state/nonce/PKCE failures, replay, account switching, refresh, role changes, logout and recovery. Test that user metadata cannot claim a role or binding. Record real provider configuration and callback/deep-link behavior using staging-only accounts.

No OAuth mapping table, identity repair API or production backfill is introduced here. [Staging verification](crm-staging-verification.md) and [schema reconciliation](crm-schema-reconciliation.md) remain prerequisites for rollout.
