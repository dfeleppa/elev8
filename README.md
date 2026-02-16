## Elev8 Control Center

A personal operating system that blends a dashboard, task manager, and ritual tracker. The single-page experience is purpose-built for fast daily calibration—review focus signals, scan priority tasks, and protect recovery habits without hopping between tools.

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

### YouTube Analytics (Supabase + OAuth)
This project includes a YouTube analytics pipeline that stores last-30-days metrics in Supabase.

**Required environment variables**
- `NEXT_PUBLIC_APP_URL` (absolute URL, e.g. `https://daneff.com`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI` (optional override)
- `CRON_SECRET` (optional; use to protect the cron route locally or in non-Vercel environments)

**Supabase schema**
- Run the SQL in `supabase.sql` to create `youtube_oauth_tokens` and `youtube_metrics`.

**OAuth flow**
- Visit `/api/oauth/youtube/start` once to connect your channel.
- The callback stores the refresh token in Supabase and redirects to `/content`.

**Cron refresh**
- `/api/cron/youtube` pulls last-30-days metrics and upserts them into Supabase.
- Vercel Cron will call the route if configured in `vercel.json`.

### Project Structure
- `src/app/page.tsx` hosts the entire dashboard layout with typed data models.
- `src/app/layout.tsx` wires up fonts and metadata.
- `src/app/globals.css` defines the gradient background, glass panels, and motion helpers.

Feel free to adjust the mock data in `page.tsx` to connect live sources or expand the UI with additional sections.
