create extension if not exists pgcrypto;

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  platform text not null,
  account_type text not null default 'business',
  external_account_id text not null,
  external_page_id text,
  username text,
  display_name text,
  profile_image_url text,
  status text not null default 'connected',
  capabilities jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  action_required text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, platform, external_account_id)
);

create index if not exists social_accounts_org_idx
  on social_accounts (organization_id, provider, platform, updated_at desc);

create table if not exists social_account_tokens (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  member_id uuid references app_users(id) on delete set null,
  access_token text not null,
  refresh_token text,
  token_type text,
  granted_scopes text[] not null default '{}',
  expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_account_tokens_account_idx
  on social_account_tokens (social_account_id, updated_at desc);

create table if not exists social_org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  approval_mode text not null default 'optional',
  allow_admin_bypass boolean not null default true,
  weekly_planning_defaults jsonb not null default '{}'::jsonb,
  brand_voice text,
  cta_presets text[] not null default '{}',
  default_hashtags text[] not null default '{}',
  posting_windows jsonb not null default '[]'::jsonb,
  timezone text not null default 'America/New_York',
  ai_generation_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_content_pillars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  color_token text,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists social_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  objective text,
  audience text,
  offer_summary text,
  content_pillar_id uuid references social_content_pillars(id) on delete set null,
  status text not null default 'active',
  start_date date,
  end_date date,
  target_posts integer not null default 0,
  owner_user_id uuid references app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_campaigns_org_idx
  on social_campaigns (organization_id, status, start_date asc);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references app_users(id) on delete set null,
  title text,
  summary text,
  brief text,
  caption text,
  first_comment text,
  workflow_state text not null default 'draft',
  approval_required boolean not null default false,
  assigned_to_user_id uuid references app_users(id) on delete set null,
  campaign_id uuid references social_campaigns(id) on delete set null,
  content_pillar_id uuid references social_content_pillars(id) on delete set null,
  publish_mode text not null default 'auto',
  target_publish_at timestamptz,
  published_at timestamptz,
  ai_metadata jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_org_workflow_idx
  on social_posts (organization_id, workflow_state, target_publish_at asc);

create index if not exists social_posts_org_created_idx
  on social_posts (organization_id, created_at desc);

create table if not exists social_post_channels (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  platform text not null,
  channel_type text not null,
  publish_mode text not null default 'auto',
  status text not null default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  published_external_id text,
  published_permalink text,
  last_error_code text,
  last_error_message text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_post_channels_post_idx
  on social_post_channels (social_post_id, platform, status, scheduled_for asc);

create table if not exists social_asset_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  parent_folder_id uuid references social_asset_folders(id) on delete cascade,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  uploaded_by uuid references app_users(id) on delete set null,
  folder_id uuid references social_asset_folders(id) on delete set null,
  storage_bucket text,
  storage_path text,
  source_url text,
  public_url text,
  origin text not null default 'upload',
  source_provider text,
  source_external_id text,
  title text,
  alt_text text,
  media_type text not null,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  orientation text,
  tags text[] not null default '{}',
  validation_status text not null default 'ready',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_assets_org_idx
  on social_assets (organization_id, created_at desc);

create table if not exists social_post_asset_links (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  social_asset_id uuid not null references social_assets(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (social_post_id, social_asset_id)
);

create index if not exists social_post_asset_links_post_idx
  on social_post_asset_links (social_post_id, sort_order asc);

create table if not exists social_planner_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  slot_date date not null,
  slot_week date not null,
  lane text not null default 'planned',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, social_post_id)
);

create index if not exists social_planner_slots_org_idx
  on social_planner_slots (organization_id, slot_week, slot_date, lane, sort_order);

create table if not exists social_approvals (
  id uuid primary key default gen_random_uuid(),
  social_post_id uuid not null references social_posts(id) on delete cascade,
  requested_by uuid references app_users(id) on delete set null,
  reviewed_by uuid references app_users(id) on delete set null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid references social_posts(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_activity_log_org_idx
  on social_activity_log (organization_id, created_at desc);

create table if not exists social_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  platform text not null,
  conversation_type text not null default 'dm',
  external_conversation_id text,
  participant_name text,
  participant_handle text,
  linked_social_post_id uuid references social_posts(id) on delete set null,
  status text not null default 'open',
  priority text not null default 'normal',
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_messages (
  id uuid primary key default gen_random_uuid(),
  social_conversation_id uuid not null references social_conversations(id) on delete cascade,
  external_message_id text,
  direction text not null default 'inbound',
  body text,
  sender_name text,
  sent_at timestamptz not null default now(),
  needs_response boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_messages_conversation_idx
  on social_messages (social_conversation_id, sent_at desc);

create table if not exists social_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  social_post_id uuid references social_posts(id) on delete set null,
  platform text not null,
  external_comment_id text,
  external_media_id text,
  author_name text,
  author_handle text,
  body text,
  status text not null default 'open',
  priority text not null default 'normal',
  published_at timestamptz,
  replied_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_comments_org_idx
  on social_comments (organization_id, status, created_at desc);

create table if not exists social_inbox_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  assigned_to_user_id uuid references app_users(id) on delete set null,
  assigned_by_user_id uuid references app_users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_inbox_assignments_org_idx
  on social_inbox_assignments (organization_id, item_type, item_id, status);

create table if not exists social_post_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid not null references social_posts(id) on delete cascade,
  platform text not null,
  metric_date date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  engagements integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  likes integer not null default 0,
  profile_actions integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, social_post_id, platform, metric_date)
);

create table if not exists social_account_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  platform text not null,
  metric_date date not null,
  followers integer not null default 0,
  reach integer not null default 0,
  impressions integer not null default 0,
  engagements integer not null default 0,
  messages integer not null default 0,
  comments integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, social_account_id, platform, metric_date)
);

