update public.organization_members
set email = nullif(lower(btrim(email)), '')
where email is distinct from nullif(lower(btrim(email)), '');

drop index if exists public.organization_members_email_key;

create unique index if not exists organization_members_org_email_key
  on public.organization_members (organization_id, email);
