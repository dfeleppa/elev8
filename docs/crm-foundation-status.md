# Elev8 CRM foundation status

October 17, 2026. Foundation [PR #85](https://github.com/dfeleppa/elev8/pull/85) and integration [PR #86](https://github.com/dfeleppa/elev8/pull/86) are merged. The inspected `main` revision is `64f7f25921028d9105dadde9bfb42aa0e752c57b`.

The current schema/identity/staging correction is local in isolated worktree `codex/crm-foundation-gate`. It has not been pushed, deployed or applied to a hosted database. No paid resource, production identity change, phone-routing change or message send was performed.

## Implemented foundation

- `/admin/crm`: admin/owner contact directory, bounded pagination, validated create form, loading/error/empty states and stable creation IDs for retries.
- `/api/v1/session`: canonical application ID, current database role and member/coaching/CRM capabilities.
- `/api/v1/crm/contacts`: authorized list/create, browser Origin checks and no-store responses. Members and coaches have no implicit CRM access.
- Additive contact migration: prospects remain separate from login accounts; direct client access is revoked; server privileges are SELECT/INSERT only.
- Unified native target `apps/ios/Elev8`: password login, session restore/sign-out, member/staff navigation and staff contacts, with shared OpenAPI/response contracts. Native training, booking, nutrition, chat and coaching features are not yet connected.

## Local correction in this worktree

- Shared exact-UID identity resolution now covers legacy member helpers and CRM. Email fallback, primary-key fallback, automatic account creation/linking and legacy bcrypt migration were removed.
- Google/Apple callbacks remain gated until a trusted provider-subject mapping is built. Signed bearer authentication methods must prove password sign-in; editable metadata cannot supply that proof. This deliberately changes legacy login behavior and needs staged rollout.
- New migration removes the Auth email-link trigger, replaces the SQL email-fallback resolver and narrows profile policies and column grants. It does not backfill or alter any identity rows.
- Read-only schema inventory and migration dispositions document 59 applied versus 65 local versions, four timestamp pairs and the missing September hardening. Root history must not be replayed blindly.
- Staging tools prepare a hash-reviewed allowlist and check environment fingerprints, project/origin separation, CLI configuration and cached database targets. The only execution wrapper is a guarded dry run.
- Regression tests reproduce the unsafe Auth trigger, prove exact identity and grants, cover legacy/OAuth denials and test staging target/tamper rejection. The disposable CI suite applies both new migrations, checks local security advisors, and adds profile RLS and Auth-update checks.

See [identity behavior and provider-subject design](crm-identity-access.md), [schema reconciliation](crm-schema-reconciliation.md), and the [staging runbook](crm-staging-verification.md).

## Verification evidence

| Check | Result and limit |
| --- | --- |
| Current local unit/PostgreSQL tests | 233 tests pass across 35 files on Windows and the isolated Linux runner, including PGlite execution of the actual identity migration. These bounded synthetic fixtures do not prove full schema replay. |
| Current local TypeScript/build | TypeScript and production build pass in the isolated Linux environment against real disposable Supabase services; no hosted credentials used. |
| Current local lint | No errors; four existing warnings. |
| Current real cookie/bearer integration | **13/13 passed** in temporary WSL2/Docker isolation; both CLI migrations, SQL privilege assertions, and security advisor checks passed. Containers, volumes and generated credentials were removed. [Sanitized local evidence](crm-evidence/2026-10-17-docker-integration.json). |
| Previous integration CI | [Run 39077107248](https://github.com/dfeleppa/elev8/actions/runs/39077107248) passed 11 tests at `d51f2d1`. The current branch has not been pushed or run in GitHub CI. |
| Previous Swift CI | [Run 39077107327](https://github.com/dfeleppa/elev8/actions/runs/39077107327) built the app/tests and passed three simulator contract tests at `d51f2d1`. Not rerun by this worktree. |
| Hosted schema replay and browser/native access | Open. No isolated stage has been provisioned, no production schema export restored, no real provider mapping or device test completed. |

## Current release gates

Production Supabase remains `ACTIVE_HEALTHY`, with 12 app users: three linked owners, six unlinked members and three unlinked coaches. No duplicate/orphan links were found, but all existing links still need ownership review because the installed Auth trigger can overwrite them. `crm_contacts` is absent. One legacy password-hash row needs an explicit recovery plan.

Vercel deployment `dpl_3dcbRaNe5UK82kFr9xJdpKiGPzDF` reports READY for `64f7f25`. CLI metadata access now works, superseding the earlier access-denied report. The current project's preview environment inherits production-scoped Supabase credentials and session/provider settings with no branch overrides. Do not push this branch into automatic previews before isolation is configured.

The Supabase organization is on Free and has two active projects (Elev8 and unrelated Planet Pooch). Neither is a staging target. Paid staging resources and all production changes remain on hold. A separate Vercel staging project, isolated database and reviewed schema-only baseline are required before hosted verification.

Next: authorized isolated hosted staging setup, full baseline replay, both migrations and repetition of the integration matrix on that host; then real identity ownership/recovery review and native authenticated/device checks. The disposable Docker gate is complete. Contact detail/edit, opportunities, messaging and Twilio routing remain separate work.
