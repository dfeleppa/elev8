-- ============================================================
-- Program Builder
-- ============================================================

-- 1. Programs (top-level template)
create table if not exists public.programs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  description      text,
  duration_weeks   integer not null check (duration_weeks >= 1 and duration_weeks <= 52),
  days_per_week    integer not null default 5 check (days_per_week >= 1 and days_per_week <= 7),
  status           text not null default 'draft'
                     check (status in ('draft', 'published', 'archived')),
  created_by       uuid references public.app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists programs_org_idx on public.programs(organization_id);

-- 2. Program template days  (week_number + day_of_week, not calendar dates)
create table if not exists public.program_template_days (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.programs(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  week_number      integer not null check (week_number >= 1),
  day_of_week      integer not null check (day_of_week >= 1 and day_of_week <= 7),
  title            text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (program_id, week_number, day_of_week)
);

create index if not exists program_template_days_program_idx
  on public.program_template_days(program_id, week_number, day_of_week);

-- 3. Program template blocks
create table if not exists public.program_template_blocks (
  id                   uuid primary key default gen_random_uuid(),
  template_day_id      uuid not null references public.program_template_days(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  program_id           uuid not null references public.programs(id) on delete cascade,
  block_order          integer not null default 0,
  block_type           text not null
                         check (block_type in ('warmup', 'lift', 'workout', 'cooldown')),
  title                text not null,
  description          text,
  score_type           text not null default 'none'
                         check (score_type in ('time','reps','rounds_reps','distance','calories','none')),
  movement_id          uuid references public.movement_library(id) on delete set null,
  tags                 text[] not null default '{}',
  leaderboard_enabled  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists program_template_blocks_day_idx
  on public.program_template_blocks(template_day_id, block_order);
create index if not exists program_template_blocks_program_idx
  on public.program_template_blocks(program_id);

-- 4. Lift progressions (per block × per week)
create table if not exists public.program_lift_progressions (
  id                uuid primary key default gen_random_uuid(),
  block_id          uuid not null references public.program_template_blocks(id) on delete cascade,
  program_id        uuid not null references public.programs(id) on delete cascade,
  week_number       integer not null check (week_number >= 1),
  progression_type  text not null
                      check (progression_type in ('percentage', 'rpe', 'linear_weight')),
  sets              integer not null default 3 check (sets >= 1),
  reps              text not null,
  -- percentage-based
  percent_of_max    numeric check (percent_of_max is null or (percent_of_max > 0 and percent_of_max <= 1.2)),
  -- rpe-based
  rpe_target        numeric check (rpe_target is null or (rpe_target >= 1 and rpe_target <= 10)),
  -- linear weight
  weight_increment  numeric,
  starting_weight   numeric,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (block_id, week_number)
);

create index if not exists program_lift_progressions_block_idx
  on public.program_lift_progressions(block_id, week_number);

-- 5. Conditioning progressions (per block × per week)
create table if not exists public.program_conditioning_progressions (
  id                        uuid primary key default gen_random_uuid(),
  block_id                  uuid not null references public.program_template_blocks(id) on delete cascade,
  program_id                uuid not null references public.programs(id) on delete cascade,
  week_number               integer not null check (week_number >= 1),
  modality                  text not null
                              check (modality in ('run', 'row', 'bike', 'ski', 'swim')),
  progression_type          text not null
                              check (progression_type in ('distance', 'time', 'intervals')),
  -- distance
  distance_meters           numeric,
  -- time
  duration_seconds          integer,
  -- intervals
  interval_count            integer,
  interval_distance_meters  numeric,
  interval_rest_seconds     integer,
  -- optional pace guidance
  target_pace_per_500m      integer,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (block_id, week_number)
);

create index if not exists program_conditioning_progressions_block_idx
  on public.program_conditioning_progressions(block_id, week_number);

-- 6. Assignments (to member or track, never both)
create table if not exists public.program_assignments (
  id                  uuid primary key default gen_random_uuid(),
  program_id          uuid not null references public.programs(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  assigned_member_id  uuid references public.app_users(id) on delete cascade,
  assigned_track_id   uuid references public.programming_tracks(id) on delete cascade,
  start_date          date not null,
  is_active           boolean not null default true,
  notes               text,
  created_by          uuid references public.app_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint program_assignments_target_check check (
    (assigned_member_id is not null and assigned_track_id is null)
    or (assigned_member_id is null and assigned_track_id is not null)
  )
);

create index if not exists program_assignments_program_idx
  on public.program_assignments(program_id);
create index if not exists program_assignments_member_idx
  on public.program_assignments(assigned_member_id) where assigned_member_id is not null;
create index if not exists program_assignments_track_idx
  on public.program_assignments(assigned_track_id) where assigned_track_id is not null;

-- ============================================================
-- RLS
-- ============================================================

alter table public.programs enable row level security;
alter table public.program_template_days enable row level security;
alter table public.program_template_blocks enable row level security;
alter table public.program_lift_progressions enable row level security;
alter table public.program_conditioning_progressions enable row level security;
alter table public.program_assignments enable row level security;

-- programs: any org member can read; admin/owner can write
drop policy if exists programs_member_read on public.programs;
create policy programs_member_read on public.programs
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = auth.uid()
  ));

drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.programs.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

-- template days: same pattern
drop policy if exists program_template_days_member_read on public.program_template_days;
create policy program_template_days_member_read on public.program_template_days
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = auth.uid()
  ));

drop policy if exists program_template_days_admin_write on public.program_template_days;
create policy program_template_days_admin_write on public.program_template_days
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_days.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

-- template blocks
drop policy if exists program_template_blocks_member_read on public.program_template_blocks;
create policy program_template_blocks_member_read on public.program_template_blocks
  for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = auth.uid()
  ));

drop policy if exists program_template_blocks_admin_write on public.program_template_blocks;
create policy program_template_blocks_admin_write on public.program_template_blocks
  for all to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ))
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_template_blocks.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

-- lift progressions: admin write, org member read (via program join)
drop policy if exists program_lift_progressions_access on public.program_lift_progressions;
create policy program_lift_progressions_access on public.program_lift_progressions
  for all to authenticated
  using (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_lift_progressions.program_id
      and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_lift_progressions.program_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

-- conditioning progressions: same
drop policy if exists program_conditioning_progressions_access on public.program_conditioning_progressions;
create policy program_conditioning_progressions_access on public.program_conditioning_progressions
  for all to authenticated
  using (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_conditioning_progressions.program_id
      and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.programs p
    join public.organization_memberships m on m.organization_id = p.organization_id
    where p.id = public.program_conditioning_progressions.program_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));

-- assignments: coaches/admins can manage, members can read their own
drop policy if exists program_assignments_access on public.program_assignments;
create policy program_assignments_access on public.program_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = public.program_assignments.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner', 'coach')
    )
    or assigned_member_id = auth.uid()
  )
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = public.program_assignments.organization_id
      and m.user_id = auth.uid()
      and m.role in ('admin', 'owner')
  ));
