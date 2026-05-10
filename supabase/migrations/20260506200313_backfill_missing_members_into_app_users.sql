-- Retire the stale pre-single-tenant email trigger and fill in roster
-- members that do not yet have an app_users row. Keep existing app_users
-- data authoritative where it already exists.

drop trigger if exists app_users_reject_organization_member_email on public.app_users;
drop function if exists public.prevent_app_user_email_if_organization_member_exists();

insert into public.app_users (
  email,
  full_name,
  first_name,
  last_name,
  membership,
  last_check_in,
  mrr,
  created_at,
  updated_at,
  role,
  status,
  tracks,
  last_active,
  phone,
  gender,
  address,
  birth_date,
  tags,
  attendance_count,
  status_notes
)
select
  lower(trim(m.email)) as email,
  nullif(concat_ws(' ', nullif(trim(m.first_name), ''), nullif(trim(m.last_name), '')), '') as full_name,
  m.first_name,
  m.last_name,
  m.membership,
  m.last_check_in,
  m.mrr,
  coalesce(m.created_at, now()) as created_at,
  now() as updated_at,
  coalesce(nullif(m.role, ''), 'member') as role,
  m.status,
  m.tracks,
  m.last_active,
  m.phone,
  m.gender,
  m.address,
  m.birth_date,
  m.tags,
  m.attendance_count,
  m.status_notes
from public.members m
where nullif(lower(trim(m.email)), '') is not null
on conflict (email) do update
set
  full_name = coalesce(public.app_users.full_name, excluded.full_name),
  first_name = coalesce(public.app_users.first_name, excluded.first_name),
  last_name = coalesce(public.app_users.last_name, excluded.last_name),
  membership = coalesce(public.app_users.membership, excluded.membership),
  last_check_in = coalesce(public.app_users.last_check_in, excluded.last_check_in),
  mrr = coalesce(public.app_users.mrr, excluded.mrr),
  status = coalesce(public.app_users.status, excluded.status),
  tracks = coalesce(public.app_users.tracks, excluded.tracks),
  last_active = coalesce(public.app_users.last_active, excluded.last_active),
  phone = coalesce(public.app_users.phone, excluded.phone),
  gender = coalesce(public.app_users.gender, excluded.gender),
  address = coalesce(public.app_users.address, excluded.address),
  birth_date = coalesce(public.app_users.birth_date, excluded.birth_date),
  tags = coalesce(public.app_users.tags, excluded.tags),
  attendance_count = coalesce(public.app_users.attendance_count, excluded.attendance_count),
  status_notes = coalesce(public.app_users.status_notes, excluded.status_notes),
  updated_at = now();
