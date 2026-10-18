-- Transactional smoke verification. All synthetic rows are rolled back.
-- Run only against the explicitly selected Elev8 database after migrations.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
set local role service_role;
do $$
declare
  contact uuid := gen_random_uuid(); opportunity uuid := gen_random_uuid();
  operation uuid := gen_random_uuid(); lease uuid; class_id_test uuid := gen_random_uuid();
  members uuid[]; test_phone text := '+12025550199';
begin
  if exists(select 1 from public.crm_sms_preferences where phone=test_phone) then
    raise exception 'Synthetic phone already exists; choose a different fixture';
  end if;
  insert into public.crm_contacts(id,full_name,phone) values(contact,'Rollback verification',test_phone);
  update public.crm_contacts set full_name='Rollback verification updated' where id=contact;
  if (select version from public.crm_contacts where id=contact) <> 2 then raise exception 'Contact version failed'; end if;
  insert into public.crm_opportunities(id,contact_id,title) values(opportunity,contact,'Rollback opportunity');
  update public.crm_opportunities set stage='trial' where id=opportunity;
  if (select count(*) from public.crm_stage_events where opportunity_id=opportunity) <> 2 then raise exception 'Stage history failed'; end if;
  insert into public.crm_notes(id,contact_id,body) values(gen_random_uuid(),contact,'Rollback note');
  insert into public.crm_tasks(id,contact_id,opportunity_id,title,due_at) values(gen_random_uuid(),contact,opportunity,'Rollback task',now());
  insert into public.crm_sms_preferences(phone,allowed,evidence) values(test_phone,true,'Rollback-only synthetic fixture, not real consent');
  perform public.crm_sms_enqueue(operation,contact,test_phone,'Never sent',null);
  -- Claim only the synthetic operation, never run the global claim worker here.
  lease := gen_random_uuid();
  update public.crm_sms_outbox set state='leased',lease_token=lease,lease_until=now()+interval '2 minutes' where message_id=operation;
  perform public.crm_sms_begin(operation,lease);
  update public.crm_sms_outbox set state='uncertain',lease_until=now()-interval '1 minute' where message_id=operation;
  perform public.crm_sms_settle(operation,lease,'accepted','SMrollback-'||operation::text);
  if not exists(select 1 from public.crm_sms_outbox o join public.crm_sms_messages m on m.id=o.message_id where m.id=operation and o.state='accepted' and m.provider_sid='SMrollback-'||operation::text) then raise exception 'Late acceptance failed'; end if;
  perform public.crm_sms_event('rollback-stop-'||operation::text,null,'SMrollback-stop','stop',test_phone);
  if (select allowed from public.crm_sms_preferences where phone=test_phone) then raise exception 'Suppression failed'; end if;
  select array_agg(id) into members from (select id from public.app_users order by id limit 2) u;
  if array_length(members,1) <> 2 then raise exception 'Need two existing app IDs for rolled-back reservation checks'; end if;
  insert into public.schedule_classes(id,name,class_time,duration_minutes,class_days,start_date,size_limit)
    values(class_id_test,'Rollback verification','09:00',60,array['Mo'],'2099-04-06',1);
  insert into public.class_reservations(class_id,class_date,member_id) values(class_id_test,'2099-04-06',members[1]);
  begin
    insert into public.class_reservations(class_id,class_date,member_id) values(class_id_test,'2099-04-06',members[1]);
    raise exception 'Duplicate reservation unexpectedly accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.class_reservations(class_id,class_date,member_id) values(class_id_test,'2099-04-06',members[2]);
    raise exception 'Over-capacity reservation unexpectedly accepted';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'CRM, stage history, SMS recovery/suppression and booking guards passed; synthetic rows rolled back' as result;
