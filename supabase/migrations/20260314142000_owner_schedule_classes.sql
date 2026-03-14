create table if not exists organization_schedule_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  class_time time not null,
  duration_minutes integer not null,
  class_days text[] not null default '{}',
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_schedule_classes_duration_check check (duration_minutes > 0)
);

create index if not exists organization_schedule_classes_org_idx
  on organization_schedule_classes(organization_id);

create index if not exists organization_schedule_classes_start_idx
  on organization_schedule_classes(start_date);

create index if not exists organization_schedule_classes_time_idx
  on organization_schedule_classes(class_time);

alter table if exists organization_schedule_classes enable row level security;

drop policy if exists organization_schedule_classes_membership_access on organization_schedule_classes;
create policy organization_schedule_classes_membership_access
  on organization_schedule_classes
  for all
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organization_schedule_classes.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organization_schedule_classes.organization_id
        and m.user_id = auth.uid()
    )
  );
