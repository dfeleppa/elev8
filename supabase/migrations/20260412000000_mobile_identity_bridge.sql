-- Mobile Identity Bridge
--
-- Problem: the web app creates app_users rows via NextAuth (no Supabase Auth),
-- so app_users.id is a plain gen_random_uuid() that has nothing to do with
-- auth.uid().  The mobile app authenticates via Supabase Auth, so its
-- auth.uid() is a completely different UUID.
--
-- Every RLS policy that compares member_id/user_id/coach_id = auth.uid()
-- therefore blocks all mobile access, and every repository query that sends
-- .eq('member_id', user.id) returns no rows.
--
-- Fix:
--   1. Add supabase_auth_uid column to app_users so mobile logins can record
--      their Supabase Auth UID alongside the existing row.
--   2. Create mobile_app_user_id() helper that maps auth.uid() → app_users.id
--      (with a COALESCE fallback to auth.uid() itself, which keeps the door
--      open for a future where app_users.id = auth.uid() directly).
--   3. Recreate every RLS policy that used auth.uid() to use
--      mobile_app_user_id() instead.

-- ─── 1. supabase_auth_uid column ────────────────────────────────────────────

alter table public.app_users
  add column if not exists supabase_auth_uid uuid unique;

create index if not exists app_users_supabase_auth_uid_idx
  on public.app_users (supabase_auth_uid)
  where supabase_auth_uid is not null;

-- ─── 2. Helper function ──────────────────────────────────────────────────────

create or replace function public.mobile_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- Mobile path: resolve Supabase Auth UID → app_users.id
    (select id from public.app_users where supabase_auth_uid = auth.uid() limit 1),
    -- Direct path: auth.uid() IS the app_users.id (future-proof)
    auth.uid()
  );
$$;

-- ─── 3. Recreate RLS policies ────────────────────────────────────────────────

-- organization_memberships ────────────────────────────────────────────────────
-- (may not have had a policy before; adding one so mobile can read its own row)
alter table if exists public.organization_memberships enable row level security;

drop policy if exists organization_memberships_self_read on public.organization_memberships;
create policy organization_memberships_self_read
  on public.organization_memberships
  for select to authenticated
  using (user_id = public.mobile_app_user_id());

drop policy if exists organization_memberships_admin_all on public.organization_memberships;
create policy organization_memberships_admin_all
  on public.organization_memberships
  for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m2
      where m2.organization_id = public.organization_memberships.organization_id
        and m2.user_id = public.mobile_app_user_id()
        and m2.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m2
      where m2.organization_id = public.organization_memberships.organization_id
        and m2.user_id = public.mobile_app_user_id()
        and m2.role in ('admin', 'owner')
    )
  );

-- nutrition_days ──────────────────────────────────────────────────────────────
alter table if exists public.nutrition_days enable row level security;

drop policy if exists nutrition_days_member_access on public.nutrition_days;
create policy nutrition_days_member_access
  on public.nutrition_days
  for all to authenticated
  using (member_id = public.mobile_app_user_id())
  with check (member_id = public.mobile_app_user_id());

-- nutrition_entries ───────────────────────────────────────────────────────────
alter table if exists public.nutrition_entries enable row level security;

drop policy if exists nutrition_entries_member_access on public.nutrition_entries;
create policy nutrition_entries_member_access
  on public.nutrition_entries
  for all to authenticated
  using (member_id = public.mobile_app_user_id())
  with check (member_id = public.mobile_app_user_id());

-- nutrition_custom_foods ──────────────────────────────────────────────────────
drop policy if exists nutrition_custom_foods_member_access on public.nutrition_custom_foods;
create policy nutrition_custom_foods_member_access
  on public.nutrition_custom_foods
  for all to authenticated
  using (member_id = public.mobile_app_user_id())
  with check (member_id = public.mobile_app_user_id());

-- health_stat_entries ─────────────────────────────────────────────────────────
alter table if exists public.health_stat_entries enable row level security;

drop policy if exists health_stat_entries_member_access on public.health_stat_entries;
create policy health_stat_entries_member_access
  on public.health_stat_entries
  for all to authenticated
  using (member_id = public.mobile_app_user_id())
  with check (member_id = public.mobile_app_user_id());

-- coach_nutrition_plans ───────────────────────────────────────────────────────
drop policy if exists coach_nutrition_plans_coach_access on public.coach_nutrition_plans;
create policy coach_nutrition_plans_coach_access
  on public.coach_nutrition_plans
  for all to authenticated
  using (
    coach_id = public.mobile_app_user_id()
    or exists (
      select 1
      from public.organization_memberships m
      join public.app_users u on u.id = public.coach_nutrition_plans.member_id
      where m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    coach_id = public.mobile_app_user_id()
    or exists (
      select 1
      from public.organization_memberships m
      join public.app_users u on u.id = public.coach_nutrition_plans.member_id
      where m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner')
    )
  );

drop policy if exists coach_nutrition_plans_member_read on public.coach_nutrition_plans;
create policy coach_nutrition_plans_member_read
  on public.coach_nutrition_plans
  for select to authenticated
  using (member_id = public.mobile_app_user_id());

-- payroll_entries ─────────────────────────────────────────────────────────────
drop policy if exists payroll_entries_owner_access on public.payroll_entries;
create policy payroll_entries_owner_access
  on public.payroll_entries
  for all to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = public.payroll_entries.organization_id
        and m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = public.payroll_entries.organization_id
        and m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner')
    )
  );

