-- Bounded booking fixture reflecting the inspected post-single-tenant columns.
-- Not a production snapshot or proof of historical migration replay.
create table public.schedule_classes (
  id uuid primary key default gen_random_uuid(), name text not null,
  class_time time not null, duration_minutes integer not null check (duration_minutes > 0),
  class_days text[] not null default '{}', start_date date not null, end_date date,
  track_id uuid references public.programming_tracks(id) on delete set null,
  default_coach_user_id uuid references public.app_users(id) on delete set null,
  size_limit integer not null default 0 check (size_limit >= 0),
  reservation_cutoff_hours integer not null default 0 check (reservation_cutoff_hours >= 0),
  calendar_color text not null default '#3B82F6', created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.class_reservations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.schedule_classes(id) on delete cascade,
  member_id uuid not null references public.app_users(id) on delete cascade,
  class_date date not null, created_at timestamptz not null default now()
);
create index organization_class_reservations_class_idx on public.class_reservations(class_id,class_date);
alter table public.schedule_classes enable row level security;
alter table public.class_reservations enable row level security;
grant all on public.schedule_classes, public.class_reservations to anon, authenticated, service_role;
