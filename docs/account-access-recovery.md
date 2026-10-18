# Existing account access and recovery

Current checkpoint: October 17, 2026 (America/New_York). Main project only: `scghaxpgsibpffbukyws`; application `https://app.daneff.com`. This supersedes the pre-release wording in `crm-identity-access.md` and the release-pending wording in `crm-main-rollout.md`.

## Audit and boundaries

The released identity boundary requires a password-authenticated Supabase UID linked to exactly one canonical `app_users.id`. Do not restore email fallback, automatic linking, user-metadata roles or the legacy bcrypt bridge. Google and Apple callbacks remain gated until the provider-subject design in `crm-identity-access.md` is implemented and verified.

The read-only audit found 12 app users: three linked owners, six unlinked members and three unlinked coaches. The real owner's linked Auth identity is Google-only and has no password. Two linked owner records use local/test email domains and have passwords; the sole legacy hash belongs to one of these, so it does not require migrating a real member's legacy password. Exactly one unlinked member has a same-email Auth candidate; this is not ownership evidence. Two unlinked coach records have placeholder/test email addresses. Full names, addresses and exact UUIDs belong in the private operator review sheet, not this repository.

Run `scripts/account-access-audit.sql` read-only against the explicitly chosen project for a fresh inventory. It selects only password-presence booleans, never hashes. The former email-based trigger could overwrite UID links, so even the existing three owner links require review. No real account, role, link, password, legacy hash or Auth provider was changed during this audit.

## Recovery completion page

`/account-recovery` supports an operator-issued Supabase `recovery` or `invite` token hash in the fragment:

```text
https://app.daneff.com/account-recovery#token_hash=<single-use-token-hash>&type=recovery
https://app.daneff.com/account-recovery#token_hash=<single-use-token-hash>&type=invite
```

The browser removes the fragment immediately after mounting, waits for an explicit Verify link click, and verifies the token with Supabase. The recipient chooses their own password. Auth state stays in memory, is not stored in browser storage or a NextAuth cookie, and is discarded after saving. The page never writes app users or roles. A fresh email/password login is required; unlinked users still cannot access protected data. Missing, invalid, duplicate and reused proofs fail closed. Recovery does not promise revocation of existing NextAuth sessions; strict incident-response revocation requires additional session-lifecycle work.

This page intentionally does not accept default `ConfirmationURL` access-token fragments or PKCE codes. Use the token-hash templates below. It does not expose an unauthenticated email-sending endpoint or a registration path.

## Hosted mail prerequisites

The main Supabase dashboard was inspected: custom SMTP is not configured. The built-in service restricts recipients to organization team members and currently allows only two messages per hour; it cannot support member onboarding. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

Before sending real invitations/recovery messages:

1. Configure an approved SMTP provider and verified sender domain in the [main SMTP settings](https://supabase.com/dashboard/project/scghaxpgsibpffbukyws/auth/smtp). Required: host, port, username, password/API credential, From address and sender name. Enter credentials through the provider/dashboard or a secret store, never chat or Git. Disable email link tracking. Domain verification may require DNS access.
2. After the page's deployment is verified, use these link targets in the [Reset password](https://supabase.com/dashboard/project/scghaxpgsibpffbukyws/auth/templates/reset-password) and [Invite user](https://supabase.com/dashboard/project/scghaxpgsibpffbukyws/auth/templates/invite-user) templates respectively. Keep the branded surrounding text clear and brief:

```html
<a href="https://app.daneff.com/account-recovery#token_hash={{ .TokenHash }}&amp;type=recovery">Choose your password</a>
<a href="https://app.daneff.com/account-recovery#token_hash={{ .TokenHash }}&amp;type=invite">Set up your password</a>
```

These explicit links use no redirect allowlist expansion. Existing mobile callback URLs are preserved. Do not use a generic Site URL redirect to the homepage: it does not consume recovery proof. No hosted mail settings or templates have been changed and no real emails have been sent by this task.

## Per-account operator procedure

1. Obtain the owner's explicit review of each canonical app ID, person, retained role and verified delivery address. Decide whether the two same-name records are intentional separate accounts. Decide which test/placeholder accounts should be retired; never silently convert or delete them.
2. For a linked account, verify the exact existing UID's provenance and recipient ownership. Preserve that UID. Issue a recovery link only after the reviewed recipient and delivery method are authorized. Do not invent or request a password; the recipient uses the page.
3. For the one existing Auth candidate, verify control of that exact Auth account and obtain owner approval for its canonical app ID. Matching email alone does not authorize the link.
4. For a person with no Auth account, invite only to the reviewed delivery address. Capture the exact Auth UID returned by the admin invitation operation. After the recipient verifies control and the owner approves, link only that returned UID to the reviewed canonical app ID. Do not bulk match on email or adopt a conflict returned from an existing email account.
5. Apply any link as a bounded transaction: lock the exact app row, assert the reviewed current role and null/expected old UID, confirm the target Auth user and verified ownership evidence, reject any other app row using that UID, write just the UID, and assert one changed row. Record actor, time, evidence and before/after in the private operations audit. Never change the canonical app ID or role as a side effect of linking.
6. Verify a fresh browser password login and bearer request resolve the expected canonical app ID and role; confirm member/coach/owner denials at their boundaries. Preserve existing member data. Only then consider retiring an unused legacy hash or test identity as a separately reviewed action.

No root `supabase db push` is part of recovery. The applied migration history is immutable and differs from the root folder.

## Integration checks

Both workflows use `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` at job scope, matching [Supabase setup-cli](https://github.com/supabase/setup-cli/blob/main/src/main.ts) for the pinned CLI 2.98.2. This avoids the public ECR data limit on shared GitHub runners without adding hosted-project credentials or weakening test checks. The initial corrected runs passed 17 CRM checks and 16 booking checks. The recovery page adds browser checks for both invitation/recovery flows, replay rejection, password confirmation, unchanged ownership/roles, memory-only sessions, recovery bearer denial and fresh-password access for linked versus unlinked users.
