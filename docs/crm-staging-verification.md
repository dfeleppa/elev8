# Contacts staging verification

**Current direction:** the user subsequently chose the main Supabase database. The four new migrations were applied and verified there; see [main rollout evidence](crm-main-rollout.md). Staging requirements and absent-table observations below are historical, not the current deployment status.

## Current staging unblock checklist

**Latest provisioning result:** see [separate staging setup](crm-staging-setup.md). Vercel `elev8-staging` now exists, scoped CLI environment access works, and independent auth-secret/disabled-SMS settings are configured. Supabase creation was attempted in the user-selected organization and rejected by the two-active-free-project limit. The Vercel-access blocker described below is historical and has been resolved through the CLI.

The October 17 follow-up rechecked the connected project and branch inventory: only production Elev8 and the unrelated Planet Pooch project are available; Elev8 still has only its default `main` branch (`MIGRATIONS_FAILED`). Production health is not proof of an isolated test environment. Vercel configuration access has not been rechecked; its previously recorded denial remains unresolved.

Required access and setup, in dependency order:

1. **Isolated Supabase target:** provide a dedicated staging project accessible through the connected account, or explicitly approve a paid branching option. Record a distinct project reference and securely provision its CLI/database credentials. Do not use the production-linked root CLI directory for staging writes.
2. **Vercel configuration access:** restore access to project `daneff` in its owning team, including environment configuration and deployment access, or provide an isolated staging project. Set staging-only database credentials, a separate NextAuth secret, and a reachable HTTPS application URL. Keep production provider/cron credentials out. Credentials belong in the platform's secure configuration, not chat or committed files.
3. **Reviewed schema baseline:** resolve the four timestamp/name discrepancies and recovered September access-policy migration described below. Build a schema-only baseline without historical user data/seeding, then apply the intended CRM, booking-capacity and SMS migrations to staging. Do not blindly replay local-only historical migrations or repair production's ledger.
4. **Synthetic identities:** create member, coach, admin and owner test accounts with explicitly linked Auth UIDs and distinct app IDs. The nine real unlinked accounts need separate trusted review before member rollout; fixing production accounts is not a prerequisite for synthetic staging tests. Password-based verification can proceed while trusted OAuth mapping remains a separate gate.
5. **Expanded verification:** the current disposable integration workflow still installs only the contacts foundation and asserts SELECT/INSERT-only contact grants. Extend its schema and assertions for sales-workflow UPDATE permission, member bookings and SMS before claiming coverage of those increments. Prove last-spot booking races and worker recovery using separate PostgreSQL connections. Repeat the cookie/bearer access matrix against the hosted staging URL.
6. **Native validation:** run the updated Swift build/tests on macOS, then authenticated simulator tests against staging. A signing team, bundle/profile and physical iPhone are additionally needed for device validation. Twilio credentials, test number and approved recipients are needed later for actual messaging; they do not block the initial CRM/member staging setup.

No infrastructure, credentials, identities, migrations or routing were changed by this checklist.

October 17, 2026. Foundation PR #85 is merged as `f00b8a1`. This follow-up does not authorize or perform a production migration, identity repair, Twilio routing change, or real message send.

## Discovered resources and blockers

| Resource | Evidence | Consequence |
| --- | --- | --- |
| Supabase `scghaxpgsibpffbukyws` | `elev8`, ACTIVE_HEALTHY; 12 users; 3 linked owners; 6 unlinked members; 3 unlinked coaches; zero duplicate and orphan links; no contacts table | Production is not a test target. Nine identities still need trusted review. |
| Supabase branches | Only default `main`, status `MIGRATIONS_FAILED` | No isolated hosted staging exists. |
| Branch creation | `crm-staging-verification` request rejected: branching supported only on Pro or above | No resource created or plan upgraded. Need an approved separate staging project or Pro branching before hosted verification. |
| Vercel | `daneff`, `prj_h7KHFmz7Nb7nsRBNFLlQ2o8kHDAV`, team `team_XV7wURqwcMBKoaj3Gpj8cY47`; production `dpl_8wkwntm15WhkVPLE2G6G9xZ3yLo5` READY at `f00b8a1` | Deployment status proves build readiness only. Contact migration is absent in production. |
| Vercel configuration | Environment metadata 403; CLI fallback: no access to specified account; custom-environment lookup 404 | Cannot establish preview database isolation or securely configure hosted staging. Do not use existing previews for test writes. |
| Local runtime | No `.env.local` or staging env values; Supabase CLI 2.98.2 authenticated and linked to production; Docker absent | Never run root `db push`. Integration runs in GitHub's disposable Docker runner. |
| GitHub | Preview, Production, copilot environment names; no repository or Preview/Production environment secrets listed | Environment names alone do not establish staging resources. |

