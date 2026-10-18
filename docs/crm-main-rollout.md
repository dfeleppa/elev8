# Main Supabase migration rollout

October 17, 2026. The user explicitly directed work on the main Supabase database instead of separate staging.

Target: Elev8, project `scghaxpgsibpffbukyws`. No Vercel application deployment was performed in this step.

## Applied

Through Supabase CLI, in dependency order:

- `20261017114730_crm_contacts_foundation`
- `20261018000955_crm_sales_workflow`
- `20261018001214_member_reservation_capacity_guard`
- `20261018001310_crm_messaging_outbox` (including late-acceptance fix)

These files are now applied history: future corrections require new migrations, not edits to these files.

The CLI used ignored work directory `.codex-main-supabase`, explicitly linked to the main project. `migration fetch` retrieved the actual applied history into that isolated directory; only the four reviewed local files were added. The dry run listed precisely those four files. Historical differences in the root migration folder were not replayed or repaired. A second dry run after application reported the remote database up to date for this bounded deployment directory.

## Verified on main

- Existing user, class and reservation columns were compatible; no CRM objects or competing triggers existed beforehand.
- All four versions are recorded in the remote migration ledger.
- All nine CRM tables have RLS enabled; anonymous/authenticated roles have no CRM table grants or CRM/booking function execution privileges.
- `scripts/crm-main-verify.sql` passed using `service_role` inside an explicitly rolled-back transaction: contact version updates, opportunity stage history, notes/tasks, late SMS acceptance, STOP suppression, duplicate reservation rejection and capacity rejection.
- Final read-back: all new CRM tables empty, no synthetic class left, zero reservations (matching preflight), twelve existing app users unchanged. No Auth account or identity link was changed.
- No actual provider sends, phone-routing changes, jobs or webhook activation occurred.

The smoke check uses sequential operations; it does not establish multi-connection race behavior or browser/native end-to-end behavior. The prior local suite passed 236 tests plus four audit tests; TypeScript, lint and build passed. The newly deployed database does not mean the uncommitted web/native source is deployed.

## Advisor output and remaining work

Security advisors reported informational RLS-without-policy notices, including the new API-only tables. Their direct client grants are intentionally revoked. The advisor also reported leaked-password protection disabled; this auth configuration was not changed. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Remaining: commit/release the reviewed application changes, run authenticated web flows and macOS/iPhone validation, prove concurrent booking/worker scenarios, and complete trusted identity mapping before member rollout. Twilio and its worker remain inactive. The separately created `elev8-staging` Vercel project remains unused; no staging Supabase project exists.
