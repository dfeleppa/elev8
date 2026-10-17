# Member schedule / booking API increment

This is a staging-gated backend increment on the unified Elev8 roadmap. It does not implement native screens or authorize production rollout. CRM APIs, identity repair, global launch flags, Swift session/shell files and the shared root OpenAPI file are unchanged.

## Isolation and release gate

- New routes require `MEMBER_SCHEDULE_ENABLED=true`.
- Hosted staging additionally requires `MEMBER_SCHEDULE_ENVIRONMENT=staging` and `MEMBER_SCHEDULE_STAGING_PROJECT_REF=<reviewed isolated project ref>`. The server Supabase URL must match that reference. The known production reference and `VERCEL_ENV=production` are rejected.
- Disposable integration uses `MEMBER_SCHEDULE_ENVIRONMENT=test` and only `http://127.0.0.1:55321`.
- Default-off and production exclusions are tested. No environment settings are provisioned by this PR.
- The existing Nutrition-only member launch gate remains unchanged.
- Hosted staging identity/schema reconciliation and native/device verification remain release requirements.

Never run root `supabase db push`: the repository has tracked production-link metadata. The CLI workdir below is deliberately separate. No production migration, identity change, provider action or message send is part of this increment.

## APIs and identity

Standalone contract: [member-schedule.openapi.json](../packages/contracts/member-schedule.openapi.json). Booking fixtures use the `schedule-` prefix. Regenerate owned contract artifacts with:

```sh
node --experimental-strip-types tests/member-schedule/generate-contract.mjs
```

| Method/path | Request |
| --- | --- |
| GET /api/v1/member/schedule | optional date=YYYY-MM-DD |
| GET /api/v1/member/schedule/classes/{classId} | optional date=YYYY-MM-DD |
| POST /api/v1/member/schedule/reservations | classId, date, operationId |
| DELETE /api/v1/member/schedule/reservations/{reservationId} | operationId |

The existing verified client resolver validates Supabase bearer tokens or a verified NextAuth password session and requires exactly one `app_users.supabase_auth_uid` link. Missing/ambiguous links fail; no email linking or identity provisioning occurs in new routes. Every role (member, coach, admin, owner) acts only for its canonical app-user ID. Cookie mutations require matching Origin. Responses are private/no-store JSON. Attendee rosters and coach email addresses are omitted.

The legacy reservation routes use the same atomic writer only when the gate is enabled; their URLs, body shape, response shape, duplicate 409 and repeated-cancellation behavior remain supported. When the gate is disabled they retain their previous path and require no booking migration. Legacy identity helpers and the pre-existing proxy behavior for cookie-less legacy bearer requests are not changed here. Mixed-client integration tests use real legacy cookies and versioned bearer tokens. General legacy identity/proxy remediation belongs to the staging workstream.

## Rules and transactions

- America/New_York is the scheduling timezone. Date keys identify gym-local days, not UTC or phone-local days.
- Recurrence start/end are inclusive and weekdays use the existing abbreviations.
- Zero capacity means unlimited. Otherwise capacity is checked inside the transaction after locking the class row.
- Booking closes at the start instant minus the configured number of elapsed hours; equality is closed.
- Nonexistent/repeated DST-hour starts return `invalid_time`, nullable instants and no booking permission instead of guessing an instant.
- Cancellation has no cutoff or fee and remains possible after class start or a recurrence edit. No waitlist is implemented.
- An owner reducing capacity below existing reservations does not remove people. Further bookings fail as full.
- The database unique index guarantees one reservation per class/date/member. Migration preflight fails on duplicates without deleting records.
- Supported API writers lock operation then class consistently. The cutoff is rechecked with the database clock after lock acquisition. No network calls occur within the transaction.
- RPCs use SECURITY INVOKER and are executable only by the server role. Client table/RPC privileges are revoked and RLS remains enabled.
- Operation records are append-only for the server role and are not automatically expired in this increment.

Use a fresh operation UUID for a new explicit intent and retain it for retries. The same UUID with a different payload returns 409. Completed successes and domain failures are replayed without applying the action again. A retry after cancellation cannot resurrect the original booking. Cancellation uses an exact reservation ID and cannot delete a later replacement.

On replay, `reservationId` describes the historical operation result; `session.reservationId` is the current state. `session=null` means the occurrence no longer exists. Read current state after network/503 failures, then retry the same operation if needed. Legacy requests without operation IDs retain their older retry semantics.

## Verification

Local validation: 207 unit/SQL tests pass; TypeScript and production build pass; lint has only four existing warnings. The initial [disposable integration run](https://github.com/dfeleppa/elev8/actions/runs/39079869935) passed 15 authenticated tests, CLI migration/grant assertions and SQL lint, then destroyed the stack. Latest commit-specific checks and additional integration coverage are recorded on [PR #88](https://github.com/dfeleppa/elev8/pull/88).

The dedicated workflow creates synthetic Auth accounts without sending email, explicitly links returned Auth UIDs to different app IDs, applies the actual migration through the CLI, and runs real cookie/bearer requests against PostgreSQL. No credentials, storage state, screenshots or traces are uploaded.

The fixture reuses the bounded identity bootstrap and adds inspected booking table columns. It does not prove historical migration replay or hosted schema parity.

On a clean machine with Docker, Node 22 and psql:

```sh
npm ci
npx supabase start --workdir tests/member-schedule -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
export PGPASSWORD=postgres
psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/member-schedule/bootstrap.sql
mkdir -p tests/member-schedule/supabase/migrations
cp supabase/migrations/20261017232829_member_schedule_booking.sql tests/member-schedule/supabase/migrations/
npx supabase db push --local --workdir tests/member-schedule
psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/member-schedule/assert-schema.sql
npx supabase status --workdir tests/member-schedule --output json > .codex-booking-status.json
node tests/member-schedule/configure.mjs
node tests/member-schedule/build.mjs
npx playwright test --config playwright.member-schedule.config.ts
npx supabase stop --workdir tests/member-schedule --no-backup
```

Always destroy the disposable stack and generated `.codex-booking.env` / status file, including on failure. Before a fresh rerun, remove only the generated booking migration copy inside the test workdir so bootstrap precedes migration. Never substitute a hosted or production URL in this harness.

Windows local checks use PGlite for SQL behavior and permissions; simultaneous transaction behavior is established only by the real PostgreSQL workflow. Simulator, Swift UI, signed-device, hosted preview connectivity and real member identity readiness remain unverified by this API PR.

## Ownership and next increment

Booking owns the new feature/API/contract/migration/test files and the two legacy schedule route adapters. No shared-file coordination was needed for this backend increment. Native implementation should use the schedule contract/fixtures, then coordinate changes to ExperienceView, Xcode project registration, AppSession or the root contract through Daniel. Preserve one staff/member Swift app and the separate Fuelwise boundary.
