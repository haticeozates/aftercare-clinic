create schema analytics_private;
revoke all on schema analytics_private from public, anon, authenticated, service_role;
grant usage on schema analytics_private to authenticated;

create index analytics_plan_day_date on public.care_plan_days(organization_id,scheduled_date,care_plan_id);
create index analytics_alert_created on public.alerts(organization_id,created_at,care_plan_id);
create index analytics_photo_request_created on public.photo_requests(organization_id,created_at,care_plan_id);
create index analytics_follow_up on public.appointments(organization_id,starts_at)
  where kind='follow_up' and status='confirmed';
create index analytics_checkin_option on public.care_plan_symptom_options(organization_id,care_plan_id) where active;

create table analytics_private.csv_exports (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id) on delete set null,
  from_day date not null,
  to_day date not null,
  member_filter boolean not null,
  procedure_filter boolean not null,
  appointment_status text,
  requested_at timestamptz not null default now()
);
alter table analytics_private.csv_exports enable row level security;
revoke all on analytics_private.csv_exports from public, anon, authenticated, service_role;

create function analytics_private.capacity(clinic uuid, first_day date, last_day date, zone text, member_id uuid)
returns jsonb language sql stable set search_path='' as $$
  with people as materialized (
    select m.id from public.organization_memberships m
    where m.organization_id=clinic and m.status='active' and (member_id is null or m.id=member_id)
      and exists(select 1 from public.appointment_availability a
        where a.organization_id=clinic and a.membership_id=m.id and a.kind='work')
  ), days as (
    select first_day+i as day,extract(isodow from first_day+i)::int as dow
    from generate_series(0,last_day-first_day) i
  ), intervals as (
    select p.id,d.day,
      (coalesce(ranges.clinic_work,'{}') * coalesce(ranges.member_work,'{}')) - coalesce(ranges.blocks,'{}') as span
    from people p cross join days d
    cross join lateral (
      select
        range_agg(x.span) filter(where x.kind='work' and x.membership_id is null) as clinic_work,
        range_agg(x.span) filter(where x.kind='work' and x.membership_id=p.id) as member_work,
        range_agg(x.span) filter(where x.kind <> 'work') as blocks
      from (
        select a.membership_id,a.kind,
          tstzrange((d.day+make_interval(mins=>a.start_minute)) at time zone zone,
                    (d.day+make_interval(mins=>a.end_minute)) at time zone zone,'[)') as span
        from public.appointment_availability a
        where a.organization_id=clinic and (a.membership_id is null or a.membership_id=p.id)
          and (a.weekday=d.dow or a.local_date=d.day)
          -- A missing hour on a DST change can collapse or reverse a wall interval.
          and (d.day+make_interval(mins=>a.start_minute)) at time zone zone
             < (d.day+make_interval(mins=>a.end_minute)) at time zone zone
      ) x
    ) ranges
  ), capacity as (
    select coalesce(sum(extract(epoch from upper(r)-lower(r))/60),0) as minutes
    from intervals i cross join lateral unnest(i.span) r
  ), reserved as (
    select coalesce(sum(extract(epoch from upper(r)-lower(r))/60),0) as minutes
    from intervals i
    join public.appointments a on a.organization_id=clinic and a.membership_id=i.id
      and a.status in ('pending','confirmed') and a.starts_at<(i.day+1)::timestamp at time zone zone
      and a.ends_at>i.day::timestamp at time zone zone
    cross join lateral unnest(i.span * tstzmultirange(tstzrange(a.starts_at,a.ends_at,'[)'))) r
  )
  select case when capacity.minutes>0 then jsonb_build_object(
    'minutes',capacity.minutes,'reserved',reserved.minutes,'members',(select count(*) from people))
    else null end from capacity,reserved
$$;

create function analytics_private.period(clinic uuid, first_day date, last_day date, zone text, member_id uuid,
  procedure_id uuid, booking_status text, bucket text, detail boolean)
