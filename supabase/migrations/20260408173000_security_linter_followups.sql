create or replace function public.prevent_app_user_email_if_organization_member_exists()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.normalize_organization_invitation_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.invitation_code := nullif(upper(btrim(new.invitation_code)), '');
  return new;
end;
$$;

drop policy if exists organizations_member_insert on public.organizations;
