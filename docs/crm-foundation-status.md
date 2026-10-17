# Elev8 CRM Foundation Build Status

October 17, 2026

Branch: `codex/crm-ios-foundation`. The existing web application remains at the monorepo root; the unified native target lives at `apps/ios/Elev8`.

## Implemented

- `/admin/crm`: admin/owner contact directory, bounded pagination, create form, validation, loading/error/empty states, and stable creation IDs for retries. Accessible through the Admin sidebar.
- `/api/v1/session`: canonical application user ID, role, and member/coaching/CRM capabilities.
- `/api/v1/crm/contacts`: list and create contacts, with server-side admin/owner authorization, input validation, browser Origin checks, and no-store responses. Coaches have no implicit CRM access.
- New mobile APIs verify Supabase bearer tokens and require exactly one existing `supabase_auth_uid` link. They never auto-link by email, create accounts, or trust a client-supplied role.
- Proxy handling lets versioned APIs return JSON authentication errors instead of redirecting mobile clients to HTML login pages. Existing web-page protection remains.
- `crm_contacts` migration keeps prospects separate from login accounts. Direct anon/authenticated access is revoked, RLS is enabled, and the server role is limited to select/insert on the new table.
- SwiftUI app: existing email/password account login, restore/sign-out, member/staff navigation, and native contact list/create for authorized admins and owners. The member home is a foundation shell; training, bookings, nutrition, chat, and coaching screens are not yet connected.
- OpenAPI contract and shared response fixtures under `packages/contracts`; native decoding tests and a macOS build/test workflow.

## Verification

The original 119 tests passed before new tests were added. The expanded suite passes 156 tests across 30 files, including authorization, identity linking rejection, duplicate operations, cursor pagination, and actual PostgreSQL migration/RLS checks using PGlite. PGlite validates this migration in isolation against a minimal user table; it does not prove the entire historical migration chain against production.

TypeScript checks and the Next.js production build pass. Build-time configuration uses explicit nonfunctional placeholders; this proves compilation, not connectivity to production services. Lint has no errors and four pre-existing warnings.

Local HTTP checks confirm JSON 401 responses for both versioned routes without authentication and for malformed authorization. The full authenticated browser-to-database flow remains unverified because local staging credentials and an applied staging migration are not configured.

Read-only Supabase inspection reports Elev8 as `ACTIVE_HEALTHY`. The user table has 12 records, 3 linked Auth identities (all staff), and no duplicate non-null links. Nine records need identity review before native member rollout. The new contact table is absent from the live database. No production database mutation or phone-routing change was performed.

GitHub Actions [run 39030675413](https://github.com/dfeleppa/elev8/actions/runs/39030675413) passed both web and iOS jobs. The Swift application and test target compiled on macOS, and shared contract tests passed in the iOS simulator. Signing, physical-device behavior, and authenticated staging integration remain unverified. Review the increment in [draft PR #85](https://github.com/dfeleppa/elev8/pull/85).

## Run and deploy the increment

1. Use a staging Supabase project with the existing Elev8 schema and trusted test accounts. Verify each test account's Auth UID is linked once in `app_users`; never infer ownership from an unverified email.
2. Apply `supabase/migrations/20261017114730_crm_contacts_foundation.sql` through the staging migration process. Verify table privileges, RLS, and schema compatibility before production application.
3. Configure the existing server environment securely: Supabase URL/service-role key, Google OAuth settings, NextAuth secret, and the canonical application URL. Do not use build placeholders or production credentials for a test environment.
4. Run `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Start the app and sign in as an admin/owner to exercise `/admin/crm`; then verify member and coach denial through direct API calls.
5. Follow `apps/ios/Elev8/README.md` on a Mac. Generate the Xcode project, configure public staging settings, resolve/lock dependencies, build, and run the contract tests. Confirm login and contacts against the same staging backend.

## Next build steps

Finish staging identity validation and authenticated end-to-end testing, then add contact detail/edit, member linking with an explicit verified process, opportunity pipelines, assignments, and follow-up tasks. Connect the member schedule and booking flow in the same native app alongside CRM work. Messaging follows the durable outbox and webhook foundation; Twilio credentials, sending, and number routing are not implemented in this increment.
