# Elev8 native app

This is the unified staff and member SwiftUI target. The first increment implements email/password login, session restoration, role-based member/staff navigation, and a native contacts directory with contact creation for admins and owners. Member training, booking, nutrition, chat, coaching, CRM pipelines, and communication features are subsequent milestones; they are not implemented by this shell.

## Build on macOS

1. Install Xcode and XcodeGen (`brew install xcodegen`).
2. Copy `Config.local.xcconfig.example` to `Config.local.xcconfig`; set the staging API URL and Supabase public configuration. The API must be deployed with the new session/contacts routes. Do not use a service-role key.
3. From this directory run `xcodegen generate` and open `Elev8.xcodeproj`.
4. Select the Elev8 scheme and an iPhone simulator. Build and run. Set a signing team and a suitable bundle identifier before using a physical device.
5. Run the Elev8Tests scheme tests. The shared JSON fixtures come from `packages/contracts/fixtures`.

The deployment target is iOS 17. Supabase Swift is pinned to 2.55.4. Commit the resolved package lock after the first successful Mac resolution; the generated project is intentionally ignored. The GitHub workflow generates the project, builds tests, and runs them on an available simulator.

## Account setup

The initial sign-in flow uses existing Supabase email/password accounts. OAuth-only accounts need a supported password or a future native OAuth flow. New CRM routes require exactly one `app_users` record with `supabase_auth_uid` equal to the verified Auth user ID. Missing or ambiguous links are denied; these routes never claim an account by email. Audit and repair existing links through a trusted administrative process before piloting. No signup or automatic member provisioning is included.

The Supabase SDK manages session refresh and native storage. API authorization is rechecked on each request. The app revalidates capabilities on foregrounding. Contacts live in memory only and are removed from the view on failed revalidation or sign-out. Changing member/staff mode does not change access rights.

## Current validation limits

Foundation [CI run 39030675413](https://github.com/dfeleppa/elev8/actions/runs/39030675413) and staging follow-up [run 39077107327](https://github.com/dfeleppa/elev8/actions/runs/39077107327) compiled the Swift application and test target and passed three simulator contract tests. The Windows development environment cannot execute Xcode. Signing and physical-device behavior remain unverified. No Twilio SDK, push entitlement, or production-number configuration has been added in this increment.

The [staging verification runbook](../../../docs/crm-staging-verification.md) records resource blockers and the disposable backend integration matrix. HTTP bearer tests prove the API contract with real Auth tokens; they do not exercise this Swift client's storage or UI. A hosted staging project and reachable API are still needed for native login, contact create/list, relaunch/session restore, refresh, foreground role revalidation, member/staff switching, sign-out and denied/unlinked-account scenarios. Repeat persistence and network-recovery checks on a signed physical iPhone. Never put a service-role key or a synthetic test password in this target.
