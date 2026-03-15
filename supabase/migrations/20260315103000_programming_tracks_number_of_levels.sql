alter table if exists programming_tracks
  add column if not exists number_of_levels integer not null default 1;

alter table if exists programming_tracks
  drop constraint if exists programming_tracks_number_of_levels_range,
  add constraint programming_tracks_number_of_levels_range check (number_of_levels between 1 and 3);
