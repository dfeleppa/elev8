create table if not exists youtube_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null unique,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists youtube_metrics (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  period_start date not null,
  period_end date not null,
  views bigint,
  watch_minutes bigint,
  subscribers_gained bigint,
  subscribers_total bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel_id, period_start, period_end)
);

create table if not exists training_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_date date not null,
  notes text,
  is_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists nutrition_days (
  id uuid primary key default gen_random_uuid(),
  day_date date not null unique,
  calorie_target numeric(10,2),
  protein_target numeric(10,2),
  carbs_target numeric(10,2),
  fat_target numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references nutrition_days(id) on delete cascade,
  meal_type text not null,
  entry_name text not null,
  quantity numeric(10,2) not null default 1,
  calories numeric(10,2),
  protein numeric(10,2),
  carbs numeric(10,2),
  fat numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists nutrition_custom_foods (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  name text not null,
  calories numeric(10,2),
  protein numeric(10,2),
  carbs numeric(10,2),
  fat numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists nutrition_custom_foods_member_idx
  on nutrition_custom_foods(member_id, created_at desc);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner text,
  status text,
  start_date date,
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status text,
  due_date date,
  priority text,
  is_complete boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_project_id_idx on tasks(project_id);

create table if not exists health_stat_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  stat_key text not null,
  value numeric,
  unit text,
  entry_date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists health_stat_entries_member_idx
  on health_stat_entries(member_id, stat_key, entry_date desc);

alter table if exists organization_members
  add column if not exists email text;

create unique index if not exists organization_members_email_key
  on organization_members(email);

alter table if exists youtube_oauth_tokens
  add column if not exists member_id uuid;

alter table if exists youtube_oauth_tokens
  drop constraint if exists youtube_oauth_tokens_channel_id_key;

create unique index if not exists youtube_oauth_tokens_member_channel_idx
  on youtube_oauth_tokens(member_id, channel_id);

alter table if exists youtube_metrics
  add column if not exists member_id uuid;

alter table if exists youtube_metrics
  drop constraint if exists youtube_metrics_channel_id_period_start_period_end_key;

create unique index if not exists youtube_metrics_member_period_idx
  on youtube_metrics(member_id, channel_id, period_start, period_end);

alter table if exists training_events
  add column if not exists member_id uuid;

create index if not exists training_events_member_idx
  on training_events(member_id);

alter table if exists training_sessions
  add column if not exists member_id uuid;

create index if not exists training_sessions_member_idx
  on training_sessions(member_id);

alter table if exists nutrition_days
  add column if not exists member_id uuid;

alter table if exists nutrition_days
  drop constraint if exists nutrition_days_day_date_key;

create unique index if not exists nutrition_days_member_day_idx
  on nutrition_days(member_id, day_date);

alter table if exists nutrition_entries
  add column if not exists member_id uuid;

alter table if exists nutrition_entries
  add column if not exists quantity integer not null default 1;

alter table if exists nutrition_entries
  alter column quantity type numeric(10,2) using quantity::numeric,
  alter column calories type numeric(10,2) using calories::numeric,
  alter column protein type numeric(10,2) using protein::numeric,
  alter column carbs type numeric(10,2) using carbs::numeric,
  alter column fat type numeric(10,2) using fat::numeric;

alter table if exists nutrition_days
  alter column calorie_target type numeric(10,2) using calorie_target::numeric,
  alter column protein_target type numeric(10,2) using protein_target::numeric,
  alter column carbs_target type numeric(10,2) using carbs_target::numeric,
  alter column fat_target type numeric(10,2) using fat_target::numeric;

alter table if exists nutrition_custom_foods
  alter column calories type numeric(10,2) using calories::numeric,
  alter column protein type numeric(10,2) using protein::numeric,
  alter column carbs type numeric(10,2) using carbs::numeric,
  alter column fat type numeric(10,2) using fat::numeric;

update nutrition_entries as entry
set member_id = day.member_id
from nutrition_days as day
where entry.day_id = day.id
  and entry.member_id is null
  and day.member_id is not null;

alter table if exists nutrition_days
  drop constraint if exists nutrition_days_member_required;

alter table if exists nutrition_days
  add constraint nutrition_days_member_required
  check (member_id is not null) not valid;

alter table if exists nutrition_entries
  drop constraint if exists nutrition_entries_member_required;

alter table if exists nutrition_entries
  add constraint nutrition_entries_member_required
  check (member_id is not null) not valid;

create unique index if not exists nutrition_days_id_member_idx
  on nutrition_days(id, member_id);

alter table if exists nutrition_entries
  drop constraint if exists nutrition_entries_day_id_fkey;

alter table if exists nutrition_entries
  add constraint nutrition_entries_day_member_fkey
  foreign key (day_id, member_id)
  references nutrition_days(id, member_id)
  on delete cascade;

create index if not exists nutrition_entries_member_idx
  on nutrition_entries(member_id);

alter table if exists projects
  add column if not exists member_id uuid;

create index if not exists projects_member_idx
  on projects(member_id);

alter table if exists tasks
  add column if not exists member_id uuid;

create index if not exists tasks_member_idx
  on tasks(member_id);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx
  on organization_memberships(user_id);

create index if not exists organization_memberships_org_idx
  on organization_memberships(organization_id);

create table if not exists organization_schedule_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  class_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  class_days text[] not null default '{}',
  start_date date not null,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists organization_schedule_classes_org_idx
  on organization_schedule_classes(organization_id);

create index if not exists organization_schedule_classes_start_idx
  on organization_schedule_classes(start_date);

alter table if exists organization_memberships
  add column if not exists coaching_payrate numeric;

alter table if exists organization_memberships
  add column if not exists office_payrate numeric;

alter table if exists organization_members
  add column if not exists member_id uuid;

create index if not exists organization_members_member_idx
  on organization_members(member_id);

alter table if exists youtube_oauth_tokens enable row level security;
alter table if exists youtube_metrics enable row level security;
alter table if exists training_events enable row level security;
alter table if exists training_sessions enable row level security;
alter table if exists nutrition_days enable row level security;
alter table if exists nutrition_entries enable row level security;
alter table if exists nutrition_custom_foods enable row level security;
alter table if exists health_stat_entries enable row level security;
alter table if exists projects enable row level security;
alter table if exists tasks enable row level security;
alter table if exists app_users enable row level security;
alter table if exists organizations enable row level security;
alter table if exists organization_memberships enable row level security;
alter table if exists organization_members enable row level security;
alter table if exists organization_schedule_classes enable row level security;

drop policy if exists youtube_oauth_tokens_member_access on youtube_oauth_tokens;
create policy youtube_oauth_tokens_member_access
  on youtube_oauth_tokens
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists youtube_metrics_member_access on youtube_metrics;
create policy youtube_metrics_member_access
  on youtube_metrics
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists training_events_member_access on training_events;
create policy training_events_member_access
  on training_events
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists training_sessions_member_access on training_sessions;
create policy training_sessions_member_access
  on training_sessions
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists nutrition_days_member_access on nutrition_days;
create policy nutrition_days_member_access
  on nutrition_days
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists nutrition_entries_member_access on nutrition_entries;
create policy nutrition_entries_member_access
  on nutrition_entries
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists nutrition_custom_foods_member_access on nutrition_custom_foods;
create policy nutrition_custom_foods_member_access
  on nutrition_custom_foods
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists health_stat_entries_member_access on health_stat_entries;
create policy health_stat_entries_member_access
  on health_stat_entries
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists projects_member_access on projects;
create policy projects_member_access
  on projects
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists tasks_member_access on tasks;
create policy tasks_member_access
  on tasks
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists organization_schedule_classes_membership_access on organization_schedule_classes;
create policy organization_schedule_classes_membership_access
  on organization_schedule_classes
  for all
  to authenticated
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

drop policy if exists app_users_self_select on app_users;
create policy app_users_self_select
  on app_users
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists app_users_self_insert on app_users;
create policy app_users_self_insert
  on app_users
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists app_users_self_update on app_users;
create policy app_users_self_update
  on app_users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists organization_memberships_self_access on organization_memberships;
create policy organization_memberships_self_access
  on organization_memberships
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read
  on organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists organizations_member_insert on organizations;
create policy organizations_member_insert
  on organizations
  for insert
  to authenticated
  with check (true);

drop policy if exists organizations_admin_update on organizations;
create policy organizations_admin_update
  on organizations
  for update
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

drop policy if exists organizations_admin_delete on organizations;
create policy organizations_admin_delete
  on organizations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

drop policy if exists organization_members_member_access on organization_members;
create policy organization_members_member_access
  on organization_members
  for all
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- Programming system core entities
create table if not exists programming_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, name)
);