returns jsonb language sql stable set search_path='' as $$
  with appointments as materialized (
    select a.membership_id,a.procedure_id,a.status,a.source,a.kind,a.starts_at at time zone zone as local_start
    from public.appointments a
    where a.organization_id=clinic and a.starts_at>=first_day::timestamp at time zone zone
      and a.starts_at<(last_day+1)::timestamp at time zone zone
      and (member_id is null or a.membership_id=member_id)
      and (period.procedure_id is null or a.procedure_id=period.procedure_id)
      and (booking_status is null or a.status=booking_status)
  ), plans as (
    select p.id,p.status,p.stopped_at
    from public.care_plans p where p.organization_id=clinic
      and (member_id is null or p.responsible_membership_id=member_id)
      and (period.procedure_id is null or p.procedure_id=period.procedure_id)
  ), days as materialized (
    select d.id,d.scheduled_date,
      p.stopped_at is not null and d.scheduled_date >= (p.stopped_at at time zone 'Europe/Istanbul')::date as stopped
    from public.care_plan_days d join plans p on p.id=d.care_plan_id
    where d.organization_id=clinic and d.scheduled_date between first_day and least(last_day,public.portal_today())
      and d.status<>'skipped'
      and (p.status<>'stopped' or d.scheduled_date <= (p.stopped_at at time zone 'Europe/Istanbul')::date)
  ), checkins as materialized (
    select d.scheduled_date,r.id is not null as submitted
    from days d join public.care_plan_days original on original.id=d.id and original.organization_id=clinic
    left join public.symptom_reports r on r.organization_id=clinic and r.care_plan_day_id=d.id
    where (not d.stopped or r.id is not null)
      and exists(select 1 from public.care_plan_symptom_options o
        where o.organization_id=clinic and o.care_plan_id=original.care_plan_id and o.active)
  ), alert_rows as materialized (
    select a.status from public.alerts a join plans p on p.id=a.care_plan_id
    where a.organization_id=clinic and a.created_at>=first_day::timestamp at time zone 'Europe/Istanbul'
      and a.created_at<(last_day+1)::timestamp at time zone 'Europe/Istanbul'
  ), photo_rows as materialized (
    select q.status,q.status='active' and exists(select 1 from public.photo_records r
        where r.organization_id=clinic and r.photo_request_id=q.id and r.processing_status='ready') as ready
    from public.photo_requests q join plans p on p.id=q.care_plan_id
    where q.organization_id=clinic and q.created_at>=first_day::timestamp at time zone 'Europe/Istanbul'
      and q.created_at<(last_day+1)::timestamp at time zone 'Europe/Istanbul'
  ), tasks as (
    select count(*) as due,count(*) filter(where t.status='completed') as done
    from days d join public.care_plan_tasks t on t.organization_id=clinic and t.care_plan_day_id=d.id
    where t.required and t.task_type<>'information' and t.status<>'skipped'
      and (not d.stopped or t.status='completed')
  ), totals as (
    select count(*) as total,count(*) filter(where status='completed') as completed,
      count(*) filter(where status='pending') as pending,
      count(*) filter(where status='no_show') as no_show,count(*) filter(where status='cancelled') as cancelled,
      count(*) filter(where status in ('completed','no_show','cancelled')) as terminal,
      count(*) filter(where kind='follow_up') as follow_ups
    from appointments
  ), periods as (
    select distinct date_trunc(bucket, (first_day+i)::timestamp)::date as day
    from generate_series(0,last_day-first_day) i
  ), appointment_trend as (
    select date_trunc(bucket,local_start)::date as day,count(*) as amount from appointments group by 1
  ), checkin_trend as (
    select date_trunc(bucket,scheduled_date::timestamp)::date as day,count(*) filter(where submitted) as amount
    from checkins group by 1
  ), charts as (
    select jsonb_build_object(
      'trend', (select jsonb_agg(jsonb_build_array(p.day,coalesce(a.amount,0),coalesce(c.amount,0)) order by p.day)
                from periods p left join appointment_trend a using(day) left join checkin_trend c using(day)),
      'status', coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from appointments group by 1) x),'{}'),
      'source', coalesce((select jsonb_object_agg(source,n) from (select source,count(*) n from appointments group by 1) x),'{}'),
      'procedure', coalesce((select jsonb_object_agg(x.procedure_id,n) from
        (select a.procedure_id,count(*) n from appointments a group by 1) x),'{}'),
      'member', coalesce((select jsonb_object_agg(membership_id,n) from (select membership_id,count(*) n from appointments group by 1) x),'{}'),
      'heat', coalesce((select jsonb_agg(jsonb_build_array(d,h,n) order by d,h) from (
        select extract(isodow from local_start)::int d,extract(hour from local_start)::int h,count(*) n
        from appointments group by 1,2) x),'[]'),
      'alerts', coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from alert_rows group by 1) x),'{}'),
      'photos',(select jsonb_build_object('ready',count(*) filter(where ready),
        'waiting',count(*) filter(where status='active' and not ready),'cancelled',count(*) filter(where status='cancelled')) from photo_rows)
    ) as value
  )
  select jsonb_build_object('appointments',to_jsonb(totals),'tasks',to_jsonb(tasks),'checkins',
    (select jsonb_build_object('due',count(*),'done',count(*) filter(where submitted)) from checkins))
    || case when detail then (select value from charts) else '{}'::jsonb end
  from totals,tasks
$$;

