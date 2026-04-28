# Environment Variables

The mobile app reads its configuration from `elev8_mobile/.env`, which is
bundled as a Flutter asset (see `pubspec.yaml`). The file is gitignored.

## Required

| Key                  | Example                                       | Notes                                                                 |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`       | `https://xxxxxxx.supabase.co`                 | Same value the web app uses.                                          |
| `SUPABASE_ANON_KEY`  | `eyJhbGc...`                                  | Public anon key. Safe to ship — RLS is the real gate.                 |
| `WEB_APP_URL`        | `https://www.example.com`                     | Base URL for the web Next.js API (`/api/coach/...`, `/api/athlete/...`). |

If any of these are missing or empty the app throws on startup
(`StateError`) instead of silently defaulting. See `lib/config/env.dart`.

## Optional

| Key                       | Default                                         | Notes                                       |
| ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `SUPABASE_REDIRECT_URI`   | `io.supabase.flutter://login-callback`          | Must match the Supabase OAuth redirect list and the iOS / Android intent-filter. |

## Setup

```bash
cd elev8_mobile
cp ENV_VARIABLES.example .env  # if a template exists, otherwise create it
# Fill in the three required values above.
```

Anything in `.env` ships inside the IPA/APK, so only put public values
here. Service-role keys, OAuth secrets, etc. must stay on the server.
