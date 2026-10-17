-- CRM people are separate from app_users: creating a lead grants no login access.
create table public.crm_contacts (
  id uuid primary key,
  full_name text not null check (length(btrim(full_name)) between 1 and 160),
  email text check (email is null or (email = lower(btrim(email)) and length(email) between 3 and 254)),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  source text not null default 'manual' check (source in ('manual', 'referral', 'website', 'import')),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint crm_contact_channel_required check (email is not null or phone is not null)
);
create index crm_contacts_created_by_idx on public.crm_contacts(created_by);
create index crm_contacts_email_idx on public.crm_contacts(email) where email is not null;
create index crm_contacts_phone_idx on public.crm_contacts(phone) where phone is not null;

-- API-only access. Server routes must independently require CRM capabilities.
-- Shared family phone/email addresses are deliberately not unique identities.
alter table public.crm_contacts enable row level security;
revoke all on public.crm_contacts from public, anon, authenticated;
grant select, insert on public.crm_contacts to service_role;
