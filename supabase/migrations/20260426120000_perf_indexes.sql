-- Performance indexes for hot read paths.
--
-- nutrition_entries is queried on every nutrition page load by (day_id) and
-- ordered by created_at. The existing index covers only member_id, so daily
-- entry fetches currently fall back to a member_id index scan + filter.
create index if not exists nutrition_entries_day_created_idx
  on nutrition_entries (day_id, created_at);
