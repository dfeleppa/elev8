do $$
declare t text;
begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261017232829') then
    raise exception 'Booking migration is not recorded';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='class_reservations_occurrence_member_uidx' and indexdef like 'CREATE UNIQUE%') then
    raise exception 'Reservation uniqueness missing';
  end if;
  foreach t in array array['schedule_classes','class_reservations','member_booking_operations'] loop
    if not (select relrowsecurity from pg_class where oid=('public.' || t)::regclass) then raise exception 'RLS missing for %',t; end if;
    if has_table_privilege('anon','public.' || t,'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated','public.' || t,'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Unexpected client privileges on %',t;
    end if;
  end loop;
  if has_function_privilege('anon','public.member_schedule_mutate(uuid,uuid,text,uuid,date,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.member_schedule_mutate(uuid,uuid,text,uuid,date,uuid)','EXECUTE') then
    raise exception 'Booking RPC exposed to clients';
  end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'member_schedule_%' and prosecdef) then
    raise exception 'Unexpected SECURITY DEFINER';
  end if;
end $$;
