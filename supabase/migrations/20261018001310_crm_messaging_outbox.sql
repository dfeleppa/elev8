-- API/worker only; intentionally not applied to any hosted database by this increment.
create table public.crm_sms_preferences (
  phone text primary key check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  allowed boolean not null default false,
  evidence text not null check(length(btrim(evidence)) > 0),
  updated_at timestamptz not null default now()
);
create table public.crm_sms_messages (
  id uuid primary key,
  contact_id uuid not null references public.crm_contacts(id),
  phone text not null references public.crm_sms_preferences(phone),
  body text not null check(length(body) between 1 and 1600),
  created_by uuid references public.app_users(id),
  provider_sid text unique,
  delivery text not null default 'pending' check(delivery in ('pending','accepted','queued','sending','sent','delivered','failed','undelivered','canceled')),
  created_at timestamptz not null default now()
);
create index crm_sms_messages_contact_idx on public.crm_sms_messages(contact_id, created_at);
create table public.crm_sms_outbox (
  message_id uuid primary key references public.crm_sms_messages(id),
  state text not null default 'pending' check(state in ('pending','leased','sending','accepted','uncertain','failed','canceled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text
);
create index crm_sms_outbox_due_idx on public.crm_sms_outbox(available_at) where state = 'pending';
create table public.crm_sms_provider_events (
  event_key text primary key,
  operation_id uuid,
  provider_sid text not null,
  kind text not null,
  received_at timestamptz not null default now()
);

create function public.crm_sms_enqueue(p_id uuid, p_contact uuid, p_phone text, p_body text, p_actor uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing public.crm_sms_messages;
begin
  perform 1 from public.crm_sms_preferences where phone=p_phone and allowed for update;
  if not found then raise exception 'SMS permission absent or suppressed'; end if;
  perform 1 from public.crm_contacts where id=p_contact and phone=p_phone;
  if not found then raise exception 'Contact phone mismatch'; end if;
  insert into public.crm_sms_messages(id,contact_id,phone,body,created_by)
    values(p_id,p_contact,p_phone,p_body,p_actor) on conflict(id) do nothing;
  select * into existing from public.crm_sms_messages where id=p_id;
  if existing.contact_id is distinct from p_contact or existing.phone is distinct from p_phone
    or existing.body is distinct from p_body or existing.created_by is distinct from p_actor then
    raise exception 'Operation ID payload conflict';
  end if;
  insert into public.crm_sms_outbox(message_id) values(p_id) on conflict do nothing;
  return p_id;
end $$;

create function public.crm_sms_claim()
returns setof public.crm_sms_outbox language plpgsql security invoker set search_path = '' as $$
declare job_id uuid;
begin
  -- A crash before provider invocation is retryable; after invocation it needs reconciliation.
  update public.crm_sms_outbox set state='pending', lease_token=null, lease_until=null
    where state='leased' and lease_until < now();
  update public.crm_sms_outbox set state='uncertain', last_error='Worker lease expired after send began'
    where state='sending' and lease_until < now();
  select message_id into job_id from public.crm_sms_outbox
    where state='pending' and available_at <= now() and attempts < 5
    order by available_at,message_id for update skip locked limit 1;
  if job_id is null then return; end if;
  return query update public.crm_sms_outbox set state='leased', lease_token=gen_random_uuid(),
    lease_until=now()+interval '2 minutes' where message_id=job_id returning *;
end $$;

create function public.crm_sms_begin(p_id uuid,p_token uuid)
returns setof public.crm_sms_messages language plpgsql security invoker set search_path = '' as $$
declare permitted boolean;
begin
  -- Same preference lock as opt-out; execution rechecks current eligibility.
  select p.allowed into permitted from public.crm_sms_preferences p
    join public.crm_sms_messages m on m.phone=p.phone where m.id=p_id for update of p;
  if not coalesce(permitted,false) then
    update public.crm_sms_outbox set state='canceled' where message_id=p_id and state in ('pending','leased');
    update public.crm_sms_messages set delivery='canceled' where id=p_id and delivery='pending';
    return;
  end if;
  update public.crm_sms_outbox set state='sending', attempts=attempts+1
    where message_id=p_id and state='leased' and lease_token=p_token and lease_until > now();
  if not found then return; end if;
  return query select * from public.crm_sms_messages where id=p_id;
end $$;

create function public.crm_sms_settle(p_id uuid,p_token uuid,p_outcome text,p_sid text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare permitted boolean;
begin
  if p_outcome not in ('accepted','retry','failed','uncertain') then raise exception 'Invalid outcome'; end if;
  if p_outcome='accepted' and nullif(p_sid,'') is null then raise exception 'SID required'; end if;
  select p.allowed into permitted from public.crm_sms_preferences p join public.crm_sms_messages m
    on m.phone=p.phone where m.id=p_id for update of p;
  update public.crm_sms_outbox set state=case when p_outcome='retry' and not coalesce(permitted,false) then 'canceled'
      when p_outcome='retry' and attempts < 5 then 'pending'
      when p_outcome='retry' then 'failed' else p_outcome end,
    available_at=now()+interval '30 seconds' * power(2,least(attempts,5)),
    lease_until=null,last_error=case when p_outcome='accepted' then null else p_outcome end
    -- Positive provider evidence remains useful after recovery quarantines this
    -- exact attempt. Expired/uncertain attempts may never reopen the retry path.
    where message_id=p_id and lease_token=p_token
      and ((p_outcome='accepted' and state in ('sending','uncertain'))
        or (state='sending' and lease_until > now()));
  if not found then return; end if;
  update public.crm_sms_messages set provider_sid=coalesce(provider_sid,p_sid),
    delivery=case when delivery='pending' and p_outcome='retry' and not coalesce(permitted,false) then 'canceled'
      when delivery='pending' and p_outcome='accepted' then 'accepted'
      when delivery='pending' and (p_outcome='failed' or (p_outcome='retry' and
        (select state from public.crm_sms_outbox where message_id=p_id)='failed')) then 'failed' else delivery end
    where id=p_id and (provider_sid is null or provider_sid=p_sid or p_sid is null);
end $$;

-- Receipt + suppression/callback transition are one transaction. Unknown operation receipts are retained.
create function public.crm_sms_event(p_key text,p_id uuid,p_sid text,p_kind text,p_phone text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_status text; existing_sid text;
begin
  if p_kind not in ('accepted','queued','sending','sent','delivered','failed','undelivered','stop') then
    raise exception 'Unsupported event'; end if;
  insert into public.crm_sms_provider_events(event_key,operation_id,provider_sid,kind)
    values(p_key,p_id,p_sid,p_kind) on conflict do nothing;
  if not found then return false; end if;
  if p_kind='stop' then
    insert into public.crm_sms_preferences(phone,allowed,evidence) values(p_phone,false,'Twilio STOP:'||p_sid)
      on conflict(phone) do update set allowed=false,evidence=excluded.evidence,updated_at=now();
    update public.crm_sms_outbox o set state='canceled',lease_token=null,lease_until=null
      from public.crm_sms_messages m where m.id=o.message_id and m.phone=p_phone and o.state in ('pending','leased');
    update public.crm_sms_messages set delivery='canceled' where phone=p_phone and delivery='pending'
      and id in (select message_id from public.crm_sms_outbox where state='canceled');
    return true;
  end if;
  select delivery,provider_sid into current_status,existing_sid from public.crm_sms_messages where id=p_id for update;
  if not found then return true; end if;
  if existing_sid is not null and existing_sid<>p_sid then raise exception 'Provider SID mismatch'; end if;
  if current_status='canceled' then return true; end if;
  update public.crm_sms_messages set provider_sid=p_sid,
    delivery=case when current_status in ('delivered','failed','undelivered') then current_status
      when p_kind in ('delivered','failed','undelivered') then p_kind
      when array_position(array['pending','accepted','queued','sending','sent'],p_kind) >
        array_position(array['pending','accepted','queued','sending','sent'],current_status) then p_kind
      else current_status end where id=p_id;
  update public.crm_sms_outbox set state='accepted',lease_until=null,last_error=null
    where message_id=p_id and state in ('sending','uncertain');
  return true;
end $$;

alter table public.crm_sms_preferences enable row level security;
alter table public.crm_sms_messages enable row level security;
alter table public.crm_sms_outbox enable row level security;
alter table public.crm_sms_provider_events enable row level security;
revoke all on public.crm_sms_preferences,public.crm_sms_messages,public.crm_sms_outbox,public.crm_sms_provider_events from public,anon,authenticated,service_role;
grant select,insert,update on public.crm_sms_preferences,public.crm_sms_messages,public.crm_sms_outbox to service_role;
grant select,insert on public.crm_sms_provider_events to service_role;
revoke all on function public.crm_sms_enqueue(uuid,uuid,text,text,uuid), public.crm_sms_claim(),public.crm_sms_begin(uuid,uuid),public.crm_sms_settle(uuid,uuid,text,text),public.crm_sms_event(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_sms_enqueue(uuid,uuid,text,text,uuid), public.crm_sms_claim(),public.crm_sms_begin(uuid,uuid),public.crm_sms_settle(uuid,uuid,text,text),public.crm_sms_event(text,uuid,text,text,text) to service_role;
