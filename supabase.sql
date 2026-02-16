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
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel_id, period_start, period_end)
);
