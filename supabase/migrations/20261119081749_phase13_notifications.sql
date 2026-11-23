create schema notification_private;
revoke all on schema notification_private from public, anon, authenticated, service_role;
grant usage on schema notification_private to authenticated, service_role;

create type public.notification_kind as enum (
  'appointment_requested', 'appointment_confirmed', 'appointment_rescheduled', 'appointment_cancelled',
  'appointment_reminder', 'follow_up_reminder', 'plan_created', 'daily_task_reminder',
  'checkin_received', 'photo_received', 'alert_review', 'data_request_received'
);
create type public.notification_priority as enum ('high', 'normal', 'low');

create table public.notification_clinic_preferences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  email_enabled boolean not null default false,
  muted public.notification_kind[] not null default '{}',
  reminder_minutes integer not null default 1440 check (reminder_minutes between 5 and 10080),
  daily_minute integer not null default 540 check (daily_minute between 0 and 1439),
  quiet_from integer check (quiet_from between 0 and 1439),
  quiet_until integer check (quiet_until between 0 and 1439),
  check ((quiet_from is null and quiet_until is null)
    or (quiet_from is not null and quiet_until is not null and quiet_from <> quiet_until))
);

create table public.notification_user_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  muted public.notification_kind[] not null default '{}',
  reminder_minutes integer check (reminder_minutes between 5 and 10080),
  primary key (organization_id,user_id)
);

create table notification_private.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_key text not null check (length(event_key) <= 120),
  kind public.notification_kind not null,
  priority public.notification_priority not null,
  target_id uuid not null,
  anchor_at timestamptz,
  created_at timestamptz not null default now(),
  invalidated_at timestamptz,
  unique (organization_id,event_key),
  unique (organization_id,id)
);
create index notification_event_target on notification_private.events(organization_id,target_id,kind);

create table public.notification_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.notification_kind not null,
  priority public.notification_priority not null,
  target_id uuid not null,
  visible_at timestamptz not null,
  read_at timestamptz,
  unique (event_id,user_id),
  foreign key (organization_id,event_id) references notification_private.events(organization_id,id) on delete cascade
);
create index notification_inbox_order on public.notification_receipts(organization_id,user_id,visible_at desc,id);
create index notification_inbox_unread on public.notification_receipts(organization_id,user_id,visible_at desc)
  where read_at is null;

create table notification_private.mail_queue (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references public.notification_receipts(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','retry','sent','failed','cancelled')),
  next_attempt_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 4),
  completed_at timestamptz,
  provider_receipt text check (provider_receipt is null or length(provider_receipt) <= 128)
);
create index notification_mail_ready on notification_private.mail_queue(next_attempt_at, id)
  where status in ('queued','retry');
create table notification_private.mail_attempts (
  queue_id uuid not null references notification_private.mail_queue(id) on delete cascade,
  attempt integer not null,
  result text not null check (result in ('accepted','reconciled','provider_unavailable','provider_rejected')),
  happened_at timestamptz not null default clock_timestamp(),
  primary key (queue_id,attempt)
);

alter table public.notification_clinic_preferences enable row level security;
alter table public.notification_user_preferences enable row level security;
alter table public.notification_receipts enable row level security;
alter table notification_private.events enable row level security;
alter table notification_private.mail_queue enable row level security;
alter table notification_private.mail_attempts enable row level security;
revoke all on public.notification_clinic_preferences, public.notification_user_preferences,
  public.notification_receipts from public, anon, authenticated, service_role;
grant select on public.notification_clinic_preferences, public.notification_user_preferences,
  public.notification_receipts to authenticated;

create function notification_private.member(clinic uuid, actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.organization_id=clinic and m.user_id=actor and m.status='active' and o.status='active')
$$;

