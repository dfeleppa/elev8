-- Standalone lift logs (not tied to programming blocks)
create table if not exists athlete_lift_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  movement_id uuid not null references movement_library(id) on delete cascade,
  day_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists athlete_lift_log_sets (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references athlete_lift_logs(id) on delete cascade,
  set_order int not null,
  reps int,
  weight numeric(8, 2),
  updated_at timestamptz not null default now(),
  unique (log_id, set_order)
);

create index if not exists athlete_lift_logs_member_idx
  on athlete_lift_logs(member_id, day_date desc);

create index if not exists athlete_lift_logs_movement_member_idx
  on athlete_lift_logs(movement_id, member_id);

alter table if exists athlete_lift_logs enable row level security;
alter table if exists athlete_lift_log_sets enable row level security;

drop policy if exists athlete_lift_logs_member_access on athlete_lift_logs;
create policy athlete_lift_logs_member_access
  on athlete_lift_logs
  for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists athlete_lift_log_sets_member_access on athlete_lift_log_sets;
create policy athlete_lift_log_sets_member_access
  on athlete_lift_log_sets
  for all
  using (
    exists (
      select 1 from athlete_lift_logs l
      where l.id = log_id and l.member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from athlete_lift_logs l
      where l.id = log_id and l.member_id = auth.uid()
    )
  );
