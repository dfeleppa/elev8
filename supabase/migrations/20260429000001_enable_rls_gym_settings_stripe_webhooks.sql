-- Enable RLS on tables exposed via PostgREST.
-- Both tables are accessed exclusively by server-side code using the
-- service-role client (which bypasses RLS), so no policies are required.
-- This locks out anon/authenticated roles, addressing advisor lint
-- 0013_rls_disabled_in_public.

alter table public.gym_settings enable row level security;
alter table public.stripe_webhook_events enable row level security;