create table if not exists social_ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_post_id uuid references social_posts(id) on delete cascade,
  member_id uuid references app_users(id) on delete set null,
  run_type text not null,
  model text,
  prompt_input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists social_google_photos_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references app_users(id) on delete set null,
  google_account_email text,
  album_id text,
  album_title text,
  status text not null default 'pending',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_google_photo_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  social_asset_id uuid references social_assets(id) on delete set null,
  source_id uuid references social_google_photos_sources(id) on delete cascade,
  google_media_item_id text,
  source_url text,
  fingerprint text,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, google_media_item_id)
);

create table if not exists social_google_photos_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references social_google_photos_sources(id) on delete cascade,
  status text not null default 'queued',
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

insert into social_org_settings (organization_id)
select distinct id
from organizations
on conflict (organization_id) do nothing;

insert into social_accounts (
  organization_id,
  provider,
  platform,
  account_type,
  external_account_id,
  external_page_id,
  username,
  display_name,
  status,
  capabilities,
  metadata,
  last_synced_at,
  created_at,
  updated_at
)
select
  iot.organization_id,
  'meta',
  'instagram',
  'business',
  iot.ig_user_id,
  iot.page_id,
  iot.username,
  iot.username,
  'connected',
  jsonb_build_object(
    'supportsAutoPublish', true,
    'supportsStoriesDirect', false,
    'supportsCommentsInbox', true,
    'supportsDmInbox', false
  ),
  jsonb_build_object('legacyInstagramOauthTokenId', iot.id),
  iot.updated_at,
  iot.created_at,
  iot.updated_at
from instagram_oauth_tokens iot
on conflict (organization_id, provider, platform, external_account_id) do update
set
  external_page_id = excluded.external_page_id,
  username = excluded.username,
  display_name = excluded.display_name,
  updated_at = excluded.updated_at;

insert into social_accounts (
  organization_id,
  provider,
  platform,
  account_type,
  external_account_id,
  external_page_id,
  username,
  display_name,
  status,
  capabilities,
  metadata,
  last_synced_at,
  created_at,
  updated_at
)
select
  iot.organization_id,
  'meta',
  'facebook',
  'page',
  iot.page_id,
  iot.page_id,
  null,
  coalesce(iot.username, 'Facebook Page'),
  'connected',
  jsonb_build_object(
    'supportsAutoPublish', true,
    'supportsCommentsInbox', true,
    'supportsDmInbox', false
  ),
  jsonb_build_object('linkedInstagramUserId', iot.ig_user_id, 'legacyInstagramOauthTokenId', iot.id),
  iot.updated_at,
  iot.created_at,
  iot.updated_at
from instagram_oauth_tokens iot
where iot.page_id is not null
on conflict (organization_id, provider, platform, external_account_id) do update
set
  display_name = excluded.display_name,
  updated_at = excluded.updated_at;

insert into social_account_tokens (
  social_account_id,
  member_id,
  access_token,
  token_type,
  granted_scopes,
  expires_at,
  status,
  created_at,
  updated_at
)
select
  sa.id,
  iot.member_id,
  iot.access_token,
  iot.token_type,
  array['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement']::text[],
  iot.expires_at,
  'active',
  iot.created_at,
  iot.updated_at
from instagram_oauth_tokens iot
join social_accounts sa
  on sa.organization_id = iot.organization_id
 and sa.provider = 'meta'
 and sa.platform = 'instagram'
 and sa.external_account_id = iot.ig_user_id
where not exists (
  select 1
  from social_account_tokens sat
  where sat.social_account_id = sa.id
    and sat.access_token = iot.access_token
);

insert into social_posts (
  organization_id,
  member_id,
  title,
  caption,
  first_comment,
  workflow_state,
  publish_mode,
  target_publish_at,
  published_at,
  tags,
  created_at,
  updated_at
)
select
  ip.organization_id,
  ip.member_id,
  left(coalesce(ip.caption, 'Untitled post'), 80),
  ip.caption,
  ip.first_comment,
  case
    when ip.status in ('scheduled', 'publishing', 'published', 'publish_failed', 'reminder_pending', 'reminder_sent') then ip.status
    else 'draft'
  end,
  ip.publish_mode,
  ip.scheduled_for,
  ip.published_at,
  array[ip.post_type]::text[],
  ip.created_at,
  ip.updated_at
