# Unified iOS member workflow increment

October 17, 2026. Local implementation on the shared CRM checkout; no deployment, production migration, identity repair, or real member write performed.

## Delivered

- Member Schedule and Profile tabs in the existing unified Swift app. Authorized staff can switch to the member experience using the same account.
- Profile loads the signed-in member's name/email and saves a name change. Email, role, identity links and health metrics cannot be changed through this bounded native contract.
- Schedule selects a gym-local day, shows availability and own reservation, books a class and confirms cancellation. Loading, empty, failure, submission and unconfirmed-write states are explicit. After an unconfirmed change, refresh must succeed before another submission. Foreground refresh and pull-to-refresh reload schedule status.
- `/api/v1/member/profile` GET/PUT, `/api/v1/member/schedule?date=YYYY-MM-DD` GET, and `/api/v1/member/schedule/reservations` POST/DELETE use the existing strict `requireClientContext` identity gate. The server resolves the member from one trusted Auth UID link, never caller IDs or email. Browser mutations require an allowed Origin. Responses are private/no-store.
- Legacy athlete routes retain their existing resolver and response contracts. Their database/business handlers were extracted so the new adapters reuse those operations without invoking legacy email-based account linking. Existing mobile/web clients remain supported. The new member API removes roster names, emails, IDs and booking timestamps from schedule responses.
- New York class cutoff calculations are independent of the backend process timezone for the versioned API. Existing legacy callers retain server-local interpretation pending a separately reviewed migration of those clients. The native calendar explicitly uses `America/New_York`.
- Additive `20261018001214_member_reservation_capacity_guard.sql`: an invoker trigger serializes inserts on the class row, then checks duplicate membership and capacity. This closes the read-count/insert race for both supported APIs once deployed. No new table/client privileges are granted. The migration was created with the Supabase CLI and has not been applied to any hosted database.
- Separate [member OpenAPI contract](../packages/contracts/member-openapi.json), shared response fixtures and five native contract/state tests. The name-only profile scope is intentional for this increment; wider profile editing remains on existing surfaces.

## Local evidence

- `npx vitest run src/features/member`: 17 tests passed. Includes canonical self ownership for profile/booking/cancellation, forged field rejection, Origin denial, invalid payloads/dates, unauthorized identities, peer roster suppression, duplicate booking, gym DST cutoff dates and actual PGlite trigger/grant enforcement.
- Existing `src/app/api/athlete/schedule/route.test.ts`: all three tests passed after handler extraction, preserving legacy response and booking/cancellation behavior.
- `npx tsc --noEmit`: passed with the concurrent CRM increment present.
- Scoped ESLint for all changed member/legacy handler files and schedule utilities: passed.

PGlite checks SQL behavior against a minimal synthetic schema and executes queries serially; it does not prove simultaneous PostgreSQL connections, production schema compatibility or migration history. No hosted test queries were made. No Swift toolchain/Xcode is installed in this Windows environment. Native tests were authored and included automatically by the existing XcodeGen test target; they were **not executed locally**. Prior iOS CI evidence in the foundation runbook applies to the earlier code only.

## Review and rollout gates

1. Reconcile the actual `schedule_classes`/`class_reservations` schema and migration ledger read-only. The historical single-tenant migration renamed the organization tables; the isolated staging fixture must model the current names, constraints and grants. Apply the reviewed capacity migration only through the isolated staging process in [the runbook](crm-staging-verification.md).
2. Verify two different synthetic members competing for the last spot with separate PostgreSQL connections; exactly one insert must commit. Repeat duplicate requests and cancellation/rebooking. Check table-level grants/RLS and direct client paths in the real staging schema. The new app must not be rolled out before the capacity guard is present.
3. Use the staging member's explicitly linked Auth UID, with app ID different from Auth UID, through cookie and bearer API paths. Prove missing/ambiguous links and role changes fail closed; verify no other member's profile or reservation can be modified.
4. Run the existing macOS build/test workflow against this commit, then authenticated simulator UI flows against reachable isolated staging: sign-in, profile save/reload, date change, empty day, full/closed class, book/reload/cancel, expired token, network loss after submit, foreground return, sign-out and account switch. Add physical-device evidence for session storage/network recovery separately.
5. Confirm the gym timezone and any overnight class behavior with actual schedule fixtures; include spring-forward nonexistent and fall-back ambiguous overnight times if such classes are scheduled. The tests currently cover daytime classes across DST date changes.

Hosted staging remains blocked as documented in the staging runbook. Workout logging, nutrition, gym chat, notifications, recovery flows, signing and distribution are not completed by this bounded member increment. No milestone or production release gate is marked complete here.
