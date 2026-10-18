-- All inserts, including supported legacy clients, serialize on the class row.
-- SECURITY INVOKER: no new privileged callable API and no new client grants.
create or replace function public.guard_class_reservation_capacity()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare capacity integer;
begin
  select size_limit into capacity from public.schedule_classes where id = new.class_id for update;
  if not found then
    raise exception 'Class not found' using errcode = '23503';
  end if;
  if exists (select 1 from public.class_reservations where class_id = new.class_id and class_date = new.class_date and member_id = new.member_id) then
    raise exception 'Duplicate reservation' using errcode = '23505';
  end if;
  if capacity > 0 and (select count(*) from public.class_reservations where class_id = new.class_id and class_date = new.class_date) >= capacity then
    raise exception 'Class capacity reached' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_class_reservation_capacity() from public, anon, authenticated;
grant execute on function public.guard_class_reservation_capacity() to service_role;
create trigger class_reservation_capacity_guard
before insert on public.class_reservations
for each row execute function public.guard_class_reservation_capacity();
