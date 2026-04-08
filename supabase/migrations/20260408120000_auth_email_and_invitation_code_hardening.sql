create or replace function public.prevent_app_user_email_if_organization_member_exists()
returns trigger
language plpgsql
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and lower(coalesce(new.email, '')) = lower(coalesce(old.email, '')) then
    return new;
  end if;

  if exists (
    select 1
    from public.organization_members om
    where lower(om.email) = lower(new.email)
  ) then
    raise exception 'This email already exists in organization_members and cannot be used for app_users.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists app_users_reject_organization_member_email on public.app_users;

create trigger app_users_reject_organization_member_email
before insert or update of email on public.app_users
for each row
execute function public.prevent_app_user_email_if_organization_member_exists();

drop index if exists public.organizations_invitation_code_key;

create unique index if not exists organizations_invitation_code_upper_key
  on public.organizations (upper(invitation_code))
  where invitation_code is not null;