create table if not exists programming_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid not null references programming_tracks(id) on delete cascade,
  day_date date not null,
  title text,
  notes text,
  is_published boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (track_id, day_date)
);

create table if not exists movement_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  modality text,
  default_unit text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, name)
);

create table if not exists movement_videos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  movement_id uuid references movement_library(id) on delete set null,
  title text not null,
  video_url text not null,
  provider text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workout_blocks (
  id uuid primary key default gen_random_uuid(),
  programming_day_id uuid not null references programming_days(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid not null references programming_tracks(id) on delete cascade,
  parent_block_id uuid references workout_blocks(id) on delete set null,
  block_order integer not null default 0,
  block_type text not null,
  title text not null,
  description text,
  score_type text not null default 'none',
  leaderboard_enabled boolean not null default false,
  benchmark_enabled boolean not null default false,
  benchmark_id uuid,
  movement_id uuid references movement_library(id) on delete set null,
  percent_prescription numeric,
  rounds integer,
  tags text[] default '{}',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint workout_blocks_type_check check (
    block_type in ('warmup', 'lift', 'workout', 'cooldown')
  ),
  constraint workout_blocks_score_type_check check (
    score_type in ('time', 'reps', 'rounds_reps', 'distance', 'calories', 'none')
  ),
  constraint workout_blocks_non_tracked_check check (
    (block_type in ('warmup', 'cooldown') and leaderboard_enabled = false and benchmark_enabled = false)
    or (block_type in ('lift', 'workout'))
  ),
  constraint workout_blocks_percent_check check (
    percent_prescription is null or (percent_prescription > 0 and percent_prescription <= 1)
  )
);

create table if not exists workout_block_levels (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references workout_blocks(id) on delete cascade,
  level integer not null,
  title text,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint workout_block_levels_level_check check (level in (1, 2, 3)),
  unique (block_id, level)
);

create table if not exists workout_block_movements (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references workout_blocks(id) on delete cascade,
  movement_id uuid not null references movement_library(id) on delete cascade,
  display_order integer not null default 0,
  rep_scheme text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (block_id, movement_id)
);

create table if not exists workout_block_movement_videos (
  id uuid primary key default gen_random_uuid(),
  block_movement_id uuid not null references workout_block_movements(id) on delete cascade,
  video_id uuid not null references movement_videos(id) on delete cascade,
  created_at timestamptz default now(),
  unique (block_movement_id, video_id)
);

create table if not exists benchmark_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  movement_id uuid references movement_library(id) on delete set null,
  name text not null,
  description text,
  score_type text not null,
  is_named boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint benchmark_definitions_score_type_check check (
    score_type in ('time', 'reps', 'rounds_reps', 'distance', 'calories', 'none')
  ),
  unique (organization_id, name)
);

