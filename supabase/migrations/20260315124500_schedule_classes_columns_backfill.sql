alter table if exists organization_schedule_classes
  add column if not exists track_id uuid references programming_tracks(id) on delete set null,
  add column if not exists default_coach_user_id uuid references app_users(id) on delete set null,
  add column if not exists size_limit integer not null default 0,
  add column if not exists reservation_cutoff_hours integer not null default 0,
  add column if not exists calendar_color text not null default '#3B82F6';

alter table if exists organization_schedule_classes
  drop constraint if exists organization_schedule_classes_size_limit_non_negative,
  add constraint organization_schedule_classes_size_limit_non_negative check (size_limit >= 0);

alter table if exists organization_schedule_classes
  drop constraint if exists organization_schedule_classes_cutoff_non_negative,
  add constraint organization_schedule_classes_cutoff_non_negative check (reservation_cutoff_hours >= 0);

create index if not exists organization_schedule_classes_track_idx
  on organization_schedule_classes(track_id);

create index if not exists organization_schedule_classes_default_coach_idx
  on organization_schedule_classes(default_coach_user_id);
