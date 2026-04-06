create table if not exists organization_class_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references organization_schedule_classes(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  class_date date not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists organization_class_reservations_unique_member_idx
  on organization_class_reservations (organization_id, class_id, class_date, member_id);

create index if not exists organization_class_reservations_date_idx
  on organization_class_reservations (organization_id, class_date);

create index if not exists organization_class_reservations_class_idx
  on organization_class_reservations (class_id, class_date);
