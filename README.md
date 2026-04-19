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

### Project Structure
- `src/app/page.tsx` hosts the entire dashboard layout with typed data models.
- `src/app/layout.tsx` wires up fonts and metadata.
- `src/app/globals.css` defines the gradient background, glass panels, and motion helpers.

Feel free to adjust the mock data in `page.tsx` to connect live sources or expand the UI with additional sections.
