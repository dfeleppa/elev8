# CRM schema reconciliation

Inspection date: October 17, 2026. Source checkout: `64f7f25921028d9105dadde9bfb42aa0e752c57b`. Changes are local on `codex/crm-foundation-gate`; production was inspected read-only.

## Evidence and disposition

[Production inventory](crm-evidence/2026-10-17-production-inventory.json) records 59 migration ledger entries, 76 application tables, 8 application functions, 2 application-owned triggers, constraints, RLS policies, indexes, grants, column grants, default privileges and extension versions. It includes the application trigger attached to managed `auth.users`. The query is [inventory.sql](../scripts/crm-staging/inventory.sql).

The inventory contains metadata and definition hashes, not user rows, credentials, function bodies or restorable DDL. It does not inventory every view/type/sequence definition, schema owner/ACL, storage object, Auth setting or scheduled job. It cannot establish full schema parity by itself. SQL hashes are useful for drift detection, not proof of equivalent semantics.

[Reconciliation output](crm-evidence/2026-10-17-reconciliation.json) compares 65 local migrations (including the proposed identity correction) with the 59 applied versions: 54 same-version entries, four timestamp pairs, seven local-only entries and one remote-only entry. Raw local-file SHA-256 and concatenated ledger-statement SHA-256 differ even for comment/line-ending/statement-boundary changes; `byteMatch: false` is not a substantive-change classification.

### Timestamp pairs reviewed

The actual applied statements were read from the ledger and compared with these local files. Each pair contains the same substantive DDL/DML statements; comments and, for the first two, transaction wrappers differ. This review does not prove past data effects or certify the complete schema. Keep the original filenames and production ledger unchanged.

| Local version | Applied version | Migration | Disposition |
| --- | --- | --- | --- |
| `20260529000000` | `20260529085711` | `drop_orphaned_organization_tables` | Eight legacy tables absent in inventory. Capture current schema; do not replay DROP statements. |
| `20260529010000` | `20260529090402` | `payroll_entries_staff_user_fk` | FK, required `staff_user_id` and index present; `staff_name` absent. Do not rerun personal-data seed/backfill. |
| `20260529120000` | `20260529111336` | `nutrition_check_in_history` | Six added columns and outcome/source constraints present. Preserve their current definitions in baseline. |
| `20260604061000` | `20260819013312` | `mcp_oauth_used_tokens` | Table, check constraint and expiry index present. Preserve schema only, never token rows. |

### Other differences

| Version | Finding | Staging disposition |
| --- | --- | --- |
| `20260902010824` remote only | `harden_mobile_app_user_access` installed private SECURITY DEFINER resolvers, invoker wrappers and profile-column SELECT grants. Resolver still accepts confirmed matching email; dangerous Auth trigger remains separately installed. | Capture actual state in reviewed baseline. New `20261017233030` correction removes the email fallback and trigger. Do not add a backdated migration to root or repair production history. |
| `20260514120000` local only | Nutrition macro recomposition is a data update; ledger absence does not prove data state. | Exclude. Separate feature/data reconciliation. |
| `20260527004140` local only | `web_chat_threads_v1` tables absent. | Exclude. Separate chat feature reconciliation. |
| `20260530120000` local only | Fiber-goal migration updates data. | Exclude. Separate nutrition review. |
| `20260608190000` local only | `member_metabolism_learning` table absent. | Exclude. Separate nutrition schema review. |
| `20260713133813` local only | Stripe removal migration would drop four tables that still exist. | Exclude; no billing cleanup or data deletion in CRM staging setup. |
| `20261017114730` local only | `crm_contacts` and its ledger version are absent. | Explicit pending contact migration for staging after baseline review. |
| `20261017233030` local only | Proposed trusted identity boundary, created through Supabase CLI in this worktree. | Explicit pending identity migration for staging. No account links/backfill. |

The 54 same-version entries have not all had their full SQL and data effects audited. No assertion of clean historical replay is made. Never run the root migration directory against production or a fresh stage as part of this gate.

## Baseline workflow after a staging target is authorized

1. Capture a fresh, read-only schema-only export using a compatible `pg_dump`/Supabase CLI. Include application schemas `public`, `private` and `programming`, their dependencies, types, views, sequences, constraints, grants, policies, functions and application-owned triggers on managed Auth tables. A default public-schema dump misses the private identity functions and Auth trigger. Preserve the managed Supabase schemas provided by the target stack; do not restore production Auth internals over them.
2. Keep raw exports in ignored `.codex-crm-schema/` until reviewed. Inspect function definitions/defaults for embedded credentials, URLs or provider calls. Exclude all rows, Auth identities, migration-ledger rows, storage contents, job/cron schedules, webhook registrations and outbound queues. Never include historical personal-data seeds. Record deliberate environment substitutions. Review any psql-only directives before selecting a CLI import command.
3. Save the reviewed schema-only baseline and its SHA-256. Create a named, dated manifest from [manifest.example.json](../scripts/crm-staging/manifest.example.json). The example intentionally cannot pass validation. Record the separate staging Supabase ref, separate Vercel project/origin, exact credential fingerprints, and the reviewed pending migration hashes.
4. Prepare the local bundle with `prepare.mjs` as described in the [staging runbook](crm-staging-verification.md). Its migration directory contains only the explicitly approved pending files; `baseline.sql` is separate. It copies no root CLI cache, credentials, seeds or historical migration ledger.
5. In the approved empty stage, restore the baseline through a separately reviewed, explicitly targeted CLI operation. Record that bootstrap independently of the historical production ledger. Compare fresh metadata inventories and review full schema exports. Do not mark old versions applied with `migration repair`. Do not seed accounts or expose the stage while the unsafe baseline identity trigger exists.
6. Verify the guarded dry run lists exactly the approved pending migrations. Review and apply them to staging only through CLI after the stage target and bootstrap are verified. Capture post-application catalog/ledger evidence. Expected differences include the new contacts table and grants, removed Auth trigger/function, strict identity functions and policy/column grants. Record every additional difference instead of blindly demanding equality with the intentionally unsafe source.
7. Seed synthetic Auth/app users only after hardening. Run the browser, REST, bearer, refresh and native matrices. No production rollout or identity repair is authorized by this runbook.

Useful local read-only commands:

```powershell
node scripts/crm-staging/reconcile.mjs docs/crm-evidence/2026-10-17-production-inventory.json supabase/migrations
node scripts/crm-staging/compare-inventory.mjs docs/crm-evidence/2026-10-17-production-inventory.json .codex-crm-schema/stage-inventory.json
```

`compare-inventory.mjs` rejects missing sections and exits nonzero on captured metadata differences. A zero exit means only those captured sections match, not full database parity. Full production schema export, restoration and hosted replay remain unperformed; no isolated hosted stage is approved. The expanded 13-test Docker matrix and both migrations passed in temporary WSL2 isolation ([evidence](crm-evidence/2026-10-17-docker-integration.json)). Those synthetic bounded fixtures never substitute for the full baseline.

Main integration follow-up: PRs #87 and #88 added contact editing and booking migrations after this historical inventory was captured. The CRM example allowlist now includes contact editing; booking remains a separate staging feature. The merged source passed 17 CRM and 16 booking Docker integration tests plus 328 unit/SQL tests. The saved production inventory and reconciliation report remain dated evidence, not a claim of a new hosted inspection.