from instagram_posts ip
where not exists (
  select 1
  from social_posts sp
  where sp.organization_id = ip.organization_id
    and sp.created_at = ip.created_at
    and coalesce(sp.caption, '') = coalesce(ip.caption, '')
);

insert into social_post_channels (
  social_post_id,
  social_account_id,
  platform,
  channel_type,
  publish_mode,
  status,
  scheduled_for,
  published_at,
  published_external_id,
  published_permalink,
  last_error_code,
  last_error_message,
  retry_count,
  metadata,
  created_at,
  updated_at
)
select
  sp.id,
  sa.id,
  'instagram',
  ip.post_type,
  ip.publish_mode,
  ip.status,
  ip.scheduled_for,
  ip.published_at,
  ip.published_media_id,
  ip.published_permalink,
  ip.last_error_code,
  ip.last_error_message,
  ip.retry_count,
  jsonb_build_object('legacyInstagramPostId', ip.id),
  ip.created_at,
  ip.updated_at
from instagram_posts ip
join social_posts sp
  on sp.organization_id = ip.organization_id
 and sp.created_at = ip.created_at
 and coalesce(sp.caption, '') = coalesce(ip.caption, '')
join social_accounts sa
  on sa.organization_id = ip.organization_id
 and sa.platform = 'instagram'
 and sa.external_account_id = ip.ig_user_id
where not exists (
  select 1
  from social_post_channels spc
  where spc.social_post_id = sp.id
    and spc.platform = 'instagram'
    and spc.channel_type = ip.post_type
);

insert into social_assets (
  organization_id,
  uploaded_by,
  source_url,
  public_url,
  origin,
  source_provider,
  media_type,
  title,
  validation_status,
  metadata,
  created_at,
  updated_at
)
select
  ip.organization_id,
  ip.member_id,
  ipa.media_url,
  ipa.media_url,
  'legacy_url',
  'instagram',
  ipa.media_type,
  left(coalesce(ip.caption, ipa.media_url), 80),
  'ready',
  jsonb_build_object('legacyInstagramPostAssetId', ipa.id, 'legacyInstagramPostId', ip.id),
  ipa.created_at,
  ipa.created_at
from instagram_post_assets ipa
join instagram_posts ip on ip.id = ipa.post_id
where not exists (
  select 1
  from social_assets sa
  where sa.organization_id = ip.organization_id
    and coalesce(sa.public_url, '') = coalesce(ipa.media_url, '')
    and sa.metadata ->> 'legacyInstagramPostAssetId' = ipa.id::text
);

insert into social_post_asset_links (
  social_post_id,
  social_asset_id,
  sort_order,
  created_at
)
select
  sp.id,
  sa.id,
  ipa.sort_order,
  ipa.created_at
from instagram_post_assets ipa
join instagram_posts ip on ip.id = ipa.post_id
join social_posts sp
  on sp.organization_id = ip.organization_id
 and sp.created_at = ip.created_at
 and coalesce(sp.caption, '') = coalesce(ip.caption, '')
join social_assets sa
  on sa.organization_id = ip.organization_id
 and sa.metadata ->> 'legacyInstagramPostAssetId' = ipa.id::text
where not exists (
  select 1
  from social_post_asset_links spal
  where spal.social_post_id = sp.id
    and spal.social_asset_id = sa.id
);

insert into storage.buckets (id, name, public)
select 'social-assets', 'social-assets', true
where not exists (select 1 from storage.buckets where id = 'social-assets');

insert into storage.buckets (id, name, public)
select 'social-generated', 'social-generated', true
where not exists (select 1 from storage.buckets where id = 'social-generated');

alter table social_accounts enable row level security;
alter table social_account_tokens enable row level security;
alter table social_org_settings enable row level security;
alter table social_content_pillars enable row level security;
alter table social_campaigns enable row level security;
alter table social_posts enable row level security;
alter table social_post_channels enable row level security;
alter table social_asset_folders enable row level security;
alter table social_assets enable row level security;
alter table social_post_asset_links enable row level security;
alter table social_planner_slots enable row level security;
alter table social_approvals enable row level security;
alter table social_activity_log enable row level security;
alter table social_conversations enable row level security;
alter table social_messages enable row level security;
alter table social_comments enable row level security;
alter table social_inbox_assignments enable row level security;
alter table social_post_metrics_daily enable row level security;
alter table social_account_metrics_daily enable row level security;
alter table social_ai_runs enable row level security;
alter table social_google_photos_sources enable row level security;
alter table social_google_photo_imports enable row level security;
alter table social_google_photos_sync_runs enable row level security;