alter table if exists workout_blocks
  add constraint workout_blocks_benchmark_fk
  foreign key (benchmark_id)
  references benchmark_definitions(id)
  on delete set null;

create table if not exists workout_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid not null references programming_tracks(id) on delete cascade,
  block_id uuid not null references workout_blocks(id) on delete cascade,
  day_date date not null,
  member_id uuid not null references app_users(id) on delete cascade,
  level integer,
  score_type text not null,
  score_text text,
  score_value numeric,
  total_reps integer,
  rounds integer,
  distance numeric,
  calories integer,
  duration_seconds integer,
  is_rx boolean not null default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint workout_results_level_check check (level is null or level in (1, 2, 3)),
  constraint workout_results_score_type_check check (
    score_type in ('time', 'reps', 'rounds_reps', 'distance', 'calories', 'none')
  )
);

create table if not exists workout_result_lift_sets (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references workout_results(id) on delete cascade,
  set_order integer not null,
  reps integer not null,
  weight numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (result_id, set_order)
);

create table if not exists member_movement_prs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  movement_id uuid not null references movement_library(id) on delete cascade,
  best_weight numeric,
  best_reps integer,
  estimated_one_rep_max numeric,
  source_result_id uuid references workout_results(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, member_id, movement_id)
);

create index if not exists programming_tracks_org_idx
  on programming_tracks(organization_id);

