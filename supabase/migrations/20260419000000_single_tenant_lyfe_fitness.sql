-- ============================================================
-- Single-tenant collapse: Lyfe Fitness
-- ============================================================
-- Converts the multi-org schema into a single-tenant schema
-- for Lyfe Fitness. All existing data is preserved under the
-- first (lowest created_at) organization row, roles are
-- promoted onto app_users.role, and the organizations /
-- organization_memberships tables are dropped.
-- ============================================================

begin;

-- -------------------------------------------------------
-- 1. Create gym_settings singleton (replaces organizations)
-- -------------------------------------------------------
create table if not exists gym_settings (
  id        integer primary key default 1 check (id = 1),
  name      text not null default 'Lyfe Fitness',
  logo_url  text,
  address   text,
  phone     text,
  email     text,
  invitation_code text,
  updated_at timestamptz default now()
);

insert into gym_settings (id, name, logo_url, address, phone, email, invitation_code)
select
  1,
  'Lyfe Fitness',
  coalesce(logo_url, null),
  address,
  phone,
  email,
  invitation_code
from organizations
order by created_at asc
limit 1
on conflict (id) do nothing;

-- -------------------------------------------------------
-- 2. Promote highest membership role onto app_users.role
-- -------------------------------------------------------
with highest as (
  select
    user_id,
    case max(
      case role
        when 'owner' then 4
        when 'admin' then 3
        when 'coach' then 2
        else 1
      end
    )
      when 4 then 'owner'
      when 3 then 'admin'
      when 2 then 'coach'
      else 'member'
    end as role
  from organization_memberships
  group by user_id
)
update app_users u
  set role = highest.role,
      updated_at = now()
  from highest
  where u.id = highest.user_id
    and (
      u.role is null
      or (
        case highest.role
          when 'owner' then 4 when 'admin' then 3 when 'coach' then 2 else 1
        end
        >
        case u.role
          when 'owner' then 4 when 'admin' then 3 when 'coach' then 2 else 1
        end
      )
    );

-- -------------------------------------------------------
-- 3. Drop old RLS policies that join organization_memberships
--    (supabaseAdmin service-role bypasses RLS; these are
--     replaced by simpler member_id-scoped policies below)
-- -------------------------------------------------------
drop policy if exists organization_schedule_classes_membership_access on organization_schedule_classes;
drop policy if exists organization_members_member_access on organization_members;
drop policy if exists organization_memberships_self_access on organization_memberships;
drop policy if exists programming_tracks_membership_access on programming_tracks;
drop policy if exists programming_days_membership_access on programming_days;
drop policy if exists movement_library_membership_access on movement_library;
drop policy if exists movement_videos_membership_access on movement_videos;
drop policy if exists workout_blocks_membership_access on workout_blocks;
drop policy if exists benchmark_definitions_membership_access on benchmark_definitions;
drop policy if exists workout_results_membership_access on workout_results;
drop policy if exists member_movement_prs_membership_access on member_movement_prs;

-- RLS policies from program_builder migration
drop policy if exists programs_membership_access on public.programs;
drop policy if exists program_template_days_membership_access on public.program_template_days;
drop policy if exists program_template_blocks_membership_access on public.program_template_blocks;
drop policy if exists program_assignments_membership_access on public.program_assignments;

-- RLS policies from track_progressions migration
drop policy if exists track_progressions_membership_access on public.track_progressions;

-- RLS policies from payroll migration
drop policy if exists payroll_entries_membership_access on public.payroll_entries;
drop policy if exists payroll_entries_self_access on public.payroll_entries;

-- RLS policies from store migration
drop policy if exists store_products_membership_access on public.store_products;
drop policy if exists store_preorders_membership_access on public.store_preorders;
drop policy if exists store_orders_membership_access on public.store_orders;

-- RLS policies from stripe billing migration
drop policy if exists stripe_customers_membership_access on stripe_customers;
drop policy if exists stripe_subscriptions_membership_access on stripe_subscriptions;
drop policy if exists stripe_transactions_membership_access on stripe_transactions;

