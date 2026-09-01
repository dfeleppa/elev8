## Lyfe Fitness

A full-stack gym management platform for Lyfe Fitness. Role-based access for members, coaches, admins, and owners — covering training, nutrition, class scheduling, payroll, and business analytics.

### Feature Highlights
- **Mission Stack:** Track priority work with live progress bars, tags, priority cues, and status pills.
- **Flow Map:** Timeline cards outline the protected deep-work windows, recovery blocks, and syncs.
- **Ritual Pulse:** Visualize systems health across calibration, movement, and recovery practices.
- **Habits Grid:** Seven-day habit rows with quick completion counts to reinforce streaks.
- **Signals + Blockers:** Lightweight journal cards to capture momentum spikes or friction.

### Tech Decisions
- Next.js App Router with TypeScript for structured data modeling.
- Tailwind CSS v4 utility pipeline plus custom glassmorphism helpers in `globals.css` for the neon-glow aesthetic.
- Custom font stack (Space Grotesk + JetBrains Mono) via `next/font` to keep typography intentional.

### Local Development
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Type-check and lint: `npm run lint`
4. Production build: `npm run build`

### Nutrition (Supabase, User-Scoped)
Nutrition data is stored in Supabase and is tied to the authenticated user account.

- `nutrition_days` stores day-level targets by `(member_id, day_date)`.
- `nutrition_entries` stores meal entries and is constrained to the same `member_id` as its parent day.
- API routes under `src/app/api/nutrition-*` resolve the logged-in user context before reading or writing records.
- File-based JSON nutrition storage is not used in this app.

### ChatGPT Nutrition MCP

The production MCP endpoint is `https://app.daneff.com/api/mcp/nutrition`. It uses MCP Streamable HTTP and OAuth 2.1 authorization-code flow with PKCE.

Required production environment variables:

```dotenv
MCP_PUBLIC_ORIGIN=https://app.daneff.com
MCP_OAUTH_SECRET=<dedicated-random-secret>
MCP_OAUTH_ALLOWED_REDIRECT_URIS=<exact-callback-url-shown-by-ChatGPT>
```

- Keep `MCP_PUBLIC_ORIGIN` canonical so discovery, authorization codes, access tokens, refresh tokens, and request verification all use the same issuer and resource identifier.
- Copy the exact redirect URI from ChatGPT's app-management page. Current callbacks are either callback-specific (`https://chatgpt.com/connector/oauth/{callback_id}`) or the stable redirect (`https://chatgpt.com/connector_platform_oauth_redirect`) when issuer identification is supported.
- `MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS` remains available for controlled local development, but production should use the exact URI allowlist.
- Request `offline_access` to receive a rotating refresh token. Read tools require `nutrition:read`; `manage_nutrition` requires `nutrition:read nutrition:write`.
- The legacy `AGENT_NUTRITION_TOKEN` bearer header remains available for trusted Codex/local clients. Query-string tokens are rejected.

To validate before deployment:

1. Run `npm test -- src/lib/mcp-oauth.test.ts src/app/api/mcp/nutrition/route.test.ts src/lib/nutrition-mcp.test.ts`.
2. Run `npx @modelcontextprotocol/inspector`, select Streamable HTTP, and connect to the local `/api/mcp/nutrition` endpoint using OAuth.
3. Confirm initialization, tool metadata, read-only calls, insufficient-scope reauthorization, preview-before-execute behavior, refresh rotation, and rejection of a token bound to another resource.
4. In ChatGPT web Developer Mode, create or refresh the app and scan the tools again after metadata changes.

Custom MCP apps are currently supported on ChatGPT web, not in the native ChatGPT iOS app.

### Project Structure
- `src/app/page.tsx` hosts the entire dashboard layout with typed data models.
- `src/app/layout.tsx` wires up fonts and metadata.
- `src/app/globals.css` defines the gradient background, glass panels, and motion helpers.

Feel free to adjust the mock data in `page.tsx` to connect live sources or expand the UI with additional sections.

### Native iOS nutrition (SwiftUI)

`Elev8Nutrition/` is a native SwiftUI iPhone app that signs into the same Supabase project as this web app and reads/writes `nutrition_days`, `nutrition_entries`, and `nutrition_custom_foods`. Open `Elev8Nutrition/Elev8Nutrition.xcodeproj`, copy `Config.local.xcconfig.example` to `Config.local.xcconfig`, and set `SUPABASE_URL` / `SUPABASE_ANON_KEY` (same values as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### Fuelwise adaptive coach

`fuelwise/` contains the native SwiftUI Fuelwise app and its Sites backend as one product boundary. The iOS app reads nutrition history from the hosted API, syncs Apple Health energy/body metrics, groups foods by meal, and performs seven-day check-in analysis. See `fuelwise/README.md` for local credential and build setup.