The production migration ledger is not a clean match to the repository: several May migrations have different applied timestamps; a September `harden_mobile_app_user_access` entry has no corresponding local migration; some later local migrations are absent from the ledger. Replaying the entire historical chain against a new database is not established. Do not repair production history to make a staging command pass.

A second read-only prerequisite check confirmed `app_users.id` is a UUID primary key, `supabase_auth_uid` is nullable UUID, and email/name/role/password hash are text. Production role and updated-at fields are nullable, unlike parts of the bounded fixture; unknown/null roles fail closed in the new resolver. Both `crm_contacts` and migration version `20261017114730` were still absent. This is a compatibility prerequisite check, not schema-parity evidence.

## Isolated integration environment

`.github/workflows/crm-integration.yml` starts a disposable Supabase stack with a distinct project ID, real Auth, PostgREST and PostgreSQL 17. It bootstraps `tests/crm/bootstrap.sql`, then uses `supabase db push --local --workdir tests/crm` to apply an exact copy of the production contact migration. The fixture models only identity and sidebar dependencies; this does **not** prove historical migration replay, production schema parity, hosted TLS or OAuth configuration.

No production data is copied. Six synthetic Auth accounts use randomized passwords and `example.invalid` addresses. Each linked fixture uses the UID returned by Auth creation, with a different application ID. Missing and duplicate links are deliberate negative fixtures. Test `user_metadata.role=owner` must never affect authorization. Tests create contacts, verify persistence and actor IDs, and temporarily demote only a synthetic owner. The entire stack and generated credentials are destroyed at job completion. Traces, videos and screenshots are disabled to avoid storing test sessions.

To reproduce on a machine with Docker, Node 22 and `psql`:

```sh
npm ci
npx playwright install --with-deps chromium
npx supabase start --workdir tests/crm -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
# Loopback disposable PostgreSQL credentials only:
export PGPASSWORD=postgres
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/crm/bootstrap.sql
mkdir -p tests/crm/supabase/migrations
cp supabase/migrations/20261017114730_crm_contacts_foundation.sql tests/crm/supabase/migrations/
npx supabase db push --local --workdir tests/crm
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/crm/assert-schema.sql
npx supabase status --workdir tests/crm --output json > .codex-crm-status.json
node tests/crm/configure.mjs
node tests/crm/build.mjs
npx playwright test --config playwright.crm.config.ts
npx supabase stop --workdir tests/crm --no-backup
```

Use a clean checkout without `.env.local`/provider credentials; the config rejects external API URLs and `DEV_AUTH_EMAIL`. On subsequent runs remove only the generated `tests/crm/supabase/migrations/20261017114730_crm_contacts_foundation.sql` before starting a fresh stack (the fixture must precede it). Delete `.codex-crm.env` and `.codex-crm-status.json` after stopping. Do not upload these files or test storage state as artifacts.

## Identity and permission changes

Versioned web APIs and the CRM page require `verifiedAuthUid` from a server-issued password session and resolve exactly one `app_users.supabase_auth_uid` row. Bearer requests validate the token with Auth and use the same lookup. Neither path searches by email, writes an identity link, creates a user, or trusts metadata roles. Roles are read from the database on each call. Invalid Authorization never falls back to cookies.

Existing email-only sessions must sign in again using a linked account's password. **Google/Apple OAuth-only users cannot use CRM yet.** Their provider subjects need a trusted explicit mapping and an end-to-end OAuth test before enabling that path. An email match or the legacy OAuth helper's returned ID is not identity proof. Existing legacy registration, OAuth and member endpoints still contain email-based behavior; they are outside this bounded change and remain an identity rollout gate. Do not exercise those legacy claim flows with real identities during staging setup.

Password login previously used the shared service-role client, which can retain a user's access token for later database calls. It now uses a fresh nonpersistent client per attempt. The contact migration also revokes inherited service-role privileges before SELECT/INSERT, because GRANT alone cannot narrow Supabase's default privileges. The migration was amended before deployment; production inspection confirmed the table and migration were absent. If another environment already applied the earlier file, review a separate corrective migration there rather than silently editing its history.

## Evidence matrix

