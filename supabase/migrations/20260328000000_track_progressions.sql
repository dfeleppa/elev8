-- Track-based progression builder
-- Stores week-over-week lift/conditioning progressions linked to a source workout_block.

create table if not exists public.track_progressions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  track_id         uuid not null,
  source_block_id  uuid not null references public.workout_blocks(id) on delete cascade,
  start_date       date not null,
  duration_weeks   smallint not null check (duration_weeks between 1 and 52),
  category         text not null check (category in ('lift', 'conditioning')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source_block_id)
);

create index if not exists track_progressions_org_idx
  on public.track_progressions(organization_id);

create index if not exists track_progressions_block_idx
  on public.track_progressions(source_block_id);

-- Per-week data — lift and conditioning fields are unified in one table
-- with nullable columns; only the relevant set is populated per category.
create table if not exists public.track_progression_weeks (
  id                        uuid primary key default gen_random_uuid(),
  progression_id            uuid not null references public.track_progressions(id) on delete cascade,
  week_number               smallint not null check (week_number >= 1),
  week_type                 text not null default 'normal'
                              check (week_type in ('normal', 'deload', 'off')),
  -- lift fields
  sets                      smallint,
  reps                      text,
  progression_type          text check (progression_type in ('percentage', 'rpe', 'linear_weight')),
  percent_of_max            numeric(5,2),   -- e.g. 75.00 = 75%
  rpe_target                numeric(3,1),
  weight_increment          numeric(8,2),
  starting_weight           numeric(8,2),
  -- conditioning fields
  modality                  text check (modality in ('run', 'row', 'bike', 'ski', 'swim')),
  conditioning_type         text check (conditioning_type in ('distance', 'time', 'intervals')),
  distance_meters           int,
  duration_seconds          int,
  interval_count            smallint,
  interval_distance_meters  int,
  interval_rest_seconds     int,
  target_pace_per_500m      int,
  -- shared
  notes                     text,
  unique (progression_id, week_number)
);

create index if not exists track_progression_weeks_progression_idx
  on public.track_progression_weeks(progression_id, week_number);

-- RLS -----------------------------------------------------------------------

alter table public.track_progressions enable row level security;

-- Org members can read
create policy track_progressions_select on public.track_progressions
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = auth.uid()
  ));

-- Admins/owners can insert, update, delete
create policy track_progressions_write on public.track_progressions
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.track_progressions.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

alter table public.track_progression_weeks enable row level security;

create policy track_progression_weeks_access on public.track_progression_weeks
  for all to authenticated
  using (exists (
    select 1 from public.track_progressions tp
    join public.organization_memberships m on m.organization_id = tp.organization_id
    where tp.id = public.track_progression_weeks.progression_id
      and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.track_progressions tp
    join public.organization_memberships m on m.organization_id = tp.organization_id
    where tp.id = public.track_progression_weeks.progression_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));
