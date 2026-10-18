-- Read-only metadata, not a schema dump. No row values or function bodies.
-- Include private/programming and app-owned triggers on managed Auth tables.
select jsonb_build_object(
  'formatVersion', 1,
  'capturedAt', now(),
  'serverVersion', current_setting('server_version'),
  'migrations', (select jsonb_agg(jsonb_build_object(
    'version',version,'name',name,
    'statementsSha256',encode(extensions.digest(convert_to(array_to_string(statements,E'\n'),'UTF8'),'sha256'),'hex'),
    'statementCount',cardinality(statements)
  ) order by version) from supabase_migrations.schema_migrations),
  'extensions', (select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
  'tables', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'defaultHash',md5(coalesce(pg_get_expr(d.adbin,d.adrelid),''))
    ) order by a.attnum) from pg_attribute a
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(jsonb_build_object('name',con.conname,'kind',con.contype,
      'definitionHash',md5(pg_get_constraintdef(con.oid))) order by con.conname)
      from pg_constraint con where con.conrelid=c.oid)
  ) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','programming') and c.relkind in ('r','p')),
  'functions', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'definitionHash',md5(pg_get_functiondef(p.oid))
  ) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private','programming') and p.prokind in ('f','p')),
  'triggers', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
    'function',t.tgfoid::regprocedure::text,'definitionHash',md5(pg_get_triggerdef(t.oid))
  ) order by n.nspname,c.relname,t.tgname) from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
    where not t.tgisinternal and (n.nspname in ('public','private','programming')
      or pn.nspname in ('public','private','programming'))),
  'policies', (select jsonb_agg(jsonb_build_object(
    'schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'command',cmd,
    'usingHash',md5(coalesce(qual,'')),'checkHash',md5(coalesce(with_check,''))
  ) order by schemaname,tablename,policyname) from pg_policies
    where schemaname in ('public','private','programming','storage')),
  'grants', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'acl',c.relacl
  ) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','programming') and c.relkind in ('r','p','v','m','S')),
  'columnGrants', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'column',a.attname,'acl',a.attacl
  ) order by n.nspname,c.relname,a.attnum) from pg_attribute a
    join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','programming') and a.attnum>0 and not a.attisdropped and a.attacl is not null),
  'indexes', (select jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'valid',i.indisvalid,'definitionHash',md5(pg_get_indexdef(i.indexrelid))
  ) order by n.nspname,c.relname) from pg_index i join pg_class c on c.oid=i.indexrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','programming')),
  'defaultPrivileges', (select jsonb_agg(jsonb_build_object(
    'owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'kind',d.defaclobjtype,'acl',d.defaclacl
  ) order by n.nspname,d.defaclobjtype) from pg_default_acl d
    left join pg_namespace n on n.oid=d.defaclnamespace
    where n.nspname in ('public','private','programming') or d.defaclnamespace=0)
) as inventory;
