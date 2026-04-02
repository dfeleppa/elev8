create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  week_ending_date date not null,
  staff_name text not null,
  coaching_hours numeric(6, 2) not null default 0,
  office_hours numeric(6, 2) not null default 0,
  total_pay numeric(10, 2) not null default 0,
  pay_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payroll_entries_organization_id_idx on public.payroll_entries (organization_id);
create index payroll_entries_week_ending_date_idx on public.payroll_entries (week_ending_date desc);
