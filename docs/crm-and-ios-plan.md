# Elev8 CRM and Native iOS Implementation Plan

Updated October 17, 2026

Extend Elev8 into a lightweight CRM that replaces the GoHighLevel workflows Lyfe Fitness actually uses. Deliver the web app and one native SwiftUI app for both staff and members from the first production release, in the existing `dfeleppa/elev8` monorepo.

The CRM, customer history, permissions, and business rules belong to Elev8. Twilio supplies texting and calling through an account controlled by Daniel. Existing gym functionality remains part of the product. GoHighLevel stays active through migration and operational validation.

## Product decisions

| Decision | Direction |
| --- | --- |
| Existing application | Extend and refactor selectively; preserve working integrations |
| Repository | Continue the existing Elev8 monorepo |
| Native app | One SwiftUI iPhone app with staff and member experiences in release one |
| Backend | Shared Next.js APIs and Supabase PostgreSQL |
| Identity | Reuse Supabase Auth and existing user identities; bridge current web sessions |
| Phone and SMS | Reuse the existing Twilio setup; verify account ownership and administrative access; test with a temporary number |
| Existing phone number | Keep the number in its current Twilio account where access permits; switch application routing from GoHighLevel to Elev8 after validation |
| Email | Proposed default: Resend for app email and replies; mailbox synchronization is a separate capability |
| Business scope | Lyfe Fitness initially; no agency or multiple-business product in this release |
| Release strategy | Incremental internal milestones, followed by a combined staff and member release |

