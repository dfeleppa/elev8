# Messaging foundation progress

October 17, 2026. This increment is local implementation evidence only. No live SMS, provider lookup, database migration, production routing change, secret change, number purchase, or paid-service change was performed.

## Delivered boundary

- `20261018001310_crm_messaging_outbox.sql` creates API-only SMS preference, intended-message, outbox and provider-receipt tables with RLS and restricted invoker RPCs. Contact IDs and authenticated app-user IDs remain separate. Shared phone numbers share suppression; new/imported contacts do not imply consent.
- Atomic enqueue saves intended content and a job together, requires explicit current phone permission/evidence and exact contact phone, and rejects changed content under a repeated operation ID.
- Claims use `FOR UPDATE SKIP LOCKED`, lease tokens and bounded leases. A pre-invocation crash can be reclaimed with a new token. Once provider invocation begins, a lost result or expired sending lease becomes `uncertain`; it is never automatically resent. Only an explicit rate-limit rejection is scheduled for bounded delayed retry.
- `src/jobs/sms-outbox.ts` is an awaited, single-job worker primitive. It rechecks permission immediately before invocation and records settlement durably. It is not scheduled or exposed through a deployed runner.
- Accepted callback receipts and status transitions commit together. Duplicate semantic callbacks are ignored; late intermediate events cannot overwrite terminal delivery results. A callback can reconcile an uncertain send using its operation ID and provider SID.
- Signed STOP handling records suppression and cancels pending/claimed jobs in the same transaction. START does not automatically clear suppression. A send already in flight cannot be recalled; a rejected attempt is canceled rather than requeued if opt-out arrived meanwhile.
- Injected Twilio provider adapter allows only explicit pilot destinations and requires an explicit enabled flag. It supplies a stable callback operation ID for correlation; this does not claim Twilio idempotency. Transport/5xx failures are uncertain. No production send route exists.
- Form webhook core uses an explicitly configured canonical HTTPS URL, account SID binding, official Twilio SDK signature validation, bounded body, duplicate-field rejection, and persistence before acknowledgement. General inbound conversation/MMS persistence, staff inbox UI and provider event reconciliation tooling remain follow-up work. Unsupported inbound traffic is not acknowledged as successfully stored.

## Runtime and recovery gates

The database outbox is the recovery record. A durable scheduler/worker runtime is deliberately still unselected and unproven; no Vercel cron/queue configuration changed. Before activation, run concurrent workers against isolated PostgreSQL, exercise database/network loss and lease expiry, and monitor oldest pending/uncertain jobs. PGlite tests prove SQL behavior in one embedded PostgreSQL instance, not real concurrent-session scheduling or hosted throughput.

An uncertain job requires provider evidence or a signed callback before staff decides next action. There is no universal exactly-once claim and no unsafe automatic/manual retry endpoint. Unknown-operation receipts remain available for investigation. Signed request replay is handled by semantic receipt deduplication; Twilio form signatures do not provide a timestamp/replay window. Raw provider payloads, message bodies and credentials are not written to logs by this increment.

## Temporary-number prerequisites (all actual account settings unverified)

1. Owner-controlled Twilio account/subaccount administrative access, actual number ownership, live sender/number inventory, Messaging Service, SMS/MMS capabilities and applicable registration/opt-out configuration. Record existing production routes privately before any later cutover. Existing GHL inventory has no authenticated account evidence.
2. An isolated hosted staging database and HTTPS deployment, trusted test staff identities, reviewed additive migrations and least-privilege access. The staging runbook still reports no isolated hosted target. Do not apply the historical migration chain or these new SQL files to production as part of this increment.
3. A separately authorized temporary test number, approved test recipients with explicit consent, destination allowlist, spend limits, owner-controlled credentials and a canonical callback URL matching the externally visible signed URL. No number acquisition or configuration occurred.
4. Configure the future send SDK client without SDK auto-retry of message POSTs; ambiguous failures must return to outbox reconciliation. The route validates signatures with pinned `twilio@6.2.0`; test through the actual hosted proxy before changing routing.
5. Exercise a real two-way SMS/MMS exchange, duplicate callbacks, out-of-order statuses, STOP during wait and during an attempt, worker restart, provider acceptance followed by database failure, and rollback with GHL still active. Keep live workflow sending owned by only one system.

## Device/calling prerequisites (not implemented or exercised)

Mac/Xcode, Apple developer membership and signing access; physical staff iPhones and TestFlight setup; APNs environment credentials; Twilio Voice app/short-lived access-token endpoint; approved caller ID and destination authorization; PushKit/CallKit integration; voicemail/fallback and multi-device cancellation. Foreground/background/locked-screen, notification denial, token expiration, sign-out, network transition and missed-call tests remain required. Windows TypeScript/PGlite success cannot establish iPhone call delivery.

## Verification

`npx vitest run src/features/messaging src/integrations/messaging src/app/api/webhooks/twilio/sms src/proxy.test.ts` passes 40 tests (32 messaging tests plus 8 proxy checks) after the late-acceptance correction. They execute real migration/RPCs in PGlite and injected provider/webhook fixtures. Whole-checkout `npx tsc --noEmit` passed for the original checkpoint. Real Twilio SDK signatures generated with synthetic offline credentials are tested, including rejection of modified content. Hosted Supabase migrations/advisors, actual Twilio provider traffic, browser/iOS shared inbox, APNs, voice and physical-device checks have not run.

Documentation consulted: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Supabase changelog](https://supabase.com/changelog), and [Twilio request validation](https://www.twilio.com/docs/usage/security#validating-requests). The October TLS cipher notice is a later hosted/device compatibility check; it does not change the local SQL design.

## Disabled webhook configuration

`POST /api/webhooks/twilio/sms` is the only new browser-auth proxy exception; provider signatures authenticate it. It returns 503 unless `TWILIO_SMS_WEBHOOK_ENABLED=true` and `TWILIO_SMS_WEBHOOK_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` are present. Nothing sets these variables in this increment. The public URL must be the canonical externally visible HTTPS webhook URL without query or fragment. Status callbacks append `?operation=<message UUID>`; inbound STOP uses the base URL. Keep webhook receipt enabled for reconciliation if sends are paused during a future pilot. There is no enabled sender factory, cron or public enqueue endpoint.

## Late acceptance recovery correction

The local, unapplied outbox migration now accepts a late positive provider result with the original lease token after a recovery sweep changed `sending` to `uncertain`. It records the SID and accepted state without resending. A wrong token cannot supply that evidence, and negative/retry settlements cannot reopen an expired or quarantined attempt.

Six SQL/PGlite regression cases cover the exact claim -> begin -> lease expiry -> recovery -> late accepted result sequence, no second provider send, wrong-token rejection, late retry/failed/uncertain rejection, and expiry before the sweep. Before the fix, the late-acceptance and expired-retry cases failed; both pass with the correction. No hosted migration, deployment, live provider call or device check was performed.
