# CRM staging verification

Current direction: the user explicitly chose main Supabase and authorized production deployment, superseding the staging-only authorization scope below. See `crm-main-rollout.md` for database evidence and `crm-staging-setup.md` for the unused separate Vercel project. Historical staging gates remain as prior evidence.

October 17, 2026. PRs #85 and #86 are merged at inspected `main` revision `64f7f25`. Local follow-up: `codex/crm-foundation-gate`. No hosted migration, identity repair, paid provisioning, production deployment, Twilio routing or real message send is authorized by these instructions.

## Resource evidence

| Resource | Read-only finding | Disposition |
| --- | --- | --- |
| Supabase `scghaxpgsibpffbukyws` | Healthy Elev8 production; 59 ledger entries; 12 app users; three linked owners; six unlinked members; three unlinked coaches; zero duplicate/orphan links; no contacts table | Never a test-write target. Identity ownership is not established by the counts. |
| Supabase organization | Free plan with two active projects, Elev8 and unrelated Planet Pooch `gxhdklnqyxvcahngljcx`; prior branch request rejected for requiring Pro | Neither project may be reused for staging. Paid resources remain on hold. |
| Vercel `daneff` | `prj_h7KHFmz7Nb7nsRBNFLlQ2o8kHDAV`, team `team_XV7wURqwcMBKoaj3Gpj8cY47`; READY deployment `dpl_3dcbRaNe5UK82kFr9xJdpKiGPzDF` at `64f7f25` | Build readiness, not database compatibility. |
| Vercel environment | Connector metadata returned 403, but authenticated CLI inspection now succeeds. Supabase URL/keys, NextAuth secret/URL and provider settings are scoped to production + preview; no branch overrides found | Existing previews inherit production credentials. No branch push/deployment until isolated configuration is established. |
| Local runtime | Supabase CLI 2.98.2; root tracked CLI cache targets production. The expanded tests passed using a temporary Ubuntu/WSL2 environment with Docker Engine 29.1.3, Node 22.23.3 and psql 16.15 | Never use root `db push`. Test source excluded the root CLI cache and environment files. The temporary distro is stopped; removal was blocked by automatic approval review. |
| Native | Mac CI previously passed build/contracts; current worktree changes no Swift files | Native hosted auth, physical device and signing evidence remain separate gates. |

See [schema reconciliation](crm-schema-reconciliation.md) for the actual migration classifications and baseline limitations. Production inspection was read-only; no ledger repair or identity mutation occurred.

## Local checks completed

233 unit/PostgreSQL tests across 35 files pass on Windows and the isolated Linux runner, including the unsafe-trigger reproduction, exact-UID and signed-AMR requirements, duplicate/null-role denial, column-grant revocation, transactional dependency failure and staging guard rejection cases. TypeScript and the production build pass. The latest build used the real disposable Supabase stack and disabled provider placeholders. Lint has zero errors and four existing warnings.

The expanded **13/13 integration tests passed locally in 6.4 seconds** on October 17. Both migrations were applied by CLI to the synthetic fixture; SQL policy/grant assertions passed; local security advisors reported no warnings/errors. The runner stopped all five test containers, removed their volumes and deleted generated credentials. No application defect was found. An initial unit run in the temporary copy lacked shared contract fixtures; copying `packages/contracts` corrected that setup omission and the complete 233-test rerun passed. See [sanitized evidence and tested file hashes](crm-evidence/2026-10-17-docker-integration.json). No raw service credentials or browser sessions are stored in that artifact.

Cleanup limitation: automatic approval review rejected the combined temporary-distro unregister/runtime-directory removal command with `blocked by policy`, without a more specific reason. `CodexElev8CrmIntegration` was instead terminated and verified Stopped. Its ignored files remain under this worktree's `.codex-crm-runtime/`; no test services are running. Removal requires a later user-controlled cleanup. The retained runtime is not part of the commit.