create index if not exists programming_days_track_date_idx
  on programming_days(track_id, day_date);

create index if not exists workout_blocks_day_order_idx
  on workout_blocks(programming_day_id, block_order);

create index if not exists workout_blocks_track_idx
  on workout_blocks(track_id);

create index if not exists workout_results_block_day_idx
  on workout_results(block_id, day_date);

create index if not exists workout_results_member_idx
  on workout_results(member_id, day_date desc);

create index if not exists workout_results_track_day_idx
  on workout_results(track_id, day_date);

create index if not exists workout_result_lift_sets_result_idx
  on workout_result_lift_sets(result_id, set_order);

create index if not exists member_movement_prs_lookup_idx
  on member_movement_prs(member_id, movement_id);

alter table if exists programming_tracks enable row level security;
alter table if exists programming_days enable row level security;
alter table if exists movement_library enable row level security;
alter table if exists movement_videos enable row level security;
alter table if exists workout_blocks enable row level security;
alter table if exists workout_block_levels enable row level security;
alter table if exists workout_block_movements enable row level security;
alter table if exists workout_block_movement_videos enable row level security;
alter table if exists benchmark_definitions enable row level security;
alter table if exists workout_results enable row level security;
alter table if exists workout_result_lift_sets enable row level security;
alter table if exists member_movement_prs enable row level security;

drop policy if exists programming_tracks_member_read on programming_tracks;
create policy programming_tracks_member_read
  on programming_tracks
  for select
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = programming_tracks.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists programming_tracks_admin_write on programming_tracks;
create policy programming_tracks_admin_write
  on programming_tracks
  for all
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = programming_tracks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = programming_tracks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

drop policy if exists programming_days_member_access on programming_days;
create policy programming_days_member_access
  on programming_days
  for all
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = programming_days.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = programming_days.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

drop policy if exists workout_blocks_member_access on workout_blocks;
create policy workout_blocks_member_access
  on workout_blocks
  for all
  to authenticated
  using (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = workout_blocks.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from organization_memberships m
      where m.organization_id = workout_blocks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

drop policy if exists workout_results_member_access on workout_results;
create policy workout_results_member_access
  on workout_results
  for all
  to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1
      from organization_memberships m
      where m.organization_id = workout_results.organization_id
        and m.user_id = auth.uid()
        and m.role in ('coach', 'admin', 'owner')
    )
  )
  with check (
    member_id = auth.uid()
    or exists (
      select 1
      from organization_memberships m
      where m.organization_id = workout_results.organization_id
        and m.user_id = auth.uid()
        and m.role in ('coach', 'admin', 'owner')
    )
  );

drop policy if exists member_movement_prs_member_access on member_movement_prs;
create policy member_movement_prs_member_access
  on member_movement_prs
  for all
  to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1
      from organization_memberships m
      where m.organization_id = member_movement_prs.organization_id
        and m.user_id = auth.uid()
        and m.role in ('coach', 'admin', 'owner')
    )
  )
  with check (
    member_id = auth.uid()
    or exists (
      select 1
      from organization_memberships m
      where m.organization_id = member_movement_prs.organization_id
        and m.user_id = auth.uid()
        and m.role in ('coach', 'admin', 'owner')
    )
  );
