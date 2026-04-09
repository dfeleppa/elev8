drop index if exists public.organization_members_org_email_key;

create unique index if not exists organization_members_org_email_key
  on public.organization_members (organization_id, email);
