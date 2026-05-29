-- ============================================================
-- Drop orphaned multi-tenant organization_* tables
-- ============================================================
-- The single-tenant collapse (20260419000000) removed the core
-- organizations / membership tables, but these 8 legacy tables
-- from the original multi-tenant design were never cleaned up.
-- All are empty (0 rows), have no incoming foreign keys, and are
-- not referenced anywhere in the application code.
-- ============================================================

begin;

drop table if exists organization_billing_accounts cascade;
drop table if exists organization_integrations cascade;
drop table if exists organization_member_profiles cascade;
drop table if exists organization_membership_tiers cascade;
drop table if exists organization_payroll_runs cascade;
drop table if exists organization_schedule_events cascade;
drop table if exists organization_staff cascade;
drop table if exists organization_tracks cascade;

commit;