The reviewed source snapshot is [1fe057d](https://github.com/dfeleppa/elev8/tree/1fe057d032c67dbf4a9b5aadc7808d39eb6bbbfc). Production database state and enabled integrations must be reconciled with that snapshot in milestone zero.

## First release scope

### Staff experience

- Contacts: search, lead source, tags, notes, ownership, member links, and communication preferences.
- Opportunities: pipeline stages, assigned staff, value, next action, won and lost outcomes, and stage history. A contact can have multiple opportunities.
- Shared inbox: two-way SMS/MMS and email, assignment, unread state, delivery status, and contact history.
- Calling: business caller ID, outbound calls, incoming calls, missed calls, voicemail, and a call log on the contact.
- Follow-up tasks: due dates, responsible staff, reminders, and links to contacts or opportunities.
- Essential automations: new lead follow-up, appointment reminders, missed-call follow-up, and reactivation where confirmed in the GoHighLevel inventory.
- Simple reporting: lead counts, stage conversion, overdue follow-ups, response time, and communication spend.
- Mobile coaching: assigned member roster and the existing coaching information needed for daily work, with scoped access.

Web handles bulk import, pipeline configuration, automation settings, provider settings, and detailed reporting. The Swift app supports daily communication, contact updates, stage changes, tasks, and coaching. Administrative parity on every screen is not required for release one.

### Member experience

- Sign in, restore a session, recover access, and manage the member profile.
- View the class schedule, book or cancel a reservation, and see booking status.
- View workout programming and log supported workout results.
- Use existing nutrition targets, food logging, and assigned coaching plans.
- Use the existing gym chat with explicit visibility rules; receive relevant notifications.

This is the baseline member scope. Milestone zero checks actual member usage for any additional release blocker. Payroll, store administration, social publishing, advanced program building, and new Apple Health features remain available through existing surfaces where applicable; their full native expansion follows the first release unless the inventory establishes a dependency.

Members do not receive a business dialer, sales pipeline, staff notes, or access to the shared customer inbox. A coach or owner who also trains can switch between their authorized staff and member experiences without a second account.

### Deferred expansion

Visual automation builders, AI receptionists, predictive lead scoring, full marketing suites, Android replacement, and new payment infrastructure follow the initial CRM replacement. Any currently used GoHighLevel form, calendar, payment link, funnel, or workflow must be explicitly replaced or retained elsewhere before cancellation; it cannot be silently deferred.

## Monorepo organization

Keep the existing web application at the repository root initially. A monorepo can contain the existing Next.js application and native Swift targets without moving the web app or changing its deployment root. Add clear ownership boundaries:

```text
elev8/
  src/                         Existing Next.js web application
    app/api/                   Shared web and mobile HTTP endpoints
    features/crm/              CRM services, permissions, and web UI
    integrations/              Twilio and email provider adapters
    jobs/                      Delivery, scheduling, and retry handlers
  apps/
    ios/Elev8/                 Unified SwiftUI app and Xcode project
      Features/                Member, coaching, and CRM screens
      Core/                    Session, API, notifications, and calling
      Tests/                   Native unit and UI tests
  packages/
    contracts/                 OpenAPI specification and shared fixtures
  supabase/migrations/         Additive database migrations
  docs/                        Product plan, architecture, and runbooks
  .github/workflows/           Web, contract, and macOS build checks
  Elev8Nutrition/             Existing native client during transition
  elev8_mobile/               Existing Flutter client during transition
  fuelwise/                  Separate product boundary
```

These are planned paths. The shared contract defines requests, responses, errors, identifiers, dates, and pagination. Swift and TypeScript can generate clients from it after a small generation spike. UI code remains native to each platform; authorization and business decisions remain on the server. CI detects contract drift and checks shared request/response fixtures.

Reuse suitable Swift authentication, nutrition models, and UI components after reviewing them. Do not copy the older clients wholesale. Inventory which Flutter and Elev8Nutrition builds are distributed, preserve their supported APIs during migration, and retire them only after the unified app covers required workflows. Fuelwise remains an independent product in the repository. Its README and root agent guidance disagree about historical backend details; resolve that documentation discrepancy before touching it.

## Shared backend and identity

Both clients call the same application services. Continue using Next.js route handlers; introduce versioned CRM endpoints such as `/api/v1/crm/contacts`, `/opportunities`, `/conversations`, and `/tasks`. Existing member endpoints can be adapted behind the same service layer instead of duplicated.

Retain web NextAuth sessions initially and accept verified Supabase bearer tokens from iOS. Resolve both to the same stable `app_users.id`. Audit the existing email fallback and legacy identity migration before relying on them for CRM permissions. Linking accounts must use verified identity, never a caller-supplied email or user ID. Lead import must never create an authenticated account or confer access.

The iOS app uses secure session storage, token refresh, and supported OAuth redirects. It obtains short-lived voice access tokens from an authorized backend endpoint. Provider credentials and Supabase service-role credentials stay on the server. [Supabase mobile auth guidance](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

New CRM reads and writes go through authorized APIs. Enable row-level security on exposed tables and grant only required access. The existing admin database client bypasses RLS, so every service using it must independently enforce user, role, and record access. Realtime subscriptions and storage downloads must have equivalent scope. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Permission boundaries

| Audience | Access |
| --- | --- |
| Member | Own profile, bookings, results, nutrition, and permitted gym chat |
| Coach | Member access plus assigned coaching records; CRM only if explicitly granted |
| Authorized CRM staff | Assigned contacts, conversations, opportunities, and tasks; wider access only by policy |
| Admin and owner | Team CRM access; sensitive exports and configuration restricted by capability |

Staff access to CRM does not automatically grant access to private nutrition or health data. Hiding a tab is not authorization. Tests must attempt access directly through APIs, realtime channels, and storage as different users.

## CRM data model

Add CRM tables alongside existing gym tables. Preserve existing user IDs and member references.

| Entity | Purpose and key relationships |
| --- | --- |
| Contacts | Person record, source, owner, lifecycle, and optional link to an app user |
| Contact channels | Normalized phone/email values, primary flags, and verification state |
| Contact preferences and consent events | Channel and purpose, source, timestamps, opt-out evidence, and suppression |
| Pipelines and stages | Configurable sales process and stage ordering |
| Opportunities | Contact, stage, owner, value/currency, status, next action, and outcome |
| Opportunity stage events | Durable transition history for reporting and auditing |
| Conversations and participants | Channel, contact, assigned staff, provider mapping, and member-visible boundaries |
| Messages and attachments | Direction, body, sender, timestamps, provider ID, delivery status, and attachment references |
| Calls | Contact, staff, provider call/leg IDs, direction, outcome, duration, and voicemail reference |
| Notes and tasks | Visibility, author/assignee, due date, and contact/opportunity links |
| Provider events and outbound jobs | Durable webhook receipt, deduplication, attempts, retry timing, and errors |
| Automation definitions and runs | Versioned triggers/actions, execution state, cancellation, and send history |
| Device registrations | App user, environment, ordinary push token, and VoIP registration lifecycle |
| Import mappings and audit events | Original system IDs, reconciliation status, actor, and change history |

Decide whether to extend existing tasks or introduce CRM-specific tasks after checking current consumers. Use explicit foreign keys, index relationship and inbox lookup columns, and paginate conversations by a stable cursor. Store timestamps in UTC and display schedules in the relevant local timezone. Monetary values use an exact representation with currency.

Normalize phone numbers and email addresses for matching, but flag ambiguous household/shared channels rather than automatically merging people. Linking a contact to a member must preserve prior conversations and opportunities. A won opportunity is not by itself proof of membership payment or permission to provision an account.

## Messaging and job reliability

Store message history in Elev8 with provider identifiers as references. Build thin adapters for Twilio and the email provider so provider changes do not require replacing contacts, pipelines, or history.

For outbound communication, save the intended message and an outbox job in one database transaction. A durable worker claims jobs, checks current consent and cancellation state, sends through the provider, and records results. Retries use stable operation IDs. If a provider accepts a send but the response is lost, reconcile uncertain status before resending; do not claim universal exactly-once delivery.

Validate inbound webhook signatures, persist accepted events, deduplicate retries, and process delivery callbacks without allowing an older callback to overwrite a final status. Twilio recommends its SDK for signature validation. [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)

Milestone zero selects and proves the worker runtime. Vercel Queues is a candidate, but its current beta status must be evaluated against the operational requirements. The database outbox remains the recovery record, with a reconciliation process for unprocessed jobs. Browser timers, mobile background execution, and unawaited server tasks are not delivery mechanisms. [Vercel Queues](https://vercel.com/docs/queues)

Expose failed and uncertain sends to staff with safe retry controls. Alert on stalled jobs, repeated webhook failures, and provider spend thresholds. Preserve suppression across imports and manual sends. Use provider opt-out handling plus Elev8's own preferences; cancel pending follow-ups on opt-out and recheck eligibility at execution. [Twilio opt-out behavior](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out)

### Email behavior

Use an authenticated sending domain or subdomain and route replies into Elev8. Preserve message IDs and reply references for threading; process bounces, complaints, and unsubscribes. Keep internal staff notes out of outbound content.

Resend is the proposed app-email provider and supports inbound email handling. This does not synchronize an existing Gmail inbox. Decide during the workflow inventory whether existing mailbox history and sent-folder synchronization are required for cancellation; if they are, add a dedicated Gmail integration to the release scope. [Resend receiving documentation](https://resend.com/docs/dashboard/receiving/introduction)

## Native Swift app

Build an iPhone-first SwiftUI application with async networking, feature modules, accessible controls, and clear loading/error states. Start with the existing native baseline of iOS 17 or later, subject to checking member device coverage and selected SDK requirements.

Suggested member tabs are Today, Training, Schedule, Nutrition, and Messages. Suggested staff tabs are Inbox, Contacts, Pipeline, Tasks, and More, with coaching accessible through the staff experience. The server supplies capabilities; changing view mode never changes permissions.

Cache recent permitted reads and unsent drafts. Require connectivity for sending messages, placing calls, confirming reservations, and changing sales stages in the first release. Show stale data and submission state explicitly. Repeated taps and reconnects must not create duplicate messages or bookings. Clear sensitive cached data on sign-out and account changes.

### Calling and notifications

Use Twilio Voice SDK for native calls, CallKit for system calling integration, and PushKit for incoming VoIP call notifications. The backend controls approved caller IDs, destinations, staff identities, and routing. Members cannot obtain staff voice tokens. [Twilio iOS Voice](https://www.twilio.com/docs/voice/sdks/ios), [Apple CallKit](https://developer.apple.com/documentation/callkit), [Apple PushKit](https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit)

Use ordinary APNs notifications for messages, tasks, and bookings. VoIP pushes are reserved for calls. Register and revoke tokens per device and environment, and avoid sensitive message text in notification payloads by default. Multi-device call handling must stop ringing other devices when a call is answered or canceled.

Test calls on physical devices in foreground, background, and with the screen locked; include notification denial, token expiry, logout, network changes, and missed-call fallback. Do not promise incoming-call delivery when OS restrictions or user settings prevent it. Unavailable staff calls must fall back to the configured forwarding destination or voicemail.

Call recording is off by default in release one. Voicemail is in scope; recording retention and access must be defined before enabling it. Native builds, signing, device testing, and TestFlight distribution require macOS/Xcode and an Apple developer setup; the current Windows workspace cannot perform those validations. [TestFlight](https://developer.apple.com/testflight/)

## Implementation milestones

Milestones are dependency gates, not calendar promises. Build web and native features against each completed backend contract. Intermediate staff pilots do not change the requirement that the first production app serves both staff and members.

| Milestone | Deliverables | Exit criteria |
| --- | --- | --- |
| 0 Foundation and inventory | Restore the source checkout; run baseline checks; reconcile deployment/schema; inventory GHL workflows and integrations; confirm mobile reuse, auth mapping, queue runtime, and Mac build access | Written replacement checklist, baseline failures classified, staging isolated, and no unresolved architectural blocker |
| 1 Identity and app shell | Monorepo boundaries, API contract, iOS target, login/session restore, server capabilities, member/staff navigation, CI | Same person signs in on web and iOS; unauthorized role and record access fail; iOS builds on macOS |
| 2 Contacts and opportunities | Additive CRM schema, contact/member linking, pipeline, assignments, notes, tasks, import preview; web and Swift screens | A lead moves through stages on both clients without duplicate identity or lost history |
| 3 Texting and inbox | Twilio temporary number, send/receive, MMS, delivery callbacks, outbox/worker, suppression, push, inbox assignment | A real two-way exchange appears on both clients; retries and opt-out tests pass |
| 4 Calling and email | Browser/native calling, incoming routing, voicemail, email sending/replies and event processing | Physical-device call matrix passes; email reply, bounce, and unsubscribe flows work |
| 5 Member parity and essential automations | Native bookings, workouts/results, nutrition/coaching, gym chat; required lead/reminder/reactivation flows | Real staff and members complete daily scenarios; scheduled jobs survive restarts and cancel correctly |
| 6 Pilot and migration | Rehearse imports, reconcile records, release TestFlight pilot, complete GHL replacement checklist, prepare Twilio routing cutover | No unresolved critical issue; required data reconciled; support/fallback runbook exercised |
| 7 Cutover and stabilization | Final import delta, disable old sends, switch Twilio routing to Elev8, verify traffic, distribute production app, observe operations | All cancellation gates below pass |

Member feature work starts after milestone 1 and progresses alongside CRM milestones 2 through 4. It must not be postponed until the end of development. The native calling spike also starts early to expose APNs, signing, and device constraints before migration.

### First demonstration

A lead arrives through an authenticated staff entry or protected lead intake form, becomes a contact and opportunity, receives a text, replies into the shared inbox, and gets a follow-up task. Staff can handle the exchange on web and iPhone. An existing member independently signs into the same Swift app and sees only their own schedule and profile. Later, an explicit conversion links the lead to a member without losing history or granting unintended access.

## GoHighLevel data migration and Twilio cutover

1. Inventory active numbers, messaging registrations, sending domains, users, pipelines, tags, custom fields, consent records, workflows, forms, calendars, and integrations. Capture current monthly communication usage to budget the replacement.
2. Verify export/API availability and account permissions. Rehearse extraction of contacts, opportunities, notes, tasks, messages, and attachments. Record any non-exportable history and choose an accessible archive before cancellation.
3. Import into staging with original system IDs and rerunnable mappings. Compare counts, stage totals, samples of complete timelines, and suppression records. Imports must not send messages or start automations.
4. Verify who controls the existing Twilio account or subaccount, administrative access, number ownership, Messaging Service, registration, and current voice/messaging routing. The confirmed provider is Twilio; no LC Phone migration is planned. If account access requires a transfer, resolve that specific dependency before setting a cutover date.
5. Test the full product on a temporary Twilio number without changing production routing. Prepare and record the exact production webhook, callback, Messaging Service, and voice application settings needed for Elev8, along with the previous settings for recovery. Reuse existing registrations where applicable after checking the planned configuration.
6. Define a cutoff timestamp, take the final data delta, and disable GoHighLevel outbound automations before enabling equivalent Elev8 sends. Only one system owns live sending for a workflow at a time. Redirect lead forms, reply routing, and calendar integrations deliberately.
7. Switch the existing number's Twilio routing to Elev8 and verify inbound/outbound SMS, MMS, voice, voicemail, caller ID, opt-outs, callbacks, and contact matching. CRM history must be imported separately from the phone configuration.
8. Keep GoHighLevel active until data retention, workflow replacement, and stabilization gates pass. If cutover fails, pause Elev8 sends and use the recorded routing settings or tested forwarding/voicemail fallback. Reconcile messages received during the cutover before restoring any old automations to prevent duplicate sends.

## Testing and release gates

Required automated checks cover role and record isolation; contact linking; stage transitions; duplicate webhook receipt; callbacks arriving out of order; uncertain send outcomes; opt-out cancellation; retry after a worker crash; email threading; timezone/DST scheduling; and reservation concurrency. Preserve existing nutrition, scheduling, auth, and programming regression checks.

Use separate development, staging, and production data and provider configuration. Previews must not message real members. The backend remains compatible with the currently distributed mobile version while the next version moves through TestFlight and App Store review. Prefer additive schema changes; remove old fields or APIs only after supported clients stop using them.

CI runs web lint/type checks, relevant tests, production build, migration validation against a test database, and contract checks. A macOS job builds/tests Swift with pinned package resolution. Physical-device and provider tests are separate evidence; simulator success is insufficient for incoming-call readiness.

GoHighLevel cancellation requires all of the following:

- Every actively used GHL workflow has a tested replacement or a documented retained destination.
- Required records, suppression lists, and history are reconciled or archived accessibly.
- The production number passes inbound/outbound tests, with registration and routing confirmed.
- Staff complete core CRM tasks on web and iPhone; members complete their release-one workflows.
- Automated negative-access tests and signed-out/role-change scenarios pass.
- Backups and restoration are exercised; failed sends, queue failures, and spend are visible to an owner.
- The production iOS distribution path is ready for members; TestFlight alone is a pilot, not the permanent member rollout.
- Complete at least two weeks of representative operation without unresolved critical issues; extend for workflows with longer cycles.

## Inputs to resolve during foundation work

| Input | Why it matters | Default until verified |
| --- | --- | --- |
| GHL workflows actually used | Defines what cancellation requires | Inventory before final scope lock |
| Number count and monthly usage | Provider setup and cost model | One primary business number; verify |
| Email identity and mailbox needs | App email versus full mailbox synchronization | Resend with a dedicated reply domain |
| Existing distributed mobile apps | Member continuity and client retirement | Preserve existing clients until usage is known |
| Staff access and assignments | CRM visibility and coaching boundaries | Explicit grants; members have no CRM access |
| Apple developer account and Mac access | Signing, physical-device testing, distribution | Required before native delivery dates |
| Queue runtime and operational budget | Reliable sending and scheduled work | Prove durable delivery in milestone zero |

Budget for hosting/database, queue execution, monitoring, number rental, SMS segments and carrier charges, call legs, email volume, storage, Apple distribution, and maintenance. Compare actual usage with GoHighLevel before estimating savings. Set delivery dates after the foundation audit and native calling spike establish the remaining work and external dependencies.

## Immediate implementation backlog

- [x] Establish the existing repository checkout and a dedicated implementation branch without replacing user work.
- [ ] Record baseline build/test status, deployment health, schema parity, and integration inventory.
- [ ] Produce the GHL replacement checklist and one sample import reconciliation.
- [ ] Decide the canonical account mapping and test member versus staff access through both auth paths.
- [ ] Create the unified Swift target and build it on macOS; prove role switching and session restore.
- [ ] Define the contacts/opportunities/inbox API contract and additive data migrations.
- [ ] Prove temporary-number texting and physical-device incoming calls before production-number changes.
- [ ] Deliver the first demonstration, then proceed through the milestone gates.

### Foundation build progress

The first increment is implemented on `codex/crm-ios-foundation`: protected session/contact APIs, a web contacts workspace, an additive contact migration, shared API contracts, and a native SwiftUI login and role-based shell with contacts. See [foundation build status](crm-foundation-status.md) for validation and remaining work. This does not complete the combined staff/member release or the first texting demonstration.
