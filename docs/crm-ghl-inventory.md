# GoHighLevel replacement inventory

Inspected October 17, 2026 (America/New_York). Status: **live inventory blocked on an authenticated Lyfe Fitness account; cancellation gate remains open**.

## Evidence and limits

| Evidence inspected | Verified finding | Limit |
| --- | --- | --- |
| `crm-and-ios-plan.md`, foundation status and staging runbook | Twilio is the agreed provider; keep GHL active through validation; live-number routing must be preserved until cutover | These are project decisions and prior evidence, not fresh Twilio account verification |
| Chrome: `https://app.gohighlevel.com/` | Sign-in page; no authenticated GHL session available | No location ID, object count, workflow status, history or configuration inspected; no login attempted |
| Plugin discovery: GoHighLevel / HighLevel / Twilio | No matching plugin returned | Directory discovery does not prove no integration exists anywhere |
| Repository source/docs and CSV filenames | No Lyfe GHL export found; the existing membership CSV is not established as a GHL export | No customer data used or copied |
| Downloads filenames | Attendance and Planet Pooch/MoeGo exports, no identified Lyfe GHL export | Planet Pooch data is a different business and was not opened or imported |
| Google Drive search | Keyword search returned backed-up skill files; filename search found GHL/code and MoeGo sales-sync folders | No identified Lyfe GHL data export. Backup folder names do not prove Lyfe configuration or usage; search was bounded, not exhaustive |
| `src/features/crm/contracts.ts`, contacts route and contact migration | Foundation supports create/list of name, one email, one E.164 phone and enum source | No source-system ID, import audit, preferences, notes, opportunities, messages, attachments or stage-history persistence in this bounded foundation |

No live GHL object is marked verified below. New lead, appointment reminder, missed-call and reactivation flows are **candidate requirements from the plan**, not claims of actual usage. No real messages, API calls to GHL/Twilio, account changes, database writes or routing changes occurred.

## Capture checklist

For each actual object record location ID, source object ID, name, status, last execution/submission date, downstream dependencies, responsible staff, replacement or retained destination, and a dated evidence reference. Preserve configuration in a private archive; put only sanitized inventory and counts in Git. Draft/unused status alone needs owner confirmation before exclusion, including seasonal workflows.

| Area | Capture from actual account | Replacement acceptance | Current status |
| --- | --- | --- | --- |
| Account and staff | Lyfe location, timezone, users, roles, assigned records, integrations and external credentials' owners (never credential values) | Staff capability/assignment matrix exercised; no member CRM access | Unknown |
| Workflows | Published/draft state; triggers, filters, branches, waits, send windows/timezone, templates, stop-on-reply/booking/opt-out rules, active enrollments, execution logs | Every used branch reproduced or deliberately retained; scheduled actions cancel on reply/opt-out; one sending owner at cutover | Unknown; all candidates unconfirmed |
| Forms/surveys | IDs, fields/custom fields, validation, consent copy/version, thank-you redirects, embed locations, attribution, recent submissions, workflow hooks | Same lead inputs and attribution reach contact/opportunity once; consent evidence persists; links and embeds verified | Unknown |
| Funnels/websites/payment links | Published URLs, DNS/domain owners, live traffic destinations, tracking, payment/subscription dependencies | Each live URL replaced/redirected or retained with a named owner and ongoing cost | Unknown; never silently defer |
| Calendars | IDs and public links, appointment types, owners, duration, availability, buffers, booking timezone, Google sync, reminders, reschedule/cancel/no-show behavior, future bookings | Preserve upcoming bookings; timezone/DST, double-booking and reminder behavior tested; old links handled | Unknown |
| Pipelines/opportunities | Pipeline/stage IDs and order; open/won/lost counts, values/currencies, assignees, next actions, stage history; multiple opportunities per contact | Counts and exact amounts reconcile by pipeline/stage/status; no stages inferred from text alone | Unknown |
| Contacts | Stable contact IDs, channels, tags, custom-field definitions/values, owner, source, created/updated timestamps, member links | Rerunnable `(location, source ID)` mapping; shared channels reviewed; no login account created | Unknown |
| Consent/suppression | Channel/purpose DND and opt-out state, source and timestamp, evidence, provider suppression, complaints/unsubscribes | Zero lost suppressions; missing evidence cannot imply permission; no jobs during import | Unknown; prerequisite to any real sends |
| Notes/tasks | IDs, original author/assignee, visibility, text, due/completed dates, parent IDs | Counts and representative complete timelines reconcile without exposing staff notes to members | Unknown |
| SMS/MMS/email history | Conversation/message/provider IDs, direction, timestamps, sender/recipient, delivery states, attachments and threading references | Count/ID coverage and complete sampled timelines; accessible archive for anything not importable; attachment access proven | Unknown; exportability not assumed |
| Calls/voicemail | Call and provider-leg IDs, disposition, duration, missed calls, voicemail files, retention/access | History reconciled; voicemail retrievable by authorized staff; recording remains off until policy decided | Unknown |
| Twilio account/number | Owner/admin access, account vs subaccount, actual number count, number SIDs, SMS/MMS/voice capabilities, Messaging Service and registration, sender identities | Owner controls access; temporary-number proof; existing registrations' applicability verified | Provider decision confirmed by plan; all actual settings unknown |
| Twilio routing/recovery | Current SMS/voice URLs and HTTP methods, fallback URLs, status callbacks, voice application, forwarding/ring timeout/voicemail, opt-out behavior | Private before/after settings snapshot; tested rollback and single system ownership; no change during inventory | Unknown |
| Email | Sending/reply domain, DNS/authentication, mailbox sync, reply routing, unsubscribes, bounce/complaint handling | Decide whether Gmail history/sent-folder sync is required; app-email support alone does not establish parity | Unknown |
| Usage and budget | Last complete month and longer seasonal window: SMS segments/MMS, call legs/minutes, email, storage, numbers, provider charges | Budget from measured usage and current rates; no savings claim from assumed one-number setup | Unknown |

