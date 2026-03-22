-- Expand organization_members with fields sourced from CSV import:
-- status, tracks, phone, gender, address, birth_date, tags, attendance_count,
-- last_check_in, last_active, status_notes

alter table if exists organization_members
  add column if not exists status         text,
  add column if not exists tracks         text,
  add column if not exists phone          text,
  add column if not exists gender         text,
  add column if not exists address        text,
  add column if not exists birth_date     date,
  add column if not exists tags           text,
  add column if not exists attendance_count integer,
  add column if not exists status_notes   text;

-- last_check_in and last_active may already exist under different names.
-- Add them idempotently so existing data is not touched.
alter table if exists organization_members
  add column if not exists last_check_in  timestamptz,
  add column if not exists last_active    timestamptz;

-- Optional: index the most-queried columns.
create index if not exists idx_org_members_last_check_in
  on organization_members (organization_id, last_check_in desc nulls last);

create index if not exists idx_org_members_last_active
  on organization_members (organization_id, last_active desc nulls last);
