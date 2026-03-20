# Required environment variables for elev8_mobile

Copy this file to `.env` and fill in your actual values.

## Supabase
- `SUPABASE_URL`: Your Supabase project URL (e.g., https://abcde.supabase.co)
- `SUPABASE_ANON_KEY`: Your Supabase anon/public key

## Google OAuth (configured in Supabase dashboard)
- Ensure Google OAuth provider is enabled in Supabase Auth settings.
- The redirect URI should be: `io.supabase.flutter://login-callback` (default) or specify a custom one.

Optional: set `SUPABASE_REDIRECT_URI` to override the default.