-- athlete_lift_logs ───────────────────────────────────────────────────────────
drop policy if exists athlete_lift_logs_member_access on public.athlete_lift_logs;
create policy athlete_lift_logs_member_access
  on public.athlete_lift_logs
  for all to authenticated
  using (member_id = public.mobile_app_user_id())
  with check (member_id = public.mobile_app_user_id());

drop policy if exists athlete_lift_log_sets_member_access on public.athlete_lift_log_sets;
create policy athlete_lift_log_sets_member_access
  on public.athlete_lift_log_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.athlete_lift_logs l
      where l.id = log_id and l.member_id = public.mobile_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.athlete_lift_logs l
      where l.id = log_id and l.member_id = public.mobile_app_user_id()
    )
  );

-- organization_schedule_classes ───────────────────────────────────────────────
drop policy if exists organization_schedule_classes_membership_access on public.organization_schedule_classes;
create policy organization_schedule_classes_membership_access
  on public.organization_schedule_classes
  for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.organization_schedule_classes.organization_id
        and m.user_id = public.mobile_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.organization_schedule_classes.organization_id
        and m.user_id = public.mobile_app_user_id()
    )
  );

-- organization_class_reservations ─────────────────────────────────────────────
drop policy if exists organization_class_reservations_member_access on public.organization_class_reservations;
create policy organization_class_reservations_member_access
  on public.organization_class_reservations
  for all to authenticated
  using (
    member_id = public.mobile_app_user_id()
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.organization_class_reservations.organization_id
        and m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner', 'coach')
    )
  )
  with check (
    member_id = public.mobile_app_user_id()
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.organization_class_reservations.organization_id
        and m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner', 'coach')
    )
  );

-- track_progressions ──────────────────────────────────────────────────────────
drop policy if exists track_progressions_select on public.track_progressions;
create policy track_progressions_select on public.track_progressions
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = public.mobile_app_user_id()
  ));

drop policy if exists track_progressions_write on public.track_progressions;
create policy track_progressions_write on public.track_progressions
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

drop policy if exists track_progression_weeks_access on public.track_progression_weeks;
create policy track_progression_weeks_access on public.track_progression_weeks
  for all to authenticated
  using (exists (
    select 1 from public.track_progressions tp
    join public.organization_memberships m on m.organization_id = tp.organization_id
    where tp.id = public.track_progression_weeks.progression_id
      and m.user_id = public.mobile_app_user_id()
  ))
  with check (exists (
    select 1 from public.track_progressions tp
    join public.organization_memberships m on m.organization_id = tp.organization_id
    where tp.id = public.track_progression_weeks.progression_id
      and m.user_id = public.mobile_app_user_id()
  ));

-- programs ────────────────────────────────────────────────────────────────────
drop policy if exists programs_member_read on public.programs;
create policy programs_member_read on public.programs
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = public.mobile_app_user_id()
  ));

drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

-- program_template_days ───────────────────────────────────────────────────────
drop policy if exists program_template_days_member_read on public.program_template_days;
create policy program_template_days_member_read on public.program_template_days
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = public.mobile_app_user_id()
  ));

drop policy if exists program_template_days_admin_write on public.program_template_days;
create policy program_template_days_admin_write on public.program_template_days
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

-- program_template_blocks ─────────────────────────────────────────────────────
drop policy if exists program_template_blocks_member_read on public.program_template_blocks;
create policy program_template_blocks_member_read on public.program_template_blocks
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = public.mobile_app_user_id()
  ));

drop policy if exists program_template_blocks_admin_write on public.program_template_blocks;
create policy program_template_blocks_admin_write on public.program_template_blocks
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

-- program_lift_progressions ───────────────────────────────────────────────────
drop policy if exists program_lift_progressions_access on public.program_lift_progressions;
create policy program_lift_progressions_access on public.program_lift_progressions
  for all to authenticated
  using (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_lift_progressions.program_id
      and m.user_id = public.mobile_app_user_id()
  ))
  with check (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_lift_progressions.program_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

-- program_conditioning_progressions ───────────────────────────────────────────
drop policy if exists program_conditioning_progressions_access on public.program_conditioning_progressions;
create policy program_conditioning_progressions_access on public.program_conditioning_progressions
  for all to authenticated
  using (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_conditioning_progressions.program_id
      and m.user_id = public.mobile_app_user_id()
  ))
  with check (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_conditioning_progressions.program_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));

-- program_assignments ─────────────────────────────────────────────────────────
drop policy if exists program_assignments_access on public.program_assignments;
create policy program_assignments_access on public.program_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.program_assignments.organization_id
        and m.user_id = public.mobile_app_user_id()
        and m.role in ('admin', 'owner', 'coach')
    )
    or assigned_member_id = public.mobile_app_user_id()
  )
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_assignments.organization_id
      and m.user_id = public.mobile_app_user_id()
      and m.role in ('admin', 'owner')
  ));
