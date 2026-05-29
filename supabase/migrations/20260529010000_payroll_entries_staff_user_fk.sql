-- ============================================================
-- Tie payroll_entries to app_users (replace staff_name with FK)
-- ============================================================
-- Staff on a payroll entry must be a real app_user. This drops
-- the free-text staff_name column and replaces it with a NOT NULL
-- staff_user_id FK to app_users(id). Existing rows are backfilled
-- by matching staff_name to app_users.full_name (case-insensitive).
--
-- Seeds the "Brianna Forman" coach (placeholder details) so the
-- existing payroll rows have a user to link to.
-- ============================================================

begin;

-- -------------------------------------------------------
-- 1. Seed Brianna Forman as a coach (placeholder info)
-- -------------------------------------------------------
insert into app_users (email, full_name, first_name, last_name, role, coaching_payrate, office_payrate)
select
  'brianna.forman@placeholder.lyfe.local',
  'Brianna Forman',
  'Brianna',
  'Forman',
  'coach',
  0,
  0
where not exists (
  select 1 from app_users where lower(full_name) = lower('Brianna Forman')
);

-- -------------------------------------------------------
-- 2. Add the staff_user_id FK column (nullable for backfill)
-- -------------------------------------------------------
alter table public.payroll_entries
  add column if not exists staff_user_id uuid references public.app_users(id) on delete restrict;

-- -------------------------------------------------------
-- 3. Backfill from staff_name -> app_users.full_name
-- -------------------------------------------------------
update public.payroll_entries pe
set staff_user_id = u.id
from public.app_users u
where pe.staff_user_id is null
  and lower(u.full_name) = lower(pe.staff_name);

-- -------------------------------------------------------
-- 4. Enforce the tie (fails loudly if any row is unmatched)
-- -------------------------------------------------------
alter table public.payroll_entries
  alter column staff_user_id set not null;

-- -------------------------------------------------------
-- 5. Drop the old free-text column and index by FK
-- -------------------------------------------------------
alter table public.payroll_entries drop column if exists staff_name;

create index if not exists payroll_entries_staff_user_id_idx
  on public.payroll_entries (staff_user_id);

commit;
