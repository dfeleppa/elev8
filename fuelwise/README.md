# Fuelwise

Fuelwise is the adaptive nutrition coach inside the Elev8 monorepo. It consists of:

- `ios/`: the native SwiftUI iPhone app, including Apple Health integration.
- `site-web/`: the hosted Sites API, database migrations, and companion web experience.
- `www/`: the minimal Capacitor fallback bundle retained by the iOS project.

## Native iOS development

1. Copy `ios/App/App/Config.local.xcconfig.example` to `ios/App/App/Config.local.xcconfig` and supply the two local credentials.
2. Run `npm install` from this directory.
3. Run `cd ios/App && pod install`.
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

The local config is ignored by Git. Do not place Sites, mobile-sync, Supabase, or OpenAI credentials in Swift source or committed configuration.

## Sites backend

The existing Sites project identity is retained in `site-web/.openai/hosting.json`. From `site-web/`:

```bash
npm install
npm run build
```

Database changes require a generated and reviewed Drizzle migration before publishing.
