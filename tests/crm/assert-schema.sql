do $$
begin
  if not exists (select from pg_class where oid = 'public.crm_contacts'::regclass and relrowsecurity) then
    raise exception 'CRM RLS is disabled';
  end if;
  if has_table_privilege('anon', 'public.crm_contacts', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.crm_contacts', 'select,insert,update,delete') then
    raise exception 'CRM direct client privileges exist';
  end if;
  if not has_table_privilege('service_role', 'public.crm_contacts', 'select')
     or not has_table_privilege('service_role', 'public.crm_contacts', 'insert')
     or has_table_privilege('service_role', 'public.crm_contacts', 'update,delete,truncate,references,trigger') then
    raise exception 'CRM service privileges are incorrect';
  end if;
  if not exists (select from supabase_migrations.schema_migrations where version = '20261017114730') then
    raise exception 'Contact migration was not recorded by the CLI';
  end if;
  if not exists (select from supabase_migrations.schema_migrations where version = '20261017232622') then
    raise exception 'Contact edit migration was not recorded by the CLI';
  end if;
  if exists (
    select from unnest(array['full_name','email','phone','source','updated_by']) as c(name)
    where not has_column_privilege('service_role', 'public.crm_contacts', c.name, 'update')
  ) or exists (
    select from unnest(array['id','created_by','created_at','revision','updated_at']) as c(name)
    where has_column_privilege('service_role', 'public.crm_contacts', c.name, 'update')
  ) then
    raise exception 'Contact update column privileges are incorrect';
  end if;
  if has_any_column_privilege('anon', 'public.crm_contacts', 'update')
     or has_any_column_privilege('authenticated', 'public.crm_contacts', 'update')
     or has_function_privilege('anon', 'public.crm_stamp_contact_edit()', 'execute')
     or has_function_privilege('authenticated', 'public.crm_stamp_contact_edit()', 'execute') then
    raise exception 'Contact edit direct client privileges exist';
  end if;
end $$;
