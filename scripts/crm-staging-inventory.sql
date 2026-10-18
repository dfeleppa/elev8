-- Read-only, sanitized prerequisite inventory. Run through an authenticated SQL
-- console/MCP against an explicitly identified project. No row identifiers,
-- emails, hashes, provider subjects, keys, or tokens are returned.
-- This is not a schema dump and never authorizes migration-history repair.
select jsonb_build_object(
  'captured_at', now(),
  'migrations', (select coalesce(jsonb_agg(jsonb_build_object('version', version, 'name', name) order by version), '[]'::jsonb) from supabase_migrations.schema_migrations),
  'identity', (select jsonb_build_object(
    'app_users', count(*), 'linked', count(supabase_auth_uid),
    'unlinked', count(*) filter (where supabase_auth_uid is null),
    'null_roles', count(*) filter (where role is null),
    'unknown_roles', count(*) filter (where role not in ('member','coach','admin','owner'))
  ) from public.app_users),
  'duplicate_links', (select count(*) from (select supabase_auth_uid from public.app_users where supabase_auth_uid is not null group by supabase_auth_uid having count(*) > 1) d),
  'orphan_links', (select count(*) from public.app_users a left join auth.users u on u.id = a.supabase_auth_uid where a.supabase_auth_uid is not null and u.id is null),
  'auth_providers', (select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'identities', identities)), '[]'::jsonb) from (select provider, count(*) as identities from auth.identities group by provider order by provider) p),
  'columns', (select coalesce(jsonb_agg(jsonb_build_object('table_name', table_name, 'column_name', column_name, 'data_type', data_type, 'nullable', is_nullable = 'YES') order by table_name, ordinal_position), '[]'::jsonb) from information_schema.columns where table_schema = 'public' and (table_name = 'crm_contacts' or (table_name = 'app_users' and column_name in ('id','supabase_auth_uid','email','full_name','role','password_hash','updated_at')))),
  'constraints', (select coalesce(jsonb_agg(jsonb_build_object('table_name', c.relname, 'type', con.contype, 'definition', pg_get_constraintdef(con.oid)) order by c.relname, con.conname), '[]'::jsonb) from pg_constraint con join pg_class c on con.conrelid = c.oid join pg_namespace n on c.relnamespace = n.oid where n.nspname = 'public' and c.relname in ('app_users','crm_contacts'))
) as inventory;
