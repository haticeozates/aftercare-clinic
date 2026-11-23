begin;
select no_plan();

create function pg_temp.actor(suffix text)
returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000' || suffix)::uuid
$$;
create function pg_temp.clinic(suffix text)
returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || suffix)::uuid
$$;
create function pg_temp.member_id(actor uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.organization_memberships where user_id=actor and status='active'
$$;
create function pg_temp.slot(day_offset integer, time_of_day text)
returns timestamp language sql stable as $$
  select ((now() at time zone 'Europe/Istanbul')::date + day_offset) + time_of_day::time
$$;
create function pg_temp.setup_notification_slot()
returns void language plpgsql as $$
declare alpha uuid := pg_temp.clinic('a1'); owner uuid := pg_temp.actor('a101'); staff uuid := pg_temp.member_id(pg_temp.actor('a103'));
begin
  perform public.phase12_configure(owner,alpha,'rule',jsonb_build_object('kind','work',
    'weekday',extract(isodow from pg_temp.slot(9,'09:00')),'start_minute',480,'end_minute',1000));
  perform public.phase12_configure(owner,alpha,'rule',jsonb_build_object('kind','work','membership_id',staff,
    'weekday',extract(isodow from pg_temp.slot(9,'09:00')),'start_minute',480,'end_minute',1000));
  perform public.phase12_configure(owner,alpha,'service',jsonb_build_object('procedure_id',pg_temp.actor('d101'),
    'minutes',30,'public_demo',true));
  perform public.phase12_configure(owner,alpha,'public','{"public_demo":true}');
  perform public.phase13_preferences(owner,alpha,'clinic',
    '{"email_enabled":true,"reminder_minutes":60,"daily_minute":540,"muted":["alert_review"]}');
  perform public.phase13_preferences(owner,alpha,'user',
    '{"email_enabled":true,"reminder_minutes":120,"muted":["alert_review"]}');
end
$$;
create function pg_temp.target()
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.appointments where organization_id=pg_temp.clinic('a1') and demo_reference='DEMO-1313'
$$;
create function pg_temp.receipt(actor uuid, event_kind public.notification_kind)
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.notification_receipts where user_id=actor and kind=event_kind and target_id=pg_temp.target()
  order by visible_at desc limit 1
$$;

set local role service_role;
select lives_ok('select pg_temp.setup_notification_slot()','Manager configures a test slot and opts in');
select throws_ok($$select public.phase13_preferences(pg_temp.actor('a103'),pg_temp.clinic('a1'),'clinic',
  '{"email_enabled":true,"reminder_minutes":60,"daily_minute":540}')$$,'42501',null,'Staff cannot change clinic preferences');
select throws_ok($$select public.phase13_mark(pg_temp.actor('b101'),pg_temp.clinic('a1'),null,true)$$,'42501',null,
  'A different tenant cannot bulk-mark notifications');
select lives_ok($$select public.phase12_request('organization-alpha',jsonb_build_object('procedure_id',pg_temp.actor('d101'),
 'membership_id',pg_temp.member_id(pg_temp.actor('a103')),'starts_at',pg_temp.slot(9,'09:00') at time zone 'Europe/Istanbul',
 'reference','DEMO-1313'))$$,'Online request transaction emits a notification');
select throws_ok($$select public.phase12_request('organization-alpha',jsonb_build_object('procedure_id',pg_temp.actor('d101'),
 'membership_id',pg_temp.member_id(pg_temp.actor('a103')),'starts_at',pg_temp.slot(9,'09:00') at time zone 'Europe/Istanbul',
 'reference','DEMO-1314'))$$,'23P01',null,'Failed booking rolls back its would-be event');
reset role;
select is((select count(*)::int from notification_private.events
  where organization_id=pg_temp.clinic('a1') and target_id=pg_temp.target() and kind='appointment_requested'),1,'Only one committed request event');
select ok(pg_temp.receipt(pg_temp.actor('a101'),'appointment_requested') is not null,'Owner receives the request');
select ok(pg_temp.receipt(pg_temp.actor('a102'),'appointment_requested') is not null,'Admin receives the request');
select ok(pg_temp.receipt(pg_temp.actor('a103'),'appointment_requested') is not null,'Assigned staff receives the request');
select ok(pg_temp.receipt(pg_temp.actor('b101'),'appointment_requested') is null,'Cross-tenant owner receives nothing');
select ok(not notification_private.is_muted(pg_temp.clinic('a1'),pg_temp.actor('a101'),'alert_review'),'Critical alerts cannot be muted');
select is((select count(*)::int from notification_private.mail_queue q join public.notification_receipts r on r.id=q.receipt_id
  where r.target_id=pg_temp.target()),0,'Pending request does not send mail');

set local role service_role;
select is(public.phase13_mark(pg_temp.actor('a101'),pg_temp.clinic('a1'),pg_temp.receipt(pg_temp.actor('a102'),'appointment_requested'),true),
  0,'Owner cannot mark another user receipt');
select is(public.phase13_mark(pg_temp.actor('a101'),pg_temp.clinic('a1'),pg_temp.receipt(pg_temp.actor('a101'),'appointment_requested'),true),
  1,'Owner can mark their receipt read');
select lives_ok($$select public.phase12_write(pg_temp.actor('a101'),pg_temp.clinic('a1'),'status',pg_temp.target(),
  jsonb_build_object('status','confirmed','client_id',pg_temp.actor('c101')))$$,'Approval records immediate and scheduled jobs');
reset role;
select ok((select read_at is null from public.notification_receipts
  where id=pg_temp.receipt(pg_temp.actor('a102'),'appointment_requested')),'Admin read state is independent');
select is((select count(*)::int from notification_private.mail_queue q join public.notification_receipts r on r.id=q.receipt_id
  where r.target_id=pg_temp.target()),2,'Only opted-in owner gets the approval email and reminder');
select is((select visible_at from public.notification_receipts where id=pg_temp.receipt(pg_temp.actor('a101'),'appointment_reminder')),
  (pg_temp.slot(9,'09:00') at time zone 'Europe/Istanbul') - interval '2 hours','User lead overrides clinic default in real UTC time');

set local role service_role;
select lives_ok($$select public.phase12_write(pg_temp.actor('a101'),pg_temp.clinic('a1'),'edit',pg_temp.target(),
  jsonb_build_object('local_start',pg_temp.slot(9,'10:00'),'client_id',pg_temp.actor('c101'),'procedure_id',pg_temp.actor('d101'),
  'membership_id',pg_temp.member_id(pg_temp.actor('a103')),'minutes',30))$$,'Reschedule is atomic with reminder replacement');
reset role;
select is((select count(*)::int from notification_private.mail_queue q join public.notification_receipts r on r.id=q.receipt_id
  where r.target_id=pg_temp.target() and r.kind='appointment_reminder' and q.status='cancelled'),1,'Old unsent reminder is cancelled');
select is((select count(*)::int from notification_private.events where target_id=pg_temp.target()
  and kind='appointment_reminder' and invalidated_at is null),1,'Exactly one reminder revision remains active');
select lives_ok($$select notification_private.emit(organization_id,event_key,kind,priority,target_id,anchor_at)
  from notification_private.events where target_id=pg_temp.target() and kind='appointment_rescheduled'$$,
  'Repeated event is idempotent');
select is((select count(*)::int from notification_private.events where target_id=pg_temp.target()
  and kind='appointment_rescheduled'),1,'Duplicate event cannot fan out again');

select set_config('request.jwt.claim.sub',pg_temp.actor('a101')::text,true);
set local role authenticated;
select is((select count(*)::int from public.notification_receipts where user_id=pg_temp.actor('a103')),0,
  'Authenticated cannot read another account receipt');
select is((select count(*)::int from public.notification_receipts where kind='appointment_reminder'),0,
  'Future reminders are not visible before their due time');
select throws_ok($$update public.notification_receipts set read_at=null$$,'42501',null,'Browser cannot write receipt state directly');
select throws_ok($$select notification_private.member(pg_temp.clinic('b1'),pg_temp.actor('b101'))$$,
  '42501',null,'Authenticated cannot probe another clinic membership');
select ok(not notification_private.current_member(pg_temp.clinic('b1')),'Current member helper is scoped to the signed-in actor');
select throws_ok($$select * from notification_private.mail_queue$$,'42501',null,'Queue is private');
select throws_ok($$select public.phase13_mark(pg_temp.actor('a101'),pg_temp.clinic('a1'),null,true)$$,
  '42501',null,'Service RPC cannot be called by browsers');
reset role;

create function pg_temp.follow_up()
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.appointments where organization_id=pg_temp.clinic('a1')
    and starts_at=(pg_temp.slot(9,'13:00') at time zone 'Europe/Istanbul')
$$;
create function pg_temp.save_follow_up(op text, item_kind text, plan uuid)
returns uuid language sql as $$
  select public.phase12_write(pg_temp.actor('a101'),pg_temp.clinic('a1'),op,
    case when op='edit' then pg_temp.follow_up() end,
    jsonb_build_object('kind',item_kind,'care_plan_id',plan,'local_start',pg_temp.slot(9,'13:00'),
      'client_id',pg_temp.actor('c101'),'procedure_id',pg_temp.actor('d101'),
      'membership_id',pg_temp.member_id(pg_temp.actor('a103')),'minutes',30))
$$;
set local role service_role;
select lives_ok($$select pg_temp.save_follow_up('create','follow_up',pg_temp.actor('e101'))$$,'Linked follow-up creates a reminder');
select lives_ok($$select pg_temp.save_follow_up('edit','follow_up',pg_temp.actor('e101'))$$,'A plain edit preserves the existing reminder');
reset role;
select is((select count(*)::int from notification_private.events where target_id=pg_temp.follow_up()
  and kind='follow_up_reminder' and invalidated_at is null),1,'Exactly one active follow-up reminder exists');
set local role service_role;
select lives_ok($$select pg_temp.save_follow_up('edit','procedure',null)$$,'Calendar can change kind at the same time');
reset role;
select is((select count(*)::int from notification_private.mail_queue q join public.notification_receipts n on n.id=q.receipt_id
  where n.target_id=pg_temp.follow_up() and n.kind='follow_up_reminder' and q.status='cancelled'),1,
  'Changing only the appointment kind cancels the old follow-up message');
select is((select count(*)::int from notification_private.events where target_id=pg_temp.follow_up()
  and kind='appointment_reminder' and invalidated_at is null),1,'The active replacement has the new appointment kind');

update public.organization_memberships set status='inactive' where user_id=pg_temp.actor('a103') and organization_id=pg_temp.clinic('a1');
select set_config('request.jwt.claim.sub',pg_temp.actor('a103')::text,true);
set local role authenticated;
select is((select count(*)::int from public.notification_receipts),0,'Revoked staff loses all previously delivered in-app access');
reset role;
set local role anon;
select throws_ok($$select * from public.notification_receipts$$,'42501',null,'Anonymous cannot read inbox data');
reset role;
select * from finish();
rollback;
