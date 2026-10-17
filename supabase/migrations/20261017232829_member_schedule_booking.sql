-- Staging-only increment. Apply through an explicitly isolated CLI workdir.
-- No historical migrations or identities are rewritten.
begin;

-- Fail without modifying existing records if reconciliation is needed.
do $$ begin
  if exists (select 1 from public.class_reservations
    group by class_id, class_date, member_id having count(*) > 1) then
    raise exception 'Duplicate reservations require explicit reconciliation before this migration';
  end if;
end $$;

create unique index class_reservations_occurrence_member_uidx
  on public.class_reservations(class_id, class_date, member_id);
create index class_reservations_day_idx on public.class_reservations(class_date, class_id);

alter table public.class_reservations enable row level security;
alter table public.schedule_classes enable row level security;
revoke all on public.class_reservations, public.schedule_classes from public, anon, authenticated;

create table public.member_booking_operations (
  member_id uuid not null references public.app_users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (member_id, operation_id)
);
alter table public.member_booking_operations enable row level security;
revoke all on public.member_booking_operations from public, anon, authenticated, service_role;
grant select, insert on public.member_booking_operations to service_role;

-- SECURITY INVOKER throughout: functions are callable only by the trusted API role.
-- The API resolves p_member_id from a verified subject, never from a request body.
create function public.member_schedule_occurrence(
  p_class_id uuid, p_date date, p_member_id uuid,
  p_now timestamptz default clock_timestamp()
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.schedule_classes%rowtype;
  local_start timestamp;
  start_at timestamptz;
  cutoff_at timestamptz;
  time_valid boolean;
  reserved integer;
  mine uuid;
  state text;
begin
  select * into c from public.schedule_classes where id = p_class_id;
  if not found or p_date < c.start_date or (c.end_date is not null and p_date > c.end_date)
    or not ((array['Su','Mo','Tu','We','Th','Fr','Sa'])[extract(dow from p_date)::integer + 1] = any(c.class_days)) then
    return null;
  end if;
  local_start := p_date + c.class_time;
  start_at := local_start at time zone 'America/New_York';
  -- Never silently normalize a nonexistent time or choose one side of a repeated hour.
  time_valid := (start_at at time zone 'America/New_York') = local_start
    and ((start_at - interval '1 hour') at time zone 'America/New_York') <> local_start
    and ((start_at + interval '1 hour') at time zone 'America/New_York') <> local_start;
  cutoff_at := start_at - c.reservation_cutoff_hours * interval '1 hour';
  select count(*)::integer into reserved from public.class_reservations
    where class_id = c.id and class_date = p_date;
  select id into mine from public.class_reservations
    where class_id = c.id and class_date = p_date and member_id = p_member_id;
  state := case when not time_valid then 'invalid_time'
    when p_now >= cutoff_at then 'closed'
    when c.size_limit > 0 and reserved >= c.size_limit then 'full' else 'available' end;
  return jsonb_build_object(
    'classId', c.id, 'date', p_date, 'name', c.name,
    'timeZone', 'America/New_York',
    'startsAt', case when time_valid then start_at end,
    'endsAt', case when time_valid then start_at + c.duration_minutes * interval '1 minute' end,
    'bookingClosesAt', case when time_valid then cutoff_at end,
    'durationMinutes', c.duration_minutes,
    'track', (select jsonb_build_object('id', t.id, 'name', t.name) from public.programming_tracks t where t.id = c.track_id),
    'coach', (select jsonb_build_object('id', u.id, 'name', coalesce(u.full_name, 'Coach')) from public.app_users u where u.id = c.default_coach_user_id),
    'capacity', nullif(c.size_limit, 0), 'reservedCount', reserved,
    'remaining', case when c.size_limit = 0 then null else greatest(c.size_limit - reserved, 0) end,
    'reservationId', mine, 'availability', state,
    'canBook', mine is null and state = 'available', 'canCancel', mine is not null,
    'waitlistSupported', false
  );
end $$;

create function public.member_schedule_day(p_date date, p_member_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object('date', p_date, 'timeZone', 'America/New_York',
    'serverNow', clock_timestamp(),
    'sessions', coalesce(jsonb_agg(s.item order by c.class_time, c.id) filter (where s.item is not null), '[]'::jsonb))
  from public.schedule_classes c
  cross join lateral (select public.member_schedule_occurrence(c.id, p_date, p_member_id) as item) s;
$$;

create function public.member_schedule_mutate(
  p_member_id uuid, p_operation_id uuid, p_action text,
  p_class_id uuid default null, p_date date default null, p_reservation_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  input jsonb;
  previous public.member_booking_operations%rowtype;
  c public.schedule_classes%rowtype;
  class_id_value uuid := p_class_id;
  date_value date := p_date;
  reservation_id_value uuid;
  item jsonb;
  result_value jsonb;
  status_value integer;
  code_value text;
begin
  if not exists (select 1 from public.app_users where id = p_member_id
    and role in ('member','coach','admin','owner')) then
    return jsonb_build_object('status', 401, 'code', 'unauthorized');
  end if;
  if p_operation_id is null or p_action not in ('book','cancel','legacy_cancel')
    or p_action is null
    or (p_action in ('book','legacy_cancel') and (p_class_id is null or p_date is null))
    or (p_action = 'cancel' and p_reservation_id is null) then
    return jsonb_build_object('status', 400, 'code', 'invalid_input');
  end if;
  input := jsonb_build_object('action', p_action, 'classId', p_class_id,
    'date', p_date, 'reservationId', p_reservation_id);

  -- Always operation lock -> class lock. Replays on different classes cannot deadlock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_member_id::text || '/' || p_operation_id::text, 0));
  select * into previous from public.member_booking_operations
    where member_id = p_member_id and operation_id = p_operation_id;
  if found then
    if previous.request <> input then
      return jsonb_build_object('status', 409, 'code', 'operation_conflict');
    end if;
    -- Reconcile current state, rather than presenting an old success as a current booking.
    return previous.result || jsonb_build_object('replayed', true,
      'session', public.member_schedule_occurrence(
        (previous.result->>'classId')::uuid, (previous.result->>'date')::date, p_member_id));
  end if;

  if p_action = 'cancel' then
    select class_id, class_date into class_id_value, date_value from public.class_reservations
      where id = p_reservation_id and member_id = p_member_id;
  end if;
  select * into c from public.schedule_classes where id = class_id_value for update;
  if not found then
    status_value := 404; code_value := 'not_found';
  else
    -- This read is after waiting for the lock. All supported API writers use this function.
    item := public.member_schedule_occurrence(c.id, date_value, p_member_id, clock_timestamp());
    if p_action = 'book' then
      if item is null then
        status_value := 404; code_value := 'not_found';
      elsif item->>'reservationId' is not null then
        status_value := 200; code_value := 'already_booked';
        reservation_id_value := (item->>'reservationId')::uuid;
      elsif item->>'availability' <> 'available' then
        status_value := 409; code_value := item->>'availability';
      else
        insert into public.class_reservations(class_id, class_date, member_id)
          values (c.id, date_value, p_member_id) returning id into reservation_id_value;
        status_value := 201; code_value := 'booked';
      end if;
    else
      -- No cancellation deadline, fee, recurrence or start-time restriction.
      delete from public.class_reservations
        where class_id = c.id and class_date = date_value and member_id = p_member_id
          and (p_action = 'legacy_cancel' or id = p_reservation_id)
        returning id into reservation_id_value;
      if reservation_id_value is null and p_action = 'cancel' then
        status_value := 404; code_value := 'not_found';
      else
        status_value := 200; code_value := 'cancelled';
      end if;
    end if;
    item := public.member_schedule_occurrence(c.id, date_value, p_member_id, clock_timestamp());
  end if;
  result_value := jsonb_build_object('status', status_value, 'code', code_value,
    'classId', class_id_value, 'date', date_value, 'reservationId', reservation_id_value,
    'session', item, 'replayed', false);
  insert into public.member_booking_operations(member_id, operation_id, request, result)
    values (p_member_id, p_operation_id, input, result_value);
  return result_value;
end $$;

revoke all on function public.member_schedule_occurrence(uuid,date,uuid,timestamptz),
  public.member_schedule_day(date,uuid),
  public.member_schedule_mutate(uuid,uuid,text,uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.member_schedule_occurrence(uuid,date,uuid,timestamptz),
  public.member_schedule_day(date,uuid),
  public.member_schedule_mutate(uuid,uuid,text,uuid,date,uuid) to service_role;
-- Existing APIs still require the original table privileges; no identity policies change.
grant select, insert, delete on public.class_reservations to service_role;
grant select, update on public.schedule_classes to service_role;
commit;
