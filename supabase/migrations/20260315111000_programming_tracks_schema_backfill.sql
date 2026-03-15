alter table if exists programming_tracks
  add column if not exists is_private boolean not null default true,
  add column if not exists hide_workouts_days_prior integer not null default 0,
  add column if not exists hide_workouts_hour integer not null default 0,
  add column if not exists hide_workouts_minute integer not null default 0,
  add column if not exists number_of_levels integer not null default 1;

alter table if exists programming_tracks
  drop constraint if exists programming_tracks_hide_days_non_negative,
  add constraint programming_tracks_hide_days_non_negative check (hide_workouts_days_prior >= 0);

alter table if exists programming_tracks
  drop constraint if exists programming_tracks_hide_hour_range,
  add constraint programming_tracks_hide_hour_range check (hide_workouts_hour between 0 and 23);

alter table if exists programming_tracks
  drop constraint if exists programming_tracks_hide_minute_range,
  add constraint programming_tracks_hide_minute_range check (hide_workouts_minute between 0 and 59);

alter table if exists programming_tracks
  drop constraint if exists programming_tracks_number_of_levels_range,
  add constraint programming_tracks_number_of_levels_range check (number_of_levels between 1 and 3);
