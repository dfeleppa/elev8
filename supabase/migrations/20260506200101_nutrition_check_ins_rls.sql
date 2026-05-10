-- Enable RLS on nutrition_check_ins without breaking the existing
-- server-side service-role flows. Members can read only their own
-- check-ins, while coaches/admins/owners can review and update them.

alter table public.nutrition_check_ins enable row level security;

create or replace function public.mobile_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where id = public.mobile_app_user_id()
  limit 1;
$$;

drop policy if exists nutrition_check_ins_member_read on public.nutrition_check_ins;
create policy nutrition_check_ins_member_read
  on public.nutrition_check_ins
  for select
  to authenticated
  using (member_id = public.mobile_app_user_id());

drop policy if exists nutrition_check_ins_staff_read on public.nutrition_check_ins;
create policy nutrition_check_ins_staff_read
  on public.nutrition_check_ins
  for select
  to authenticated
  using (coalesce(public.mobile_app_user_role(), 'member') in ('coach', 'admin', 'owner'));

drop policy if exists nutrition_check_ins_staff_update on public.nutrition_check_ins;
create policy nutrition_check_ins_staff_update
  on public.nutrition_check_ins
  for update
  to authenticated
  using (coalesce(public.mobile_app_user_role(), 'member') in ('coach', 'admin', 'owner'))
  with check (coalesce(public.mobile_app_user_role(), 'member') in ('coach', 'admin', 'owner'));