-- RLS policies from instagram migration
drop policy if exists instagram_oauth_tokens_org_access on instagram_oauth_tokens;
drop policy if exists instagram_posts_org_access on instagram_posts;
drop policy if exists instagram_insights_daily_org_access on instagram_insights_daily;

-- RLS policies from social_os_foundation migration
drop policy if exists social_org_settings_org_access on social_org_settings;
drop policy if exists social_accounts_org_access on social_accounts;
drop policy if exists social_posts_org_access on social_posts;
drop policy if exists social_campaigns_org_access on social_campaigns;
drop policy if exists social_assets_org_access on social_assets;
drop policy if exists social_asset_folders_org_access on social_asset_folders;
drop policy if exists social_content_pillars_org_access on social_content_pillars;
drop policy if exists social_conversations_org_access on social_conversations;
drop policy if exists social_inbox_assignments_org_access on social_inbox_assignments;
drop policy if exists social_activity_log_org_access on social_activity_log;
drop policy if exists social_ai_runs_org_access on social_ai_runs;
drop policy if exists social_planner_slots_org_access on social_planner_slots;
drop policy if exists social_post_metrics_daily_org_access on social_post_metrics_daily;
drop policy if exists social_account_metrics_daily_org_access on social_account_metrics_daily;
drop policy if exists social_comments_org_access on social_comments;
drop policy if exists social_google_photos_sources_org_access on social_google_photos_sources;
drop policy if exists social_google_photo_imports_org_access on social_google_photo_imports;

-- RLS from athlete_lift_logs migration
drop policy if exists athlete_lift_logs_org_access on athlete_lift_logs;
drop policy if exists athlete_lift_logs_member_access on athlete_lift_logs;

-- RLS from class_reservations migration
drop policy if exists organization_class_reservations_member_access on organization_class_reservations;

-- -------------------------------------------------------
-- 4. Drop organization_id from all domain tables (CASCADE
--    removes the FK constraint automatically)
-- -------------------------------------------------------
alter table if exists programming_tracks       drop column if exists organization_id cascade;
alter table if exists programming_days         drop column if exists organization_id cascade;
alter table if exists movement_library         drop column if exists organization_id cascade;
alter table if exists movement_videos          drop column if exists organization_id cascade;
alter table if exists workout_blocks           drop column if exists organization_id cascade;
alter table if exists benchmark_definitions    drop column if exists organization_id cascade;
alter table if exists workout_results          drop column if exists organization_id cascade;
alter table if exists member_movement_prs      drop column if exists organization_id cascade;
alter table if exists payroll_entries          drop column if exists organization_id cascade;
alter table if exists store_products           drop column if exists organization_id cascade;
alter table if exists store_preorders          drop column if exists organization_id cascade;
alter table if exists store_orders             drop column if exists organization_id cascade;
alter table if exists stripe_customers         drop column if exists organization_id cascade;
alter table if exists stripe_subscriptions     drop column if exists organization_id cascade;
alter table if exists stripe_transactions      drop column if exists organization_id cascade;
alter table if exists instagram_oauth_tokens   drop column if exists organization_id cascade;
alter table if exists instagram_posts          drop column if exists organization_id cascade;
alter table if exists instagram_insights_daily drop column if exists organization_id cascade;
alter table if exists social_accounts          drop column if exists organization_id cascade;
alter table if exists social_posts             drop column if exists organization_id cascade;
alter table if exists social_campaigns         drop column if exists organization_id cascade;
alter table if exists social_assets            drop column if exists organization_id cascade;
alter table if exists social_asset_folders     drop column if exists organization_id cascade;
alter table if exists social_content_pillars   drop column if exists organization_id cascade;
alter table if exists social_conversations     drop column if exists organization_id cascade;
alter table if exists social_inbox_assignments drop column if exists organization_id cascade;
alter table if exists social_activity_log      drop column if exists organization_id cascade;
alter table if exists social_ai_runs           drop column if exists organization_id cascade;
alter table if exists social_planner_slots     drop column if exists organization_id cascade;
alter table if exists social_post_metrics_daily       drop column if exists organization_id cascade;
alter table if exists social_account_metrics_daily    drop column if exists organization_id cascade;
alter table if exists social_comments          drop column if exists organization_id cascade;
alter table if exists social_google_photos_sources    drop column if exists organization_id cascade;
alter table if exists social_google_photo_imports     drop column if exists organization_id cascade;
alter table if exists public.programs                 drop column if exists organization_id cascade;
alter table if exists public.program_assignments      drop column if exists organization_id cascade;
alter table if exists public.program_template_blocks  drop column if exists organization_id cascade;
alter table if exists public.program_template_days    drop column if exists organization_id cascade;
alter table if exists athlete_lift_logs        drop column if exists organization_id cascade;
alter table if exists public.track_progressions drop column if exists organization_id cascade;