create function analytics_private.report(clinic uuid, preset text, custom_from date, custom_to date, requested_member uuid,
  requested_procedure uuid, booking_status text, bucket text, export_csv boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.phase11_actor_role(actor,clinic);
  own_member uuid;
  member_id uuid := requested_member;
  zone text := public.phase12_zone(clinic);
  today date := (now() at time zone zone)::date;
  first_day date;
  last_day date;
  prior_from date;
  prior_to date;
  current_data jsonb;
  previous_data jsonb;
  snapshot jsonb;
  capacity_data jsonb;
begin
  if actor_role is null or actor_role not in ('organization_owner','organization_admin','staff')
    or (actor_role='staff' and export_csv) then
    raise exception 'Report access denied' using errcode='42501';
  end if;
  if actor_role='staff' then
    select m.id into own_member from public.organization_memberships m
      where m.organization_id=clinic and m.user_id=actor and m.status='active';
    if own_member is null or (requested_member is not null and requested_member<>own_member) then
      raise exception 'Report access denied' using errcode='42501';
    end if;
    member_id := own_member;
  end if;
  if (member_id is not null and not exists(select 1 from public.organization_memberships m where m.organization_id=clinic and m.id=member_id))
    or (requested_procedure is not null and not exists(select 1 from public.procedures p where p.organization_id=clinic and p.id=requested_procedure)) then
    raise exception 'Report access denied' using errcode='42501';
  end if;
  if preset is null or preset not in ('today','7','30','month','custom')
    or bucket is null or bucket not in ('day','week','month') or export_csv is null
    or (booking_status is not null and booking_status not in ('pending','confirmed','completed','cancelled','no_show')) then
    raise exception 'Invalid report filters' using errcode='22023';
  end if;
  first_day := case preset when 'today' then today when '7' then today-6 when '30' then today-29
    when 'month' then date_trunc('month',today::timestamp)::date else custom_from end;
  last_day := case when preset='custom' then custom_to else today end;
  if first_day is null or last_day is null or first_day<'2000-01-01' or last_day>'2099-12-31'
    or first_day>last_day or last_day-first_day>365 then
    raise exception 'Invalid report dates' using errcode='22023';
  end if;
  prior_to := first_day-1;
  prior_from := prior_to-(last_day-first_day);
  current_data := analytics_private.period(clinic,first_day,last_day,zone,member_id,requested_procedure,booking_status,bucket,true);
  previous_data := analytics_private.period(clinic,prior_from,prior_to,zone,member_id,requested_procedure,booking_status,bucket,false);

  with plans as materialized (
    select p.id,p.client_id,case when p.status='scheduled' and p.start_date<=public.portal_today()
      then 'active' else p.status end as status
    from public.care_plans p where p.organization_id=clinic
      and (member_id is null or p.responsible_membership_id=member_id)
      and (requested_procedure is null or p.procedure_id=requested_procedure)
  )
  select jsonb_build_object(
    'clients',(select count(*) from public.clients c where c.organization_id=clinic and c.status='active'
      and ((member_id is null and requested_procedure is null)
        or (requested_procedure is null and c.responsible_membership_id=member_id)
        or exists(select 1 from plans p where p.client_id=c.id)
        or exists(select 1 from public.appointments a where a.organization_id=clinic and a.client_id=c.id
          and (member_id is null or a.membership_id=member_id)
          and (requested_procedure is null or a.procedure_id=requested_procedure)))),
    'plans',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from plans group by 1) x),'{}'),
    'alerts',(select count(*) from public.alerts a join plans p on p.id=a.care_plan_id
      where a.organization_id=clinic and a.status='open'),
    'follow_ups',(select count(*) from public.appointments a where a.organization_id=clinic and a.kind='follow_up'
      and a.status='confirmed' and a.starts_at>=now() and a.starts_at<(today+14)::timestamp at time zone zone
      and (member_id is null or a.membership_id=member_id)
      and (requested_procedure is null or a.procedure_id=requested_procedure))
  ) into snapshot;

  if first_day>today and last_day-first_day<=30 and requested_procedure is null and booking_status is null then
    capacity_data := analytics_private.capacity(clinic,first_day,last_day,zone,member_id);
  end if;

  if export_csv then
    insert into analytics_private.csv_exports(organization_id,actor_id,from_day,to_day,member_filter,procedure_filter,appointment_status)
    values(clinic,actor,first_day,last_day,requested_member is not null,requested_procedure is not null,booking_status);
  end if;

  return jsonb_build_object(
    'zone',zone,'first',first_day,'last',last_day,'priorFirst',prior_from,'priorLast',prior_to,
    'current',current_data,'previous',previous_data,'snapshot',snapshot,'capacity',capacity_data,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code) order by code),'[]') from (
      select id,number as code from (
        select m.id,row_number() over(order by m.created_at,m.id) as number
        from public.organization_memberships m where m.organization_id=clinic
      ) numbered where own_member is null or id=own_member
    ) x),
    'procedures',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code),'[]') from (
      select q.id,row_number() over(order by q.created_at,q.id) as code,q.name from public.procedures q where q.organization_id=clinic
    ) p)
  );
end
$$;

create function public.phase15_report(clinic uuid,preset text,custom_from date,custom_to date,requested_member uuid,
  requested_procedure uuid,booking_status text,bucket text,export_csv boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select analytics_private.report(clinic,preset,custom_from,custom_to,requested_member,requested_procedure,booking_status,bucket,export_csv)
$$;

revoke all on all functions in schema analytics_private from public, anon, authenticated, service_role;
grant execute on function analytics_private.report(uuid,text,date,date,uuid,uuid,text,text,boolean) to authenticated;
revoke all on function public.phase15_report(uuid,text,date,date,uuid,uuid,text,text,boolean) from public, anon, authenticated, service_role;
grant execute on function public.phase15_report(uuid,text,date,date,uuid,uuid,text,text,boolean) to authenticated;
