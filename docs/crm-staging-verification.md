# Contacts staging verification

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
