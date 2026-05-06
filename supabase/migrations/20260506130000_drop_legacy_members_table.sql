-- Drop the legacy members table.
-- The 2026-05-06 unify migration copied every roster column into app_users
-- and backfilled. All read sites now query app_users (filtered by role='member').
-- Nothing writes to members and no foreign keys reference it.

drop table if exists public.members cascade;
