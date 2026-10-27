-- Web OAuth identities are explicit bindings, never email-based account claims.
-- No existing account is linked or backfilled by this migration.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;

create table private.web_oauth_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'apple')),
  issuer text not null,
  audience text not null check (length(audience) > 0),
  subject text not null check (length(subject) > 0),
  app_user_id uuid not null references public.app_users(id),
  supabase_auth_uid uuid references auth.users(id),
  verified_by text not null check (length(verified_by) > 0),
  verification_method text not null check (length(verification_method) > 0),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (provider, issuer, audience, subject),
  check ((provider = 'google' and issuer = 'https://accounts.google.com')
    or (provider = 'apple' and issuer = 'https://appleid.apple.com'))
);
alter table private.web_oauth_identities enable row level security;
revoke all on private.web_oauth_identities from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.web_oauth_identities to service_role;

create function private.guard_web_oauth_binding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'OAuth binding history cannot be deleted'; end if;
  if (to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at')
    or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'OAuth bindings are immutable; only one-way revocation is allowed';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_web_oauth_binding() from public, anon, authenticated;
create trigger web_oauth_binding_history before update or delete on private.web_oauth_identities
  for each row execute function private.guard_web_oauth_binding();

create function public.resolve_web_oauth_identity(
  p_provider text, p_issuer text, p_audience text, p_subject text
) returns table(app_user_id uuid, role text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.role::text
  from private.web_oauth_identities b
  join public.app_users u on u.id = b.app_user_id
  where b.provider = p_provider and b.issuer = p_issuer
    and b.audience = p_audience and b.subject = p_subject
    and b.revoked_at is null
    and b.supabase_auth_uid is not distinct from u.supabase_auth_uid
    and u.role in ('member', 'coach', 'admin', 'owner');
$$;
revoke all on function public.resolve_web_oauth_identity(text,text,text,text) from public, anon, authenticated;
grant execute on function public.resolve_web_oauth_identity(text,text,text,text) to service_role;

-- Server calls this only after OIDC verification AND a signed invitation ticket.
-- It creates a fresh ordinary member, never links an existing same-email row.
create function public.register_web_oauth_member(
  p_provider text, p_issuer text, p_audience text, p_subject text, p_email text, p_name text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare new_id uuid := gen_random_uuid(); normalized_email text := lower(trim(p_email));
begin
  if normalized_email is null or normalized_email = '' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));
  if exists (select 1 from public.app_users where lower(email) = normalized_email) then return false; end if;
  begin
    insert into public.app_users(id,email,full_name,role)
      values(new_id,normalized_email,p_name,'member');
    insert into private.web_oauth_identities(provider,issuer,audience,subject,app_user_id,verified_by,verification_method)
      values(p_provider,p_issuer,p_audience,p_subject,new_id,'invitation:new-member','verified-oidc-and-invitation');
  exception when unique_violation or check_violation then return false;
  end;
  return true;
end;
$$;
revoke all on function public.register_web_oauth_member(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_web_oauth_member(text,text,text,text,text,text) to service_role;
commit;
