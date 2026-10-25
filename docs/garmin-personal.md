# Garmin Personal

Private, read-only Garmin integration at `/member/garmin`, linked from the bound user's athlete dashboard and Owner → Integrations. It reads Garmin directly; it does not insert or duplicate Lyfe workout/health records. No migration or new dependency is required.

## Configuration

Set these **server-only** variables on the Lyfe application’s Vercel project (a value on `garmin-chatgpt` is not automatically shared):

- `GARMIN_PERSONAL_API_KEY`: existing Garmin Personal API key.
- `GARMIN_PERSONAL_MEMBER_ID`: the key owner's `app_users.id`. An owner can visit `/member/garmin` before configuration to see their own ID. Do not use a Supabase Auth UID here.

Redeploy after changing variables. Set them separately for each environment where this feature should work. For local development, put them in gitignored `.env.local` alongside the normal application configuration. Never use `NEXT_PUBLIC_` or paste credentials into source code.

No automatic owner-role fallback: an authenticated session must match the explicit member binding. Other users, including other owners and coaches, cannot read the data. Removing the binding disables access. Rotate expired keys in Vercel; Garmin key revocation invalidates its associated access tokens.

## API

`GET /api/garmin?resource=daily&start_date=2026-10-18&end_date=2026-10-24`

Uses the existing web-session authentication. Responses use `Cache-Control: private, no-store`. Resource allowlist:

| Resource | Parameters |
| --- | --- |
| `daily`, `sleep`, `hrv`, `body-battery`, `steps` | `start_date`, `end_date` (valid YYYY-MM-DD; inclusive maximum 31 days) |
| `activities` | Same dates; `start` offset 0–10000 and `limit` 1–50 (default 20) |
| `activity` | `activity_id` (numeric string) |
| `heart-rate` | `date` |

Success: `{ source, data, fetchedAt }`, preserving Garmin's resource-specific JSON. Missing readings remain missing/null, never zero. Errors use `{ error }`: 400 for invalid input, 401 for no session, 403 for wrong member, 503 for missing configuration, 429 for rate limiting, 502 for upstream failures. Raw provider errors and credentials are not returned.

The dashboard displays selected-day metrics and seven days of paginated activities. Calendar dates follow the Garmin account timezone; the initial date uses America/New_York for this account. Each resource can fail independently. The server caches only the short-lived token in memory, coalesces simultaneous token exchanges, and retries one rejected access token. There is no persistent health-data cache or background sync.

## Sources and verification

- [Garmin Personal API](https://developer.garmin.com/gc-developer-program/personal/personal-api/)
- [Garmin Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/)
- Paths and payload shapes verified against the existing Garmin Personal connector, including its plain-text JWT token exchange fix.

Run `npx vitest run src/lib/garmin-data.test.ts src/lib/garmin-personal.test.ts src/app/api/garmin/route.test.ts`, then `npm run build`. After deployment, sign in as the bound member, open Garmin, refresh, select a prior date, and page activities. Verify another login receives 403 from the API. Live API calls require the actual environment key; mocked tests alone do not prove deployment configuration.

## Production verification — 2026-10-25

Deployed to the existing `daneff` project at `https://app.daneff.com/member/garmin` from the local working tree. The production key and explicit member binding are configured in Vercel.

- Verified with the owner's existing in-app browser session: dashboard rendering, date changes, manual refresh, daily wellness, sleep, HRV, and activity history.
- Separately verified live activity pagination, activity detail, steps, Body Battery, and heart-rate API resources.
- Signed-out HTTP request returned JSON 401 with `Cache-Control: private, no-store`.
- New deployment runtime error scan returned no errors during verification.
- Cross-member denial remains covered by automated tests; no second user's live session was used.
- Added explicit deployment exclusions for local secrets, scratch files, and the separate mobile/Fuelwise products. Fixed the date input to use theme-aware colors after checking light mode.
