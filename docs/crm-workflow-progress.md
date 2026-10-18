# CRM sales workflow progress

October 17, 2026. Prepared locally; no production migration, deployment, identity write, message send, or phone routing change.

## Implemented increment

- Contact search by name/email/international phone, preserving bounded UUID pagination. Search accepts literal substrings and rejects PostgREST filter punctuation.
- Shared admin/owner contact detail API with edit, source, and contact ownership; strict full payload validation and optimistic versions prevent silently overwriting another staff member's change. No member linking or permission provisioning.
- Staff-only notes; opportunities with assigned authorized CRM staff, exact USD cents, next action, and new/contacted/consultation/trial/won/lost stages. Web supports updating assignment, value, and next action after creation.
- Follow-up tasks with responsible staff, UTC due date, optional opportunity link, and completion/reopen. Composite foreign key rejects linking an opportunity from another contact.
- Database stage-history trigger records creation and transitions in the same transaction with the verified API actor. Versions increment in database triggers. Duplicate creation UUIDs return conflict so clients can refresh before retrying.
- Web directory detail workspace exposes the workflow and overdue tasks. Native iPhone contact search/detail adds contact edit/ownership, notes, opportunity creation and stage changes, task creation/assignment/completion and stage history. Existing shared session/root models remain unchanged.
- OpenAPI 0.2 contract, contact-detail shared fixture, TypeScript contract checks and native decode test.

## Migration and authorization

`supabase/migrations/20261018000955_crm_sales_workflow.sql` is additive and follows the contacts foundation. It introduces `crm_notes`, `crm_opportunities`, `crm_tasks`, `crm_stage_events`, plus contact owner/version. All new tables enable RLS, revoke inherited client grants, and permit only required server-role operations; notes/history have no update/delete grants. Invoker trigger functions have no PUBLIC/anon/authenticated execute grant. Contact UPDATE is now intentionally permitted to service_role for the validated API; direct anon/authenticated contact access stays revoked.

All endpoints resolve current strict identity through `requireClientContext`, then require CRM capability. Members and coaches remain denied, including access by known UUID. Assignments are metadata and do not grant CRM access; assignees must currently be linked admin/owner accounts. Browser writes require matching Origin. Actor and identity fields cannot be supplied in workflow payloads. Responses are private/no-store, validation/database errors do not disclose internal details.

## Verification

Focused CRM run: 53 passing tests across six files (includes existing tests). New coverage executes both migrations in PGlite, as the restricted server role, verifies initial/changed stage history, optimistic conflicts, contact/task versioning, cross-contact task rejection, integer values, RLS fallback, revoked direct grants, immutable stage history, API role/Origin denials, actor injection rejection, nonexistent contacts, unauthorized assignees, duplicate creation conflicts and shared fixture compatibility. Final shared-tree run: all 208 tests across 39 files pass; TypeScript and focused CRM ESLint pass. Production build is owned by the parent integration pass.

The foundation-only integration fixture/workflow still applies only its original migration and asserts SELECT/INSERT-only contact server grants. It remains valid for that bounded foundation test; it does **not** verify this increment. Extend it with this second migration and revised grant assertions before claiming real PostgreSQL/PostgREST or hosted integration coverage.

## Remaining gates and bounded omissions

- Hosted stage does not yet exist/configuration access remains blocked per staging runbook. Apply/reconcile migrations only in an explicitly isolated environment; no root production-linked db push.
- Swift is source-reviewed and has a decoding test, but requires macOS CI/simulator compilation and authenticated device testing. No native success claim from Windows.
- Detail lists are bounded at 100 records per section with explicit `truncated`; older-history pagination and global pipeline/task queues are later work. Directory still paginates at 50.
- Task reassignment/due-date edits after creation, native opportunity assignment/value/next-action edits after creation, arbitrary pipeline configuration, tags, member linking, task reminders/push, reporting and messaging are not implemented here. Due tasks currently appear on contact detail; no background reminders run.
- No staged or production rollout authorized by this local increment. Re-run the full suite/type/lint/build plus hosted role matrix, real mutation/permission flow and native UI after integration.


## Retry recovery fix — October 17

Web workflow creates now retain their operation UUID across a lost response, 409, and failed display read. A conflict reconciles only against a persisted record with the same operation ID and matching submitted fields; unrelated conflicts do not clear the draft or generate a fresh operation. A successful POST acknowledges creation independently of a later display-refresh failure. Only that action's operation is completed; pending task/opportunity/note identities stay independent.

Native `CRMMutation` and `CRMCreationAttempt` helpers implement the same acknowledgement boundary and are wired into contact detail buttons. The iPhone now clears the acknowledged draft and rotates its ID after an accepted POST even when the next GET fails, while displaying a saved/refresh-failed message. A 409/read failure preserves the original ID; successful conflict reconciliation requires matching persisted fields. No blanket reset of all three native IDs remains.

Verification: 57 focused CRM tests across seven files pass, including four executable helper regressions for lost response → conflict → failed read → same-ID retry; different conflicting content; successful POST with failed refresh; and isolation of other pending operations. TypeScript and focused ESLint pass. Three async Swift XCTest regressions exercise the actual UI helpers for those acknowledgement/retry cases and unrelated-action identity isolation; they are added but not executed here because this Windows host has no Swift/Xcode runtime. No deployment, migration, message send or commit performed.
