update public.organizations
set invitation_code = nullif(upper(btrim(invitation_code)), '')
where invitation_code is distinct from nullif(upper(btrim(invitation_code)), '');

create or replace function public.normalize_organization_invitation_code()
returns trigger
language plpgsql
as $$
begin
  new.invitation_code := nullif(upper(btrim(new.invitation_code)), '');
  return new;
end;
$$;

drop trigger if exists organizations_normalize_invitation_code on public.organizations;

create trigger organizations_normalize_invitation_code
before insert or update of invitation_code on public.organizations
for each row
execute function public.normalize_organization_invitation_code();
