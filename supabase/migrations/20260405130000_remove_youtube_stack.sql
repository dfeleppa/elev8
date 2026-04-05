-- Remove legacy YouTube integration objects now that content is Instagram/Facebook-only.
-- Safe to run in environments where objects may already be absent.

-- Drop explicit RLS policies first for clarity in case tables still exist.
drop policy if exists youtube_oauth_tokens_member_access on youtube_oauth_tokens;
drop policy if exists youtube_metrics_member_access on youtube_metrics;

-- Drop legacy tables (indexes and constraints are removed automatically).
drop table if exists youtube_metrics;
drop table if exists youtube_oauth_tokens;

-- Defensive cleanup for old index names if tables were previously altered.
drop index if exists youtube_oauth_tokens_member_channel_idx;
drop index if exists youtube_metrics_member_period_idx;