| Check | Current evidence |
| --- | --- |
| Web/backend unit and SQL tests | 161 tests pass locally; TypeScript passes; lint has no errors and four existing warnings |
| Web and Swift CI | [Run 39077107327](https://github.com/dfeleppa/elev8/actions/runs/39077107327), code `d51f2d1`: 161 web/unit tests, type check, lint and build; Swift application/test compilation and three simulator contract tests passed |
| Real cookie + bearer role matrix, browser create/list, REST denials, refresh, role change, web sign-out, pagination | **11/11 passed**, [run 39077107248](https://github.com/dfeleppa/elev8/actions/runs/39077107248), code `d51f2d1`; CLI migration and SQL assertions passed; production build passed; stack cleanup passed |
| Hosted staging migration and schema compatibility | Blocked on an isolated project and reconciled schema baseline |
| Hosted browser login and protected-preview connectivity | Blocked on staging configuration access and deployment |
| Native authenticated UI, session restore/foreground, sign-out, role switching | Requires Mac/simulator against hosted staging; HTTP bearer tests do not prove Swift UI behavior |
| Physical iPhone | Signing team/bundle/profile, device, reachable staging URL; prove Keychain persistence, background/foreground and network recovery |

The passing run created all fixture identities via real Auth and proved that their canonical app IDs differ from their Auth UIDs while matching across web/mobile paths. Both admin and owner created contacts through Chromium and saw them after reload; database checks confirmed actor IDs and unchanged app-user counts. Members/coaches failed direct reads/writes and CRM page access. Missing/ambiguous links remained unchanged. Editable metadata did not confer a role. An invalid or lower-privilege bearer header did not inherit a privileged cookie. Contact REST reads/inserts failed for anon/member/admin/owner tokens, and even the server role could not update/delete. Browser Origin, forged actor IDs, duplicate creation IDs, refresh, current database roles and cursor pagination all passed.

Early runs exposed test infrastructure issues (Node worker `--env-file` propagation and the CLI email-provider toggle); both were fixed and the full suite rerun successfully. No skipped check is counted as a pass. Unit/SQL tests also model inherited Supabase default privileges so the grant regression is covered outside the end-to-end suite.

## Hosted staging procedure and remaining gates

1. Establish a dedicated staging Supabase project or approved Pro branch; record its distinct reference. Obtain CLI access and a staging database password securely. Keep the root checkout's production link untouched; use an isolated CLI work directory with an explicit staging target.
2. Reconcile the schema-only baseline and migration ledger read-only. Review the missing/renamed migration history before replay; do not copy real user data, Auth identities, provider credentials, scheduled jobs, webhooks or outbound queues. Verify that a fresh staging baseline replays successfully.
3. Inventory stage table columns/constraints and migration history. Run CLI `db push --dry-run` for the explicit stage target and require the reviewed pending set to contain only intended migrations. Apply using CLI, then record the ledger, RLS, constraints and table grants. Never use the production reference.
4. Provision synthetic member, coach, admin and owner Auth users without sending email. Link only the UID returned by each synthetic creation to its explicitly created app user. Give each a different app ID. Audit missing, duplicate and orphan links. Keep real member link review separate, using verified account ownership evidence and an audit trail.
5. Configure stage-only database keys, an independent NextAuth secret, canonical stage URL and authentication settings through authorized Vercel configuration access. Remove provider/cron/agent credentials from this environment. Confirm deployment protection access for the test browser and iPhone. Verify the deployed app actually points to the stage database before any write.
6. Repeat the integration matrix on that hosted stage and capture sanitized deployment/commit IDs and outcomes. Add Google/Apple provider-subject mapping tests before claiming OAuth parity. Run native UI tests for both staff and member modes; device evidence is separate from the HTTP bearer path.
7. Only after this gate: contact detail/edit and opportunities; native schedule/booking progresses alongside CRM in the same Swift app. Twilio remains the provider, with no LC Phone migration. Real messaging and number routing belong to a later explicit milestone.

References: [Supabase environment and migration process](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase CI testing](https://supabase.com/docs/guides/deployment/ci/testing), [Playwright CI setup](https://playwright.dev/docs/ci-intro). Current Supabase changelog reviewed; the announced November TLS cipher retirement is a device compatibility check, not a reason to alter identity or database settings here.

## Read-only prerequisite refresh — October 17, 2026, 8:11 p.m. Eastern

The connected Supabase inventory still exposes only production Elev8 and the unrelated Planet Pooch project. Elev8's only branch is default `main`, still `MIGRATIONS_FAILED`. No isolated hosted test target is available through this connection. No branch creation, plan upgrade, migration, account mutation, deployment, or message send was attempted during this refresh. The earlier Vercel access failure was not retested and remains an unresolved prerequisite.

The exact sanitized database inventory is committed as `docs/crm-staging-inventory.json`, captured at `2026-10-18T00:11:29.92129Z`. It contains schema/ledger metadata and aggregate counts, with no user rows, account IDs, emails, hashes, provider subjects, keys or tokens. A reusable read-only query lives at `scripts/crm-staging-inventory.sql`. Run it against the explicitly selected project through an authenticated SQL console/MCP, extract the returned `inventory` object, and add the actual `project_ref` from that selected target; do not infer a target from an environment filename.

```sh
node scripts/crm-staging-audit.mjs docs/crm-staging-inventory.json
node --test scripts/crm-staging-audit.test.mjs
```

The audit reads local SQL filenames and the supplied JSON only. It makes no network requests or database changes. Exit `2` means unresolved prerequisites, `1` means invalid input. Even an inventory without reported issues cannot establish isolation, applied SQL parity, trusted OAuth ownership, deployed browser access, or native/device behavior. The four audit regression tests also run in the disposable CRM integration workflow.

The production ledger contains 59 entries. Against the current checkout, 54 version/name pairs match; matching names do not establish SQL equivalence. Four apparent timestamp changes require individual review:

| Migration name | Local version | Applied version | Recorded statement evidence |
| --- | --- | --- | --- |
| `drop_orphaned_organization_tables` | `20260529000000` | `20260529085711` | Text differs after line-ending/outer-whitespace normalization |
| `payroll_entries_staff_user_fk` | `20260529010000` | `20260529090402` | Text differs; includes historical data seeding, so do not replay it into synthetic staging |
| `nutrition_check_in_history` | `20260529120000` | `20260529111336` | Text differs after line-ending/outer-whitespace normalization |
| `mcp_oauth_used_tokens` | `20260604061000` | `20260819013312` | Recorded text matches local after line-ending/outer-whitespace normalization |

Text differences do not by themselves establish semantic differences. They do rule out treating the four names as interchangeable history entries without review.

Six local migration files have no applied version or unique same-name ledger counterpart: `20260514120000_recompose_current_nutrition_macros`, `20260527004140_web_chat_threads_v1`, `20260530120000_update_fiber_goal_per_72_kcal`, `20260608190000_member_metabolism_learning`, `20260713133813_remove_stripe_billing`, and `20261017114730_crm_contacts_foundation`. The concurrently developed `20261018000955_crm_sales_workflow` is also local-only when present. These are an inventory, not an approved pending set. In particular, do not replay historical nutrition changes, seed data, or billing removal merely to make stage match a filename list.

Applied `20260902010824_harden_mobile_app_user_access` has no local migration counterpart. Its recorded SQL was recovered read-only to `docs/evidence/20260902010824_harden_mobile_app_user_access.sql.txt`, outside the migration directory. It records private security-definer identity/role helpers, public invoker wrappers, replacement of old self-update/claim policies, and a restricted column grant. The recorded identity helper still allows a confirmed-email fallback. This evidence is a recovered ledger entry, not verification of current function definitions or authorization to reapply it. A fresh baseline that omits it would miss a material permission change. Review its email fallback with the broader legacy identity rollout before approving a baseline.

Identity aggregates remain 12 app users, three linked and nine unlinked, with zero duplicate links, orphan links, null roles or unknown roles. Production has a UUID app-user primary key and a unique nullable `supabase_auth_uid`; role and updated-at remain nullable. Auth records three email identities and one Google identity. These are authentication methods, not four distinct users and not evidence of ownership of a particular app account. No Apple identity is present. `crm_contacts` remains absent. The new versioned resolver's strict UID link remains necessary; this audit grants no access.

Trusted OAuth validation is still open. NextAuth's current JWT callback deliberately withholds a verified Auth UID from Google/Apple callbacks, and its existing tests reject stale OAuth subjects and forged session-update claims. Do not populate a new registry, infer a subject from email, or use the legacy OAuth helper's returned ID as proof to bypass the gate. Once staging is available, prove the actual provider subject and existing Supabase identity association in a supported OAuth flow; then verify that both web and iPhone resolve exactly one existing app-user ID. Preserve negative tests for missing, conflicting and revoked associations. No OAuth or native sign-in was exercised with production identities here.

Validation of this increment: four audit tests passed locally; targeted ESLint passed. The SQL inventory executed successfully against production using read-only SELECTs. Historical statement retrieval was also read-only. Hosted browser, Mac simulator and physical iPhone checks remain unperformed, and the earlier passing 11-test disposable integration run remains the latest full auth-flow evidence.
