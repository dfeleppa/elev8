-- API-only CRM workflow. No authenticated client grants or member identity writes.
alter table public.crm_contacts add column owner_id uuid references public.app_users(id) on delete set null;
alter table public.crm_contacts add column version integer not null default 1;
create index crm_contacts_owner_idx on public.crm_contacts(owner_id);
grant update on public.crm_contacts to service_role;

create table public.crm_notes (
 id uuid primary key, contact_id uuid not null references public.crm_contacts(id),
 body text not null check(length(btrim(body)) between 1 and 5000),
 created_by uuid references public.app_users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.crm_opportunities (
 id uuid primary key, contact_id uuid not null references public.crm_contacts(id),
 title text not null check(length(btrim(title)) between 1 and 160),
 stage text not null default 'new' check(stage in ('new','contacted','consultation','trial','won','lost')),
 owner_id uuid references public.app_users(id) on delete set null,
 value_cents integer not null default 0 check(value_cents between 0 and 100000000),
 currency text not null default 'USD' check(currency = 'USD'),
 next_action text not null default '' check(length(next_action) <= 500),
 created_by uuid references public.app_users(id) on delete set null,
 updated_by uuid references public.app_users(id) on delete set null,
 created_at timestamptz not null default now(), version integer not null default 1,
 unique(id, contact_id)
);
create table public.crm_tasks (
 id uuid primary key, contact_id uuid not null references public.crm_contacts(id),
 opportunity_id uuid, title text not null check(length(btrim(title)) between 1 and 240),
 assignee_id uuid references public.app_users(id) on delete set null,
 due_at timestamptz not null, completed boolean not null default false,
 created_by uuid references public.app_users(id) on delete set null,
 updated_by uuid references public.app_users(id) on delete set null,
 created_at timestamptz not null default now(), version integer not null default 1,
 foreign key(opportunity_id, contact_id) references public.crm_opportunities(id, contact_id)
);
create table public.crm_stage_events (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.crm_contacts(id),
 opportunity_id uuid not null references public.crm_opportunities(id),
 from_stage text, to_stage text not null,
 created_by uuid references public.app_users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index crm_notes_contact_idx on public.crm_notes(contact_id, created_at desc, id);
create index crm_opportunities_contact_idx on public.crm_opportunities(contact_id, created_at desc, id);
create index crm_opportunities_owner_idx on public.crm_opportunities(owner_id);
create index crm_tasks_contact_idx on public.crm_tasks(contact_id, completed, due_at, id);
create index crm_tasks_assignee_idx on public.crm_tasks(assignee_id, due_at) where not completed;
create index crm_stage_events_contact_idx on public.crm_stage_events(contact_id, created_at desc, id);
create index crm_stage_events_opportunity_idx on public.crm_stage_events(opportunity_id);

create function public.crm_increment_version() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
revoke all on function public.crm_increment_version() from public, anon, authenticated;
grant execute on function public.crm_increment_version() to service_role;
create trigger crm_contacts_version before update on public.crm_contacts for each row execute function public.crm_increment_version();
create trigger crm_opportunities_version before update on public.crm_opportunities for each row execute function public.crm_increment_version();
create trigger crm_tasks_version before update on public.crm_tasks for each row execute function public.crm_increment_version();

-- Trigger and originating mutation commit together; failed stage history aborts the change.
create function public.crm_record_stage() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP = 'INSERT' then
  insert into public.crm_stage_events(contact_id, opportunity_id, from_stage, to_stage, created_by)
  values(new.contact_id, new.id, null, new.stage, new.created_by);
 elsif new.stage is distinct from old.stage then
  insert into public.crm_stage_events(contact_id, opportunity_id, from_stage, to_stage, created_by)
  values(new.contact_id, new.id, old.stage, new.stage, new.updated_by);
 end if;
 return new;
end;
$$;
revoke all on function public.crm_record_stage() from public, anon, authenticated;
grant execute on function public.crm_record_stage() to service_role;
create trigger crm_opportunity_stage after insert or update on public.crm_opportunities for each row execute function public.crm_record_stage();

alter table public.crm_notes enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_stage_events enable row level security;
revoke all on public.crm_notes, public.crm_opportunities, public.crm_tasks, public.crm_stage_events from public, anon, authenticated, service_role;
grant select, insert on public.crm_notes, public.crm_stage_events to service_role;
grant select, insert, update on public.crm_opportunities, public.crm_tasks to service_role;