The [previous integration run](https://github.com/dfeleppa/elev8/actions/runs/39077107248) passed 11 real-cookie/bearer tests at `d51f2d1`. The [previous web/Swift run](https://github.com/dfeleppa/elev8/actions/runs/39077107327) passed 161 web tests and three simulator contract tests at that code revision. These are historical evidence, not results for this local correction. No skipped check is counted as a pass.

## Disposable integration matrix

`.github/workflows/crm-integration.yml` applies contact creation, contact editing and identity migrations using Supabase CLI to the bounded `tests/crm/bootstrap.sql` fixture, checks local security advisors, then runs 17 tests with real Auth, PostgREST, browser cookies and PostgreSQL. Added checks cover direct profile self-read, private-column/write denial, missing/ambiguous links through SQL RLS, and Auth updates that must not claim an unlinked app user. Existing coverage includes member/coach denial, admin/owner persistence, canonical IDs, metadata forgery, invalid bearer precedence, Origin validation, duplicate IDs, refresh, role change, sign-out and pagination.

This fixture deliberately permits duplicate UID links to test fail-closed behavior. The separate PGlite fixture models production's unique constraint and nullable role. Neither fixture is a full production schema clone. Test accounts and contacts are synthetic; Auth admin creation does not send email. Credentials stay in disposable local files/memory; traces, videos and screenshots remain disabled.

On a machine with Docker, Node 22 and psql, in a clean checkout without provider credentials:

```sh
npm ci
npx playwright install --with-deps chromium
npx supabase start --workdir tests/crm -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
export PGPASSWORD=postgres
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/crm/bootstrap.sql
mkdir -p tests/crm/supabase/migrations
cp supabase/migrations/20261017114730_crm_contacts_foundation.sql tests/crm/supabase/migrations/
cp supabase/migrations/20261017232622_crm_contact_edit.sql tests/crm/supabase/migrations/
cp supabase/migrations/20261017233030_trusted_identity_boundary.sql tests/crm/supabase/migrations/
npx supabase db push --local --workdir tests/crm
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/crm/assert-schema.sql
npx supabase db advisors --local --workdir tests/crm --type security --level warn --fail-on error
npx supabase status --workdir tests/crm --output json > .codex-crm-status.json
node tests/crm/configure.mjs
node tests/crm/build.mjs
npx playwright test --config playwright.crm.config.ts
npx supabase stop --workdir tests/crm --no-backup
```

The password above is only the disposable loopback database default. Always destroy the stack and generated `.codex-crm.env`/`.codex-crm-status.json`, including on test failure. Before another clean run remove only the three generated migration copies in `tests/crm/supabase/migrations`; the fixture must precede those migrations. The CI cleanup runs even on failure. This command sequence passed in the temporary WSL2 environment; GitHub CI has not run the unpushed branch.

## Guarded hosted preparation, after resource authorization

These tools do not provision resources or deploy the application. No valid staging manifest or baseline exists yet. Preparation is local and reversible; the execution wrapper supports only `db push --linked --dry-run`.

1. Obtain an explicitly approved, separate staging Supabase project and Vercel project. Verify account/project ownership. Use a distinct HTTPS app origin. Keep production and Planet Pooch excluded. Do not inherit the current project's preview variables.
2. Follow the reviewed schema-only export/bootstrap procedure in [schema reconciliation](crm-schema-reconciliation.md). Keep raw exports and actual staging manifests under ignored `.codex-crm-schema/`. Do not copy root `.temp`, credentials or migration history into the staging bundle.
3. Fill [manifest.example.json](../scripts/crm-staging/manifest.example.json) with named/dated review, stage project/origin, baseline hash, exact three-migration CRM allowlist and SHA-256 fingerprints of three independently created stage credentials. Fingerprints are not ownership proof; verify their source separately. Never put secret values in the manifest or logs. Hash exact local file bytes; refresh hashes and review if line endings/content change.
4. Run local preparation:

```powershell
node scripts/crm-staging/prepare.mjs .codex-crm-schema/reviewed-manifest.json reviewed-stage
```

This creates `.codex-crm-staging/reviewed-stage` with a minimal CLI configuration, seeds disabled, reviewed baseline and allowlisted migrations. It rejects existing destinations, escaped/symlinked input paths and changed hashes. It neither links nor writes a database.

5. Only after verifying the approved target, link that generated CLI directory explicitly to the staging ref. Do not copy or edit a production cache to masquerade as staging. Complete the separately reviewed baseline restore before running the pending-migration check. Record the baseline bootstrap independently; do not import production ledger rows or use `migration repair`.
6. Supply `CRM_SUPABASE_CLI` as an absolute native `supabase.exe`/`supabase` executable path. Provide stage credentials securely, then run:

```powershell
node scripts/crm-staging/dry-run.mjs .codex-crm-staging/reviewed-stage
```

The wrapper rechecks the baseline/migration hashes, exact file set, fixed CLI config, linked ref, cached project metadata and direct/pooler URL. The username/host must identify the same stage and use session port 5432. It runs in the generated directory with a minimal child environment, no shell and the literal `--dry-run` flag. A missing/different cache format fails closed. It cannot apply, repair, reset or seed. A dry run lists pending migrations; it does not execute SQL or prove schema compatibility.

7. Before any staging build/deploy, load only staging environment values securely and invoke:

```powershell
node scripts/crm-staging/check-environment.mjs .codex-crm-schema/reviewed-manifest.json
```

Required: exact stage Supabase URL, stage public/server credentials matching reviewed fingerprints, independent NextAuth secret, exact `NEXTAUTH_URL`, and distinct `VERCEL_PROJECT_ID`. Use literal `disabled-in-crm-staging` for both Google OAuth variables because the current auth module requires their presence while OAuth is gated. Omit Apple, messaging/provider, cron, agent, direct database and development-bypass credentials. The check rejects unexpected inherited values without printing them.

These checks are explicit preflight commands; they are not globally attached to every root build or Vercel deployment. The future separate staging project's build/deploy job must invoke them, and runtime/browser bundle targets must be verified independently before test writes. A matching manifest cannot prove that a secret was issued by the correct project or that an existing deployment uses it.

## Remaining release evidence

After authorization of hosted staging, restore the reviewed baseline, inspect the guarded allowlisted migration dry run, apply through the explicitly targeted CLI, and record schema/ledger/grant evidence. Do not seed users or expose the baseline before the identity migration removes the unsafe trigger. Seed only synthetic member/coach/admin/owner accounts and use the returned Auth UID for each explicit app-user link; choose distinct app IDs.

Then repeat the authenticated browser/REST/bearer/refresh matrix on that host, verify deployed server/browser database targets and disabled outbound integrations, and test access through deployment protection. Audit all three existing real links and plan recovery for the nine unlinked users and legacy password record before proposing production rollout. Do not infer ownership from email.

Google/Apple support remains gated on the [provider-subject design and test matrix](crm-identity-access.md). Native authenticated UI, restore/foreground, role changes, sign-out, physical-device persistence and network recovery still need a Mac/device against the same isolated backend. Paid resources, production changes and real messaging remain on hold.
