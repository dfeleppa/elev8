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
  if not exists (select from supabase_migrations.schema_migrations where version = '20261017233030') then
    raise exception 'Identity migration was not recorded by the CLI';
  end if;
  if to_regprocedure('public.sync_supabase_auth_uid()') is not null
     or exists (select from pg_trigger where tgname = 'on_auth_user_login' and tgrelid = 'auth.users'::regclass) then
    raise exception 'Unsafe identity trigger/function remains';
  end if;
  if has_any_column_privilege('authenticated', 'public.app_users', 'insert,update,references')
     or has_column_privilege('authenticated', 'public.app_users', 'password_hash', 'select') then
    raise exception 'Unsafe app_users column privileges remain';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'app_users') <> 1
     or not exists (select from pg_policies where schemaname = 'public' and tablename = 'app_users'
       and policyname = 'app_users_mobile_self_read' and cmd = 'SELECT') then
    raise exception 'Unexpected app_users policy set';
  end if;
end $$;
