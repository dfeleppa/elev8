create table if not exists public.mcp_oauth_used_tokens (
  token_hash text primary key,
  token_type text not null check (token_type in ('authorization_code', 'refresh_token')),
  expires_at timestamptz not null,
  used_at timestamptz not null default now()
);

create index if not exists mcp_oauth_used_tokens_expires_at_idx
  on public.mcp_oauth_used_tokens(expires_at);