-- -------------------------------------------------------
-- 5. Handle social_org_settings: organization_id is PK
--    Add a new integer PK, drop org FK
-- -------------------------------------------------------
alter table if exists social_org_settings add column if not exists id integer default 1;
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'social_org_settings'
      and constraint_type = 'PRIMARY KEY'
  ) then
    execute 'alter table social_org_settings drop constraint social_org_settings_pkey';
  end if;
end$$;
update social_org_settings set id = 1;
alter table if exists social_org_settings add constraint social_org_settings_pkey primary key (id);
alter table if exists social_org_settings add constraint social_org_settings_singleton check (id = 1);
alter table if exists social_org_settings drop column if exists organization_id cascade;

-- -------------------------------------------------------
-- 6. Rename organization_members → members
--    Drop its organization_id and org-scoped unique index
-- -------------------------------------------------------
drop index if exists organization_members_org_email_key;
drop index if exists idx_org_members_last_check_in;
drop index if exists idx_org_members_last_active;

alter table if exists organization_members drop column if exists organization_id cascade;
alter table if exists organization_members rename to members;

create unique index if not exists members_email_key on members(email) where email is not null;
create index if not exists members_member_id_idx on members(member_id);
create index if not exists members_last_check_in_idx on members(last_check_in desc nulls last);
create index if not exists members_last_active_idx on members(last_active desc nulls last);

-- -------------------------------------------------------
-- 7. Rename organization_schedule_classes → schedule_classes
--    Drop its organization_id
-- -------------------------------------------------------
drop index if exists organization_schedule_classes_org_idx;

alter table if exists organization_schedule_classes drop column if exists organization_id cascade;
alter table if exists organization_schedule_classes rename to schedule_classes;

-- -------------------------------------------------------
-- 8. Rename organization_class_reservations → class_reservations
--    Drop its organization_id
-- -------------------------------------------------------
alter table if exists organization_class_reservations drop column if exists organization_id cascade;
alter table if exists organization_class_reservations rename to class_reservations;

-- -------------------------------------------------------
-- 9. Drop the multi-tenant tables (FKs already removed above)
-- -------------------------------------------------------
drop table if exists organization_memberships cascade;
drop table if exists organizations cascade;

-- -------------------------------------------------------
-- 10. Drop orphaned indexes that referenced organization_id
-- -------------------------------------------------------
drop index if exists organization_memberships_user_idx;
drop index if exists organization_memberships_org_idx;
drop index if exists programming_tracks_org_idx;
drop index if exists payroll_entries_org_week_idx;
drop index if exists programs_org_idx;

-- -------------------------------------------------------
-- 11. Add simple RLS policies for service-role passthrough
--     and member self-access on key tables.
--     (All server queries use supabaseAdmin service-role which
--      bypasses RLS. Mobile uses JWT-auth with these policies.)
-- -------------------------------------------------------

-- workout_results: members see own rows
drop policy if exists workout_results_member_access on workout_results;
create policy workout_results_member_access
  on workout_results
  for all
  using (
    member_id = (
      select id from app_users where email = auth.email() limit 1
    )
  );

-- athlete_lift_logs: members see own rows
drop policy if exists athlete_lift_logs_member_access on athlete_lift_logs;
create policy athlete_lift_logs_member_access
  on athlete_lift_logs
  for all
  using (
    member_id = (
      select id from app_users where email = auth.email() limit 1
    )
  );

-- members roster: members see own row
drop policy if exists members_self_access on members;
create policy members_self_access
  on members
  for select
  using (
    email = auth.email()
  );

commit;
