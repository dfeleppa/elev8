begin;

alter table public.crm_contacts
  add column revision integer not null default 1 check (revision > 0),
  add column updated_at timestamptz,
  add column updated_by uuid references public.app_users(id) on delete set null;

-- Preserve the known timestamp for contacts created before editing existed.
update public.crm_contacts set updated_at = created_at;
alter table public.crm_contacts
  alter column updated_at set default now(),
  alter column updated_at set not null;
create index crm_contacts_updated_by_idx on public.crm_contacts(updated_by);

create function public.crm_stamp_contact_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.crm_stamp_contact_edit() from public, anon, authenticated, service_role;
grant execute on function public.crm_stamp_contact_edit() to service_role;
create trigger crm_contacts_stamp_edit
before update on public.crm_contacts
for each row execute function public.crm_stamp_contact_edit();

-- Keep RLS and the foundation's API-only SELECT/INSERT grants.
-- No blanket UPDATE: identifiers, creation metadata and revision remain immutable
-- to the server caller. The trigger alone stamps revision/updated_at on updates.
revoke update on public.crm_contacts from public, anon, authenticated, service_role;
grant update (full_name, email, phone, source, updated_by) on public.crm_contacts to service_role;

commit;