## Extraction and reconciliation procedure

1. Resume in an authenticated Lyfe location, verify business/location first, and inspect list/detail pages without changing configuration. GHL/Twilio administrative access must be provided through an existing authorized session or approved connector, not by placing secrets in this repository.
2. Determine available read-only export/API access for **each** entity. Record source counts, filters, timezone, extraction timestamp and pagination coverage. A contact CSV alone does not establish history or suppression coverage.
3. Archive original files privately with SHA-256 checksums and a manifest. Preserve raw IDs, timestamp offsets, custom-field definitions, nulls, attachment references and explicit DND values. Do not invent consent from a blank field.
4. Map headers into the explicit offline fixture format only after viewing actual export headers and documenting each mapping. Include location and source ID. Do not assume the synthetic names in the fixture are native GHL export fields.
5. Run the offline preview below. Resolve conflicting IDs, missing/invalid fields and shared channels. Preserve all original suppression and consent data outside the limited contact payload. Do not use this output with the contacts POST API: it intentionally retains migration fields the API does not support.
6. Once isolated staging and the missing import/audit/preferences schema exist, import with outbound processing disabled and stable source mapping. Repeat the same batch and assert zero extra contacts/events/jobs/accounts. Never match an authenticated member by email alone.
7. Reconcile source unique IDs = imported + quarantined + documented exclusions, including every page. Compare pipeline/stage/status totals, exact currency totals, note/task/message/attachment counts, original timestamps and all suppressions. Sample complete timelines across inbound/outbound MMS/email/calls, shared households, open tasks, won/lost opportunities and opted-out contacts.
8. Record final delta cutoff and deletion/update handling before cutover. Disable old workflow sends before enabling new ones. Maintain a private recovery snapshot and reconcile in-flight jobs/messages before restoring either system.

## Offline rehearsal delivered

`scripts/crm-ghl-rehearsal.mjs` reads a deliberately canonical JSON fixture and prints an aggregate report only. It has no network or database client, never sends, never provisions users and never writes its input or contact bodies. It checks deterministic source mapping, duplicate/conflicting source IDs, basic required fields, conservative channel formatting, shared-channel ambiguity, suppression count and replay-stable output.

```powershell
node scripts/crm-ghl-rehearsal.mjs docs/fixtures/crm-ghl-synthetic.json
```

The fixture is entirely synthetic (`example.invalid` addresses and reserved fictional NANP numbers). Expected result: 7 input rows; 6 unique source IDs; 1 exact duplicate row; 2 valid contact previews; 4 quarantined contacts (2 sharing a channel, 1 invalid phone, 1 missing name/channel); 1 suppressed source contact. Replay mapping check passes; all outbound eligibility is false. This is a rehearsal of offline checks, **not a real GHL extraction, database import or migration reconciliation**. The production sample-import backlog item remains incomplete.

Real input is private customer data. Keep it outside Git and avoid shell redirection into tracked paths. Script output intentionally contains only counts and a SHA-256 receipt; inspect raw records through an authorized private workflow. Current validation is a conservative preview, not a substitute for the API's Zod validation or a reviewed international phone parser.

## Next evidence needed

- Authenticated Lyfe GHL session and read-only export access; location identity and account scope.
- A small representative export with stable IDs **plus** suppression evidence, notes/tasks/opportunities and complete conversation samples where available.
- Twilio read-only account/number/routing/registration and usage evidence.
- Owner confirmation of actively used/seasonal workflows and retained public URLs.

No cancellation or cutover approval is implied by this document. Link each inventory row to dated account evidence and its passing replacement scenario before closing it.
