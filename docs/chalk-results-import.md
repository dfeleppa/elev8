# Chalk It Pro tracking foundation

The authenticated `/member/workout/import` page previews a CSV or ZIP export in the browser. The existing member launch gate still applies. The staff menu's **Preview Chalk It Pro Results** action opens it instead of immediately writing through the legacy import endpoint.

## Implemented

- Versioned typed import contract in `src/lib/chalk-results.ts`, preserving raw fields and unknown columns.
- CSV parsing with escaped quotes, multiline notes, Unicode, strict dates and typed load/time/reps/rounds/distance scores.
- ZIP reader, 5 MB compressed/expanded size limits, and 10,000-result limit.
- Explicit export-wide units; Rx remains unknown. Review flags for 1990/future/invalid dates, unsupported scores, duplicate candidates, and special categories.
- Search, pagination, review-only filter, and best imported loads grouped by movement and rep count. Questionable rows are excluded from the lift summary.
- Downloadable review JSON with original CSV, file SHA-256, parser version, normalized rows, and selected units. Downloading does not constitute a database import.

## Database integration contract

No database migration or persistence is included in this first slice. Before enabling a save action:

1. Introduce member-owned import batches and raw import rows, keeping source values separate from corrections and recording parser version/file hash.
2. Enforce exact-file idempotency by member/source/hash and review overlapping row fingerprints without silently dropping repeated efforts.
3. Persist normalized lift efforts and workout results with explicit units, nullable Rx, date review status, and import provenance. Imported best efforts must not be presented as complete set logs.
4. Reuse movement/result entities. Historical imports must not fabricate shared programming blocks. Keep habits, body measurements, and aggregate totals out of lift PR and workout consistency calculations.
5. Authorize through the existing NextAuth member context. Validate ownership server-side and apply RLS/grants matching the actual deployed identity model.
6. Save each result and dependent records atomically, support batch-scoped retry/undo, and recompute affected PRs after corrections/deletions. Never trust client-generated preview JSON as validated input.

The legacy API and CLI remain in the repository and are not safe substitutes for this pending workflow. The CLI's dry-run currently performs user/membership writes; its organization fields predate the single-tenant migration. The API assumes Rx and does not provide persistent duplicate protection. Neither is called by this preview.

## Validation

Run `npm test -- src/lib/chalk-results.test.ts`, `npx tsc --noEmit`, and scoped ESLint. Nine committed tests cover score parsing, source preservation, date/category review, duplicates, malformed files, ZIP handling, and size limits. The private user export is not committed as a fixture.

The September 17, 2026 source export was separately checked: 170 rows (70 Load, 36 Time, 53 Reps, 5 Rounds, 6 Distance), 47 suspicious dates, 40 habit records, one body measurement, and two aggregate scores. With lb/m chosen solely for test coverage, 50 rows require review. Actual user units still require confirmation.

Browser validation uses an isolated component harness; it does not establish authenticated production-route or deployed-database behavior.
