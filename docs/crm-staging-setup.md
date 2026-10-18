# Separate staging setup — October 17, 2026

## Provisioned and verified

- Vercel team: Daneff (`dfeleppa`, `team_XV7wURqwcMBKoaj3Gpj8cY47`).
- New project: `elev8-staging`, ID `prj_mtDG3J02sA9Yau53yUw3MXQRKmIV`.
- Dashboard: https://vercel.com/dfeleppa/elev8-staging
- Next.js framework; Node 22 requested to match CI.
- Independent high-entropy `NEXTAUTH_SECRET` created as a sensitive variable for this project's production and preview targets. Here "production" means this separate staging project's canonical deployment, not the live gym project.
- `TWILIO_SMS_WEBHOOK_ENABLED=false` set for all three environment targets.
- Variable metadata was read back successfully using the explicitly scoped CLI; no secret value was printed or saved in the repository.
- Connector environment reads/writes return 403, but `vercel api` with explicit project ID and teamId succeeds. Vercel access is therefore no longer a user blocker.

No deployment, domain, Git auto-deployment connection, database or synthetic user has been created. The root checkout's project linkage and live project `daneff` were not changed. Use `vercel.staging.json` explicitly for staging deployments so the production cron list is not installed. Do not attach automatic Git deployment until the staging configuration strategy is in place.

## Actual Supabase blocker

The user chose organization **Elevate Fitness Inc** (`pvtjvzyzubboaigkqjkl`). Creation of `elev8-staging` in `us-east-1` failed because owner/admin `dfeleppa` has reached the two-active-free-project limit. The existing visible projects are production Elev8 and Planet Pooch. No database project was created.

The project cost tool returned $0/month for a free project; this does not waive the quota and is not a paid-upgrade quote. To continue, the user must either explicitly select an existing project to pause (interrupting that project's service), or resolve the limit through Supabase billing. Do not pause/delete an unrelated or live project or approve an upgrade implicitly. No paid-plan change was attempted.

## Resume after capacity is available

1. Re-list projects to avoid creating a duplicate, then create `elev8-staging` in the chosen organization and region; verify its distinct reference and healthy status.
2. Link an isolated Supabase CLI work directory to that new reference. Never run root `db push`: the repository's existing Supabase association is production.
3. Reconcile a schema-only staging baseline using `crm-staging-verification.md`, including the four historical version discrepancies and recovered September permissions migration. Do not replay historical seeds or copy production users, provider data, scheduled jobs or queues.
4. Securely configure staging-only Supabase URL/public key/server key in the new Vercel project. Set `NEXTAUTH_URL` to the verified staging URL. Use linked synthetic password accounts initially; provider-specific OAuth setup and real member identity repairs are separate gates. Do not copy production integration credentials.
5. Use an isolated deployment directory or explicit Vercel project/team environment selectors and `--local-config vercel.staging.json`; verify the CLI command's help before deploying. Keep root linkage unchanged. Verify database identity and inactive messaging/cron configuration before test writes.
6. Expand the disposable integration fixture for the sales, member and SMS migrations; validate table grants, strict cookie/bearer access, booking races and worker recovery. Then run hosted browser tests.
7. Build/test the new Swift sources on macOS; exercise hosted staging with simulator and subsequently a signed physical iPhone. Deployment protection may need authorized device access; do not remove it blindly.

The immediate user dependency is Supabase free-project capacity. Schema reconciliation, staging credentials, application deployment and synthetic account setup remain implementation work after that dependency is resolved; no credentials need to be pasted into chat.
