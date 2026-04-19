# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run Vitest tests
npm run import:workouts      # Import workout data from CSV
npm run import:workouts:dry  # Dry run (preview only)
```

## Architecture Overview

**Lyfe Fitness** is a full-stack Next.js (App Router) single-tenant gym management platform with role-based access control.

### Tech Stack
- **Framework**: Next.js 16 with App Router, React 19, TypeScript 5
- **Database**: Supabase (PostgreSQL) — admin client in `src/lib/supabase-admin.ts`
- **Auth**: NextAuth.js v4 with Google OAuth, JWT sessions — config in `src/lib/auth.ts`
- **Styling**: Tailwind CSS v4 (PostCSS plugin only, no separate config file)
- **Fonts**: Space Grotesk (headings), Manrope (body) via `next/font`

### Role Hierarchy & Routing
Users have roles: `member → coach → admin → owner`. Role resolution lives in `src/lib/member.ts` (`requireUserContext()` — server-only). Every API route calls this at the start to authenticate and resolve the user's role.

Routes are organized by role:
- `/owner/` — owner-only tools
- `/admin/` — admin features
- `/coach/` — coach features
- `/member/` — athlete/member views

### Navigation Shell
`src/components/SidebarShell.tsx` is the unified client-side shell wrapping all pages. It handles sidebar navigation, view-mode toggling (gym vs athlete), and role-based menu rendering.

### Key Libraries (`src/lib/`)
| File | Purpose |
|------|---------|
| `member.ts` | `requireUserContext()` — auth + role resolution for API routes |
| `supabase-admin.ts` | Supabase service-role client (server-only) |
| `auth.ts` | NextAuth config |
| `nutrition-calculations.ts` | Macro/calorie math |
| `coach-plan.ts` | Coach nutrition plan logic |
| `programming.ts` | Workout block utilities |
| `instagram.ts` | Instagram/Facebook Graph API + publishing |
| `agent-auth.ts` | Token auth for external agent integrations |

### API Patterns
- All API routes under `src/app/api/` use method-based handlers (GET/POST/PUT/DELETE in the same file)
- Call `requireUserContext()` first for auth; return 401/403 otherwise
- Use the Supabase admin client for all DB operations
- Error responses: `{ error: string }` with appropriate HTTP status

### Data Fetching
No SWR or React Query — client components use plain `fetch()`. No global state manager — local `useState`/`useEffect` only.

### UI Design System
Defined in `src/app/globals.css`:
- Dark glassmorphic theme with neon accents: pink `#ffb1c4`, cyan `#63f7ff`
- Reusable CSS classes: `.glass-panel`, `.app-card`, `.app-table-shell`, `.card-fade-in`
- All design tokens as CSS custom properties (`--color-*`, `--shadow-*`)

### Database Migrations
Supabase migrations in `/supabase/migrations/`. Run via Supabase CLI, not npm scripts.

### Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `CRON_SECRET`
- `AGENT_MEMBER_ID`, `AGENT_NUTRITION_TOKEN`

### Deployment
Vercel-native. Cron job defined in `vercel.json`: `/api/cron/instagram-publish` runs every 15 minutes.

### Mobile
`/elev8_mobile/` is a separate Flutter/Dart project — not part of the Next.js build.
