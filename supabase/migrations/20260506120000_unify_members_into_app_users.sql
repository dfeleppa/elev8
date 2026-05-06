-- Unify roster + auth identity on app_users.
-- Adds legacy members fields to app_users and backfills from members by email.

alter table if exists public.app_users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists membership text,
  add column if not exists last_check_in timestamptz,
  add column if not exists mrr numeric,
  add column if not exists status text,
  add column if not exists tracks text,
  add column if not exists last_active timestamptz,
  add column if not exists phone text,
  add column if not exists gender text,
  add column if not exists address text,
  add column if not exists tags text,
  add column if not exists attendance_count integer,
  add column if not exists status_notes text;

update public.app_users au
set
  first_name = coalesce(au.first_name, m.first_name),
  last_name = coalesce(au.last_name, m.last_name),
  membership = coalesce(au.membership, m.membership),
  last_check_in = coalesce(au.last_check_in, m.last_check_in),
  mrr = coalesce(au.mrr, m.mrr),
  status = coalesce(au.status, m.status),
  tracks = coalesce(au.tracks, m.tracks),
  last_active = coalesce(au.last_active, m.last_active),
  phone = coalesce(au.phone, m.phone),
  gender = coalesce(au.gender, m.gender),
  address = coalesce(au.address, m.address),
  birth_date = coalesce(au.birth_date, m.birth_date),
  tags = coalesce(au.tags, m.tags),
  attendance_count = coalesce(au.attendance_count, m.attendance_count),
  status_notes = coalesce(au.status_notes, m.status_notes),
  updated_at = now()
from public.members m
where lower(trim(au.email)) = lower(trim(m.email));
