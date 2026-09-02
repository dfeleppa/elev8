# Fuelwise

Fuelwise is the native SwiftUI adaptive nutrition coach inside the Elev8 monorepo.

Its iPhone app lives in `ios/` and uses the existing Elev8 Supabase project directly:

- Supabase Auth links the signed-in identity to `app_users` through `mobile_app_user_id()`.
- Nutrition reads and writes use `nutrition_days`, `nutrition_entries`, `nutrition_custom_foods`, and `coach_nutrition_plans`.
- Apple Health and body-composition sync use `health_stat_entries`.
- Existing row-level security scopes every client operation to the linked member.

Fuelwise has no Cloudflare D1 or ChatGPT Sites runtime dependency.

## Native iOS development

1. Copy `ios/App/App/Config.local.xcconfig.example` to `ios/App/App/Config.local.xcconfig` and supply the Supabase URL and publishable/anon key.
2. Run `npm install` from this directory only when the Capacitor iOS shell dependencies need refreshing.
3. Run `cd ios/App && pod install` when Pods need refreshing.
4. Build from this directory with:

   ```bash
   xcodebuild \
     -workspace ios/App/App.xcworkspace \
     -scheme App \
     -configuration Debug \
     -xcconfig ios/App/App/Config.local.xcconfig \
     -destination 'generic/platform=iOS' \
     ENABLE_USER_SCRIPT_SANDBOXING=NO \
     build
   ```

The local config is ignored by Git. Never place a Supabase service-role key or other server credential in Swift source or committed configuration.