create function notification_private.current_member(clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select notification_private.member(clinic,(select auth.uid()))
$$;

create function notification_private.allowed(clinic uuid, actor uuid, event_kind public.notification_kind, target uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id and o.status='active'
    join public.roles r on r.id=m.role_id
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where m.organization_id=clinic and m.user_id=actor and m.status='active'
    and (
      (event_kind::text like 'appointment_%' or event_kind='follow_up_reminder')
      and p.key='client.read'
      and exists (select 1 from public.appointments a where a.organization_id=clinic and a.id=target
        and (r.key in ('organization_owner','organization_admin') or a.membership_id=m.id))
      or event_kind in ('plan_created','daily_task_reminder','checkin_received','photo_received')
      and p.key=(case when event_kind='photo_received' then 'photo.view' else 'plan.read' end)
      and exists (select 1 from public.care_plans a where a.organization_id=clinic and a.id=target
        and (r.key in ('organization_owner','organization_admin') or a.responsible_membership_id=m.id))
      or event_kind='alert_review' and p.key='alert.read'
      and exists (select 1 from public.alerts a where a.organization_id=clinic and a.id=target)
      or event_kind='data_request_received' and p.key='data_request.read'
      and exists (select 1 from public.data_requests a where a.organization_id=clinic and a.id=target
        and (r.key in ('organization_owner','organization_admin') or a.assigned_to_user_id=actor))
    )
  )
$$;

create function notification_private.is_muted(clinic uuid, actor uuid, event_kind public.notification_kind)
returns boolean language sql stable set search_path = '' as $$
  select case when event_kind='alert_review' then false else
    coalesce((select event_kind=any(muted) from public.notification_clinic_preferences where organization_id=clinic),false)
    or coalesce((select event_kind=any(muted) from public.notification_user_preferences where organization_id=clinic
      and user_id=actor),false) end
$$;

create function notification_private.readable(clinic uuid, event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from notification_private.events e where e.organization_id=clinic and e.id=event
    and e.invalidated_at is null and notification_private.allowed(clinic,(select auth.uid()),e.kind,e.target_id)
    and not notification_private.is_muted(clinic,(select auth.uid()),e.kind))
$$;

create policy notification_own_receipt on public.notification_receipts for select to authenticated
  using (user_id=(select auth.uid()) and visible_at<=now() and notification_private.readable(organization_id,event_id));
create policy notification_own_preferences on public.notification_user_preferences for select to authenticated
  using (user_id=(select auth.uid()) and notification_private.current_member(organization_id));
create policy notification_clinic_preferences_read on public.notification_clinic_preferences for select to authenticated
  using (notification_private.current_member(organization_id));

create function notification_private.due_at(clinic uuid, actor uuid, anchor timestamptz, event_time timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select case when anchor is null then event_time else greatest(event_time, anchor - make_interval(mins=>coalesce(
    (select reminder_minutes from public.notification_user_preferences where organization_id=clinic and user_id=actor),
    (select reminder_minutes from public.notification_clinic_preferences where organization_id=clinic),1440))) end
$$;

create function notification_private.mail_kind(event_kind public.notification_kind)
returns boolean language sql immutable set search_path = '' as $$
  select event_kind in ('appointment_confirmed','appointment_rescheduled','appointment_cancelled',
    'appointment_reminder','follow_up_reminder')
$$;

create function notification_private.emit(clinic uuid, key text, event_kind public.notification_kind,
  event_priority public.notification_priority, target uuid, anchor timestamptz default null)
returns void language plpgsql set search_path = '' as $$
declare evt notification_private.events%rowtype;
begin
  insert into notification_private.events(organization_id,event_key,kind,priority,target_id,anchor_at)
    values(clinic,key,event_kind,event_priority,target,anchor)
    on conflict(organization_id,event_key) do nothing returning * into evt;
  if not found then return; end if;

  with audience as (
    insert into public.notification_receipts(organization_id,event_id,user_id,kind,priority,target_id,visible_at)
    select clinic,evt.id,m.user_id,evt.kind,evt.priority,evt.target_id,
      notification_private.due_at(clinic,m.user_id,evt.anchor_at,evt.created_at)
    from public.organization_memberships m
    where m.organization_id=clinic and m.status='active'
      and notification_private.allowed(clinic,m.user_id,evt.kind,evt.target_id)
    returning id,user_id,visible_at
  )
  insert into notification_private.mail_queue(receipt_id,next_attempt_at)
    select a.id,a.visible_at from audience a
    where notification_private.mail_kind(event_kind)
      and exists(select 1 from public.notification_clinic_preferences c where c.organization_id=clinic and c.email_enabled)
      and exists(select 1 from public.notification_user_preferences u where u.organization_id=clinic
        and u.user_id=a.user_id and u.email_enabled)
      and not notification_private.is_muted(clinic,a.user_id,event_kind);
end
$$;

create function notification_private.invalidate_reminders(clinic uuid, target uuid)
returns void language sql set search_path = '' as $$
  with invalidated as (
    update notification_private.events
    set invalidated_at=clock_timestamp()
    where organization_id=clinic and target_id=target and kind in ('appointment_reminder','follow_up_reminder')
      and invalidated_at is null
    returning id
  )
  update notification_private.mail_queue q set status='cancelled', completed_at=clock_timestamp()
  from public.notification_receipts n, invalidated i
  where n.event_id=i.id and q.receipt_id=n.id and q.status in ('queued','retry')
$$;

create function notification_private.appointment_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_kind public.notification_kind;
  item_kind text;
  reminder_kind public.notification_kind;
  key text := 'appointment-event:' || new.id;
begin
  event_kind := case new.event
    when 'requested' then 'appointment_requested'
    when 'confirmed' then 'appointment_confirmed'
    when 'rescheduled' then 'appointment_rescheduled'
    when 'cancelled' then 'appointment_cancelled'
    when 'rejected' then 'appointment_cancelled'
    else null end;
  if event_kind is not null then
    perform notification_private.emit(new.organization_id,key,event_kind,
      case when new.event='requested' then 'high'::public.notification_priority else 'normal' end,
      new.appointment_id);
  end if;

  if new.event in ('rescheduled','cancelled','rejected','completed','no_show') then
    perform notification_private.invalidate_reminders(new.organization_id,new.appointment_id);
  end if;
  if new.event in ('created','confirmed','rescheduled','updated') and new.status='confirmed' and new.starts_at>now() then
    select kind into item_kind from public.appointments where organization_id=new.organization_id and id=new.appointment_id;
    reminder_kind := case when item_kind='follow_up' then 'follow_up_reminder'::public.notification_kind
      else 'appointment_reminder'::public.notification_kind end;
    if new.event='updated' then
      -- Plain edits retain the existing job. A change of appointment kind replaces its reminder.
      if not exists (select 1 from notification_private.events e
        where e.organization_id=new.organization_id and e.target_id=new.appointment_id
          and e.kind in ('appointment_reminder','follow_up_reminder')
          and e.kind<>reminder_kind and e.invalidated_at is null) then
        return new;
      end if;
      perform notification_private.invalidate_reminders(new.organization_id,new.appointment_id);
    end if;
    perform notification_private.emit(new.organization_id,key || ':reminder',reminder_kind,
      'normal',new.appointment_id,new.starts_at);
  end if;
  return new;
end
$$;
create trigger phase13_appointment_event after insert on public.appointment_events
  for each row execute function notification_private.appointment_event();

create function notification_private.clinical_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_kind public.notification_kind;
  priority public.notification_priority := 'normal';
  target uuid := new.id;
begin
  case tg_table_name
    when 'care_plans' then event_kind := 'plan_created';
    when 'symptom_reports' then event_kind := 'checkin_received'; target := new.care_plan_id;
    when 'photo_records' then event_kind := 'photo_received'; target := new.care_plan_id;
    when 'alerts' then event_kind := 'alert_review'; priority := 'high';
    when 'data_requests' then event_kind := 'data_request_received'; priority := 'high';
  end case;
  perform notification_private.emit(new.organization_id,tg_table_name || ':' || new.id,event_kind,priority,target);
  return new;
end
$$;
create trigger phase13_plan_created after insert on public.care_plans
  for each row execute function notification_private.clinical_event();
create trigger phase13_checkin_received after insert on public.symptom_reports
  for each row execute function notification_private.clinical_event();
create trigger phase13_photo_received after insert on public.photo_records
  for each row when (new.processing_status='ready') execute function notification_private.clinical_event();
create trigger phase13_alert_review after insert on public.alerts
  for each row when (new.status='open') execute function notification_private.clinical_event();
create trigger phase13_data_request_received after insert on public.data_requests
  for each row execute function notification_private.clinical_event();

create function notification_private.sweep_tasks(moment timestamptz)
returns integer language plpgsql set search_path = '' as $$
declare
  item record;
  count_created integer := 0;
  portal_day date := (moment at time zone 'Europe/Istanbul')::date;
begin
  for item in
    select d.id,d.care_plan_id,d.organization_id from public.care_plan_days d
    join public.care_plans p on p.id=d.care_plan_id and p.organization_id=d.organization_id
    join public.organizations o on o.id=d.organization_id and o.status='active'
    left join public.notification_clinic_preferences prefs on prefs.organization_id=d.organization_id
    where d.scheduled_date=portal_day and p.status in ('active','scheduled')
      and p.start_date<=portal_day and p.end_date>=portal_day and d.status not in ('skipped','completed')
      and ((d.scheduled_date + make_interval(mins=>coalesce(prefs.daily_minute,540)))
        at time zone public.phase12_zone(d.organization_id)) <= moment
      and exists(select 1 from public.care_plan_tasks t where t.organization_id=d.organization_id
        and t.care_plan_day_id=d.id and t.required and t.status='pending' and t.task_type<>'information')
      and not exists(select 1 from notification_private.events e
        where e.organization_id=d.organization_id and e.event_key='daily:' || d.id)
    order by d.id limit 200
  loop
    perform notification_private.emit(item.organization_id,'daily:' || item.id,'daily_task_reminder','low',item.care_plan_id);
    count_created := count_created + 1;
  end loop;
  return count_created;
end
$$;

create function notification_private.refresh_due(clinic uuid, actor uuid)
returns void language sql set search_path = '' as $$
  with shifted as (
    update public.notification_receipts r
    set visible_at=notification_private.due_at(clinic,r.user_id,e.anchor_at,e.created_at)
    from notification_private.events e
    where e.id=r.event_id and e.organization_id=clinic and e.anchor_at>now()
      and e.invalidated_at is null and r.visible_at>now() and r.read_at is null
      and (actor is null or r.user_id=actor)
    returning r.id,r.visible_at
  )
  update notification_private.mail_queue q set next_attempt_at=s.visible_at from shifted s
  where q.receipt_id=s.id and q.status='queued' and q.attempts=0
$$;

create function public.phase13_preferences(actor uuid, clinic uuid, scope text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  muted_kinds public.notification_kind[] := array(
    select value::public.notification_kind from jsonb_array_elements_text(coalesce(payload->'muted','[]')) x(value)
      where value <> 'alert_review');
  email_on boolean := coalesce((payload->>'email_enabled')::boolean,false);
  lead integer := (payload->>'reminder_minutes')::int;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text,0));
  if not notification_private.member(clinic,actor) then raise exception 'Notification access denied' using errcode='42501'; end if;
  if scope='user' then
    insert into public.notification_user_preferences (organization_id,user_id,email_enabled,muted,reminder_minutes)
      values(clinic,actor,email_on,muted_kinds,lead)
      on conflict(organization_id,user_id) do update set
        email_enabled=excluded.email_enabled,muted=excluded.muted,reminder_minutes=excluded.reminder_minutes;
    perform notification_private.refresh_due(clinic,actor);
  elsif scope='clinic' and coalesce(public.phase11_actor_role(actor,clinic) in ('organization_owner','organization_admin'),false) then
    insert into public.notification_clinic_preferences
      (organization_id,email_enabled,muted,reminder_minutes,daily_minute,quiet_from,quiet_until)
      values(clinic,email_on,muted_kinds,lead,(payload->>'daily_minute')::int,
        (payload->>'quiet_from')::int,(payload->>'quiet_until')::int)
      on conflict(organization_id) do update set email_enabled=excluded.email_enabled,muted=excluded.muted,
        reminder_minutes=excluded.reminder_minutes,daily_minute=excluded.daily_minute,
        quiet_from=excluded.quiet_from,quiet_until=excluded.quiet_until;
    perform notification_private.refresh_due(clinic,null);
  else raise exception 'Notification access denied' using errcode='42501';
  end if;
end
$$;

create function public.phase13_mark(actor uuid, clinic uuid, receipt uuid, mark_read boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if not notification_private.member(clinic,actor) then raise exception 'Notification access denied' using errcode='42501'; end if;
  if receipt is null and not mark_read then raise exception 'Invalid request' using errcode='22023'; end if;
  update public.notification_receipts n set read_at=case when mark_read then now() else null end
  from notification_private.events e
  where e.id=n.event_id and n.organization_id=clinic and n.user_id=actor and n.visible_at<=now()
    and e.invalidated_at is null and (receipt is null or n.id=receipt)
    and (n.read_at is null)=mark_read and notification_private.allowed(clinic,actor,n.kind,n.target_id)
    and not notification_private.is_muted(clinic,actor,n.kind);
  get diagnostics changed=row_count;
  return changed;
end
$$;

revoke all on all functions in schema notification_private from public, anon, authenticated, service_role;
grant execute on function notification_private.current_member(uuid), notification_private.readable(uuid,uuid) to authenticated;
revoke all on function public.phase13_preferences(uuid,uuid,text,jsonb), public.phase13_mark(uuid,uuid,uuid,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.phase13_preferences(uuid,uuid,text,jsonb), public.phase13_mark(uuid,uuid,uuid,boolean)
  to service_role;
