-- Instagram account and token storage
create table if not exists instagram_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  ig_user_id text not null,
  page_id text not null,
  username text,
  access_token text not null,
  token_type text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, ig_user_id)
);

create index if not exists instagram_oauth_tokens_org_idx
  on instagram_oauth_tokens (organization_id, updated_at desc);

-- Draft/scheduled Instagram posts
create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references app_users(id) on delete cascade,
  ig_user_id text not null,
  caption text,
  first_comment text,
  post_type text not null, -- image | carousel | reel | story
  publish_mode text not null default 'auto', -- auto | reminder
  status text not null default 'draft', -- draft | scheduled | publishing | published | publish_failed | reminder_pending | reminder_sent
  scheduled_for timestamptz,
  published_at timestamptz,
  published_media_id text,
  published_permalink text,
  last_error_code text,
  last_error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_posts_org_status_schedule_idx
  on instagram_posts (organization_id, status, scheduled_for asc);

create index if not exists instagram_posts_org_created_idx
  on instagram_posts (organization_id, created_at desc);

-- Ordered media assets attached to a post
create table if not exists instagram_post_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references instagram_posts(id) on delete cascade,
  media_url text not null,
  media_type text not null, -- image | video
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists instagram_post_assets_post_idx
  on instagram_post_assets (post_id, sort_order asc);

-- Publish attempt logs for retries/debugging
create table if not exists instagram_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references instagram_posts(id) on delete cascade,
  attempt_no integer not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean not null default false,
  provider_error text,
  provider_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists instagram_publish_attempts_post_idx
  on instagram_publish_attempts (post_id, attempt_no desc);

-- Daily account insights snapshots
create table if not exists instagram_insights_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ig_user_id text not null,
  snapshot_date date not null,
  impressions integer,
  reach integer,
  likes integer,
  comments integer,
  saves integer,
  shares integer,
  profile_visits integer,
  followers integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, ig_user_id, snapshot_date)
);

create index if not exists instagram_insights_daily_org_date_idx
  on instagram_insights_daily (organization_id, snapshot_date desc);

-- Enable RLS (policies will be layered in a dedicated migration)
alter table instagram_oauth_tokens enable row level security;
alter table instagram_posts enable row level security;
alter table instagram_post_assets enable row level security;
alter table instagram_publish_attempts enable row level security;
alter table instagram_insights_daily enable row level security;
