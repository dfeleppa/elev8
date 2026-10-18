# Elev8 CRM Foundation Build Status

**Latest database rollout:** the user directed work on main Supabase. Contacts, sales workflow, booking-capacity and SMS-outbox migrations are now applied and transactionally smoke-tested there. See [main rollout evidence](crm-main-rollout.md). Earlier absent-table/staging-only statements below describe previous checkpoints; the web/native application changes have not been deployed by this database rollout.

October 17, 2026

Foundation [PR #85](https://github.com/dfeleppa/elev8/pull/85) merged into `main` as `f00b8a144e36bed6c74dfc0a1198835cdb8c2a44`. Staging verification continues on `codex/crm-staging-verification`. The existing web application remains at the monorepo root; the unified native target lives at `apps/ios/Elev8`.

## Implemented

- `/admin/crm`: admin/owner contact directory, bounded pagination, create form, validation, loading/error/empty states, and stable creation IDs for retries. Accessible through the Admin sidebar.
- `/api/v1/session`: canonical application user ID, role, and member/coaching/CRM capabilities.
- `/api/v1/crm/contacts`: list and create contacts, with server-side admin/owner authorization, input validation, browser Origin checks, and no-store responses. Coaches have no implicit CRM access.
- Versioned APIs require exactly one existing `supabase_auth_uid` link: mobile uses verified bearer tokens and web uses a fresh password session's verified Auth UID. They never auto-link by email, create accounts, or trust a client-supplied role. CRM access for email-only/OAuth sessions remains gated on trusted subject mapping.
- Proxy handling lets versioned APIs return JSON authentication errors instead of redirecting mobile clients to HTML login pages. Existing web-page protection remains.
- `crm_contacts` migration keeps prospects separate from login accounts. Direct anon/authenticated access is revoked, RLS is enabled, and the server role is limited to select/insert on the new table.
- SwiftUI app: existing email/password account login, restore/sign-out, member/staff navigation, and native contact list/create for authorized admins and owners. The member home is a foundation shell; training, bookings, nutrition, chat, and coaching screens are not yet connected.
- OpenAPI contract and shared response fixtures under `packages/contracts`; native decoding tests and a macOS build/test workflow.

## Verification

The original 119 tests passed before new tests were added. The foundation expanded this to 156; the staging follow-up now passes 161 tests across 32 files, including authorization, session claim integrity, identity linking rejection, duplicate operations, cursor pagination, and actual PostgreSQL migration/RLS checks using PGlite. PGlite validates this migration in isolation against a minimal user table; it does not prove the entire historical migration chain against production.

TypeScript checks and the Next.js production build pass. The foundation build used explicit nonfunctional placeholders; the integration follow-up also builds against the real disposable Supabase stack. Neither proves connectivity to production services. Lint has no errors and four pre-existing warnings.

Authenticated [integration run 39077107248](https://github.com/dfeleppa/elev8/actions/runs/39077107248) passed all 11 end-to-end tests at `d51f2d1`. A disposable Supabase stack applied the contact migration through the CLI, checked RLS/grants, and ran real browser → NextAuth cookie/API → PostgreSQL create/list checks plus mobile bearer authorization. Hosted staging verification remains open; the test fixture is not a production schema clone.

Read-only Supabase inspection reports Elev8 as `ACTIVE_HEALTHY`. The user table has 12 records, 3 linked Auth identities (all staff), and no duplicate non-null links. Nine records need identity review before native member rollout. The new contact table is absent from the live database. No production database mutation or phone-routing change was performed.

GitHub Actions [run 39077107327](https://github.com/dfeleppa/elev8/actions/runs/39077107327) passed both web and iOS jobs at `d51f2d1`, repeating the earlier foundation [run 39030675413](https://github.com/dfeleppa/elev8/actions/runs/39030675413). The Swift application and test target compiled on macOS, and three shared contract tests passed in the iOS simulator. Signing, physical-device behavior, and authenticated hosted staging integration remain unverified. PR #85 is merged; follow-up [PR #86](https://github.com/dfeleppa/elev8/pull/86) remains draft. Subsequent status-only documentation changes do not alter the tested code.

## Staging follow-up — October 17

See [staging runbook and evidence](crm-staging-verification.md). Production inspection remains read-only: 12 app users, 3 linked owners, 6 unlinked members and 3 unlinked coaches, no duplicate or orphan links, and no `crm_contacts` table. Vercel reports the merged foundation deployment READY in project `daneff`.

No hosted staging project was discovered. Supabase branch creation was rejected because branching requires Pro; Vercel environment metadata returned 403 and the explicitly scoped CLI fallback also denied access. No branch was created, no production migration or identity change was made, and no messaging/routing action was taken.

The disposable integration job passed: member/coach denials, admin/owner access and browser contact persistence, canonical app IDs across both auth paths, missing/ambiguous links, legacy session rejection, bearer precedence over cookies, direct REST denials, origin checks, payload validation, duplicate IDs, refresh, live role changes, web sign-out, and cursor pagination. SQL assertions confirmed the recorded migration, RLS, denied direct client privileges and SELECT/INSERT-only server grants. Cleanup passed and destroyed the test stack. This proves the bounded contacts flow; it does not close the hosted staging or native UI/device gates.

Identity hardening: new versioned web APIs and `/admin/crm` now require a verified Auth UID from a fresh password session, resolved to exactly one existing app user, just like mobile. Old email-only sessions and OAuth sessions without a trusted subject mapping are denied. Other legacy web routes retain their current auth behavior and require a separate identity audit. Password sign-in uses a separate client so it cannot replace the shared service-role client's identity. The not-yet-deployed contact migration explicitly removes inherited service-role grants before granting SELECT/INSERT.

## Run and deploy the increment

1. Use a staging Supabase project with the existing Elev8 schema and trusted test accounts. Verify each test account's Auth UID is linked once in `app_users`; never infer ownership from an unverified email.
2. Apply `supabase/migrations/20261017114730_crm_contacts_foundation.sql` through the staging migration process. Verify table privileges, RLS, and schema compatibility before production application.
3. Configure the existing server environment securely: Supabase URL/service-role key, Google OAuth settings, NextAuth secret, and the canonical application URL. Do not use build placeholders or production credentials for a test environment.
4. Run `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Start the app and sign in as an admin/owner to exercise `/admin/crm`; then verify member and coach denial through direct API calls.
5. Follow `apps/ios/Elev8/README.md` on a Mac. Generate the Xcode project, configure public staging settings, resolve/lock dependencies, build, and run the contract tests. Confirm login and contacts against the same staging backend.

## Next build steps

Finish staging identity validation and authenticated end-to-end testing, then add contact detail/edit, member linking with an explicit verified process, opportunity pipelines, assignments, and follow-up tasks. Connect the member schedule and booking flow in the same native app alongside CRM work. Messaging follows the durable outbox and webhook foundation; Twilio credentials, sending, and number routing are not implemented in this increment.
