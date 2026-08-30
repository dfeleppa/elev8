# Elev8Nutrition

Native SwiftUI iPhone app that talks to Daniel Feleppa's existing Elev8 Supabase project. It reuses `nutrition_days`, `nutrition_entries`, and `nutrition_custom_foods` from `supabase.sql`. No new tables.

The client uses **Supabase Auth** plus the **anon key**. It resolves `auth.uid()` to the existing `app_users.id` through `mobile_app_user_id()`, and Row Level Security scopes nutrition rows to that linked member ID. The service-role key must never ship in this app.

## Screens

- **Sign in / Sign up** — email + password against Supabase Auth
- **Google sign-in** — Supabase Google OAuth with a PKCE system-browser flow
- **Today** — date navigation, large calorie totals vs targets, remaining macros, meals (breakfast / lunch / dinner / snack), add / edit / delete entries
- **Fast log** — search custom foods, tap one, pick a meal, log it onto the selected day
- **Foods** — search and add custom foods (`nutrition_custom_foods`)
- **Settings** — write calorie / protein / carbs / fat targets onto `nutrition_days` for the date selected in Today, plus sign out

## Requirements

- Xcode 15 or later
- iOS 17+
- iPhone (portrait)
- [supabase-swift](https://github.com/supabase/supabase-swift) 2.x (SPM, product `Supabase`)

## Configure Supabase

1. Copy values from the web app env (`.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Either edit `Elev8Nutrition/Config.xcconfig` or copy `Elev8Nutrition/Config.local.xcconfig.example` to `Elev8Nutrition/Config.local.xcconfig` (gitignored).
3. xcconfig treats `//` as a comment. Keep the `$()` split in the URL:

```
NEXT_PUBLIC_SUPABASE_URL = https:/$()/YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
```

Those build settings are expanded into `Info.plist` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`. `AppEnvironment` reads them at runtime.

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` anywhere in this target.

## Open in Xcode

1. Open `Elev8Nutrition.xcodeproj`.
2. Wait for SPM to resolve `supabase-swift`.
3. Select an iPhone simulator or device and run.

For Google sign-in, enable Google under Supabase Auth providers and add
`elev8nutrition://auth-callback` to the Supabase redirect URL allow list.

If the first launch shows “Supabase not configured”, the placeholders in `Config.xcconfig` are still in place.

## Data model (existing)

| Table | Role |
| --- | --- |
| `nutrition_days` | One row per `(member_id, day_date)` with calorie / protein / carbs / fat targets |
| `nutrition_entries` | Meal rows keyed by `day_id` + `member_id`. `meal_type` is `breakfast`, `lunch`, `dinner`, or `snack` |
| `nutrition_custom_foods` | Per-member reusable foods used by Fast log |

Creating an entry upserts the parent day first so the `(day_id, member_id)` foreign key is satisfied.

Swift field names match the web nutrition API (`src/app/api/nutrition-days`, `nutrition-entries`, `foods`) and the snake_case columns in PostgREST.
