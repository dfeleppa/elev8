-- Enable RLS on payroll_entries
alter table public.payroll_entries enable row level security;

drop policy if exists payroll_entries_owner_access on public.payroll_entries;
create policy payroll_entries_owner_access
  on public.payroll_entries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = public.payroll_entries.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = public.payroll_entries.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

-- Enable RLS on coach_nutrition_plans
alter table public.coach_nutrition_plans enable row level security;

-- Coaches (and admins/owners) can manage plans they created
drop policy if exists coach_nutrition_plans_coach_access on public.coach_nutrition_plans;
create policy coach_nutrition_plans_coach_access
  on public.coach_nutrition_plans
  for all
  to authenticated
  using (
    coach_id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships m
      join public.app_users u on u.id = public.coach_nutrition_plans.member_id
      where m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    coach_id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships m
      join public.app_users u on u.id = public.coach_nutrition_plans.member_id
      where m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

-- Members can read their own nutrition plan
drop policy if exists coach_nutrition_plans_member_read on public.coach_nutrition_plans;
create policy coach_nutrition_plans_member_read
  on public.coach_nutrition_plans
  for select
  to authenticated
  using (member_id = auth.uid());
