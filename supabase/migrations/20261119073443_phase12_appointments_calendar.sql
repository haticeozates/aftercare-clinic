create extension if not exists btree_gist with schema extensions;

create table public.appointment_settings (
  organization_id uuid primary key references public.organizations(id),
  public_demo boolean not null default false
);

create table public.appointment_services (
  organization_id uuid not null,
  procedure_id uuid not null,
  minutes integer not null check (minutes between 5 and 480 and minutes % 5 = 0),
  public_demo boolean not null default false,
  primary key (organization_id, procedure_id),
  foreign key (organization_id, procedure_id) references public.procedures(organization_id, id)
);

create table public.appointment_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  membership_id uuid,
  weekday smallint check (weekday between 1 and 7),
  local_date date,
  kind text not null check (kind in ('work','break','closed')),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440 and end_minute > start_minute),
  check ((weekday is not null and local_date is null and kind in ('work','break'))
     or (weekday is null and local_date is not null and kind = 'closed')),
  foreign key (organization_id, membership_id) references public.organization_memberships(organization_id, id)
);
create index appointment_availability_lookup on public.appointment_availability(organization_id, membership_id, weekday, local_date);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid,
  procedure_id uuid not null,
  membership_id uuid not null,
  care_plan_id uuid,
  source text not null check (source in ('clinic','online_demo')),
  kind text not null check (kind in ('procedure','follow_up')),
  status text not null check (status in ('pending','confirmed','completed','cancelled','no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null,
  notes text not null default '' check (length(notes) <= 1000),
  demo_reference text check (demo_reference ~ '^DEMO-[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  check (source = 'online_demo' or client_id is not null),
  check (status in ('pending','cancelled') or client_id is not null),
  check (kind = 'follow_up' or care_plan_id is null),
  foreign key (organization_id,client_id) references public.clients(organization_id,id),
  foreign key (organization_id,procedure_id) references public.procedures(organization_id,id),
  foreign key (organization_id,membership_id) references public.organization_memberships(organization_id,id),
  foreign key (organization_id,care_plan_id) references public.care_plans(organization_id,id),
  exclude using gist (organization_id extensions.gist_uuid_ops with =, membership_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&) where (status in ('pending','confirmed')),
  exclude using gist (organization_id extensions.gist_uuid_ops with =, client_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&) where (client_id is not null and status in ('pending','confirmed'))
);
create index appointment_calendar on public.appointments(organization_id, starts_at, id);
create index appointment_client_history on public.appointments(organization_id, client_id, starts_at desc);

create table public.appointment_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  appointment_id uuid not null,
  actor_user_id uuid,
  event text not null check (event in ('created','requested','updated','rescheduled','confirmed','cancelled','rejected','completed','no_show')),
  status text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  membership_id uuid not null,
  client_id uuid,
  procedure_id uuid not null,
  happened_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id,appointment_id) references public.appointments(organization_id,id)
);
create index appointment_event_history on public.appointment_events(organization_id, appointment_id, id);

alter table public.appointment_settings enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
revoke all on public.appointment_settings, public.appointment_services, public.appointment_availability,
 public.appointments, public.appointment_events from public, anon, authenticated, service_role;
grant select on public.appointment_settings, public.appointment_services, public.appointment_availability,
 public.appointments, public.appointment_events to authenticated;

create policy appointment_read on public.appointments for select to authenticated
  using (public.current_user_has_permission(organization_id, 'client.read'));
create policy appointment_event_read on public.appointment_events for select to authenticated
  using (public.current_user_has_permission(organization_id, 'client.read'));
create policy appointment_service_read on public.appointment_services for select to authenticated
  using (public.current_user_has_permission(organization_id, 'client.read'));
create policy appointment_availability_read on public.appointment_availability for select to authenticated
  using (public.current_user_has_permission(organization_id, 'organization.update'));
create policy appointment_settings_read on public.appointment_settings for select to authenticated
  using (public.current_user_has_permission(organization_id, 'organization.update'));

create function public.phase12_zone(clinic uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce((select time_zone from public.phase11_clinic_settings where organization_id = clinic), 'Europe/Istanbul')
$$;

create function public.phase12_roster(actor uuid, clinic uuid)
returns table (id uuid, name text, own boolean, zone text)
language sql stable security definer set search_path = '' as $$
  select m.id, p.display_name, m.user_id = actor, public.phase12_zone(clinic)
  from public.organization_memberships m
  join public.user_profiles p on p.id = m.user_id
  where m.organization_id = clinic and m.status = 'active'
    and public.phase11_actor_role(actor, clinic) is not null
  order by p.display_name, m.id
$$;

create function public.phase12_fits(clinic uuid, specialist uuid, begins timestamptz, finishes timestamptz, zone text)
returns boolean language sql stable set search_path = '' as $$
  with wall as (
    select (begins at time zone zone)::date as day,
      extract(isodow from begins at time zone zone)::int as dow
  )
  select
    finishes > begins
    and not exists (
      select 1 from public.appointment_availability a
      where a.organization_id = clinic and (a.membership_id is null or a.membership_id = specialist)
        and (a.local_date = wall.day or a.weekday = wall.dow) and a.kind in ('break', 'closed')
        and begins < ((wall.day + a.end_minute * interval '1 minute') at time zone zone)
        and finishes > ((wall.day + a.start_minute * interval '1 minute') at time zone zone)
    )
    and exists (
      select 1 from public.appointment_availability a
      where a.organization_id = clinic and a.membership_id is null and a.weekday = wall.dow and a.kind = 'work'
        and begins >= ((wall.day + a.start_minute * interval '1 minute') at time zone zone)
        and finishes <= ((wall.day + a.end_minute * interval '1 minute') at time zone zone)
    )
    and exists (
      select 1 from public.appointment_availability a
      where a.organization_id = clinic and a.membership_id = specialist and a.weekday = wall.dow and a.kind = 'work'
        and begins >= ((wall.day + a.start_minute * interval '1 minute') at time zone zone)
        and finishes <= ((wall.day + a.end_minute * interval '1 minute') at time zone zone)
    )
  from wall
$$;

create function public.phase12_configure(actor uuid, clinic uuid, operation text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  member uuid := nullif(payload->>'membership_id','')::uuid;
  rule uuid := nullif(payload->>'id','')::uuid;
  proc uuid := nullif(payload->>'procedure_id','')::uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  if not coalesce(public.phase11_actor_role(actor, clinic) in ('organization_owner','organization_admin'), false) then
    raise exception 'Availability access denied' using errcode = '42501';
  end if;
  if member is not null and not exists (select 1 from public.organization_memberships
    where organization_id = clinic and id = member and status = 'active') then
    raise exception 'Specialist unavailable' using errcode = '42501';
  end if;
  case operation
    when 'rule' then
      insert into public.appointment_availability (organization_id,membership_id,weekday,local_date,kind,start_minute,end_minute)
        values (clinic,member,(payload->>'weekday')::smallint,(payload->>'local_date')::date,
          payload->>'kind',(payload->>'start_minute')::int,(payload->>'end_minute')::int);
    when 'remove' then
      delete from public.appointment_availability where organization_id = clinic and id = rule;
      if not found then raise exception 'Availability rule unavailable' using errcode = '42501'; end if;
    when 'service' then
      if not exists (select 1 from public.procedures where organization_id = clinic and id = proc and status = 'active') then
        raise exception 'Procedure unavailable' using errcode = '42501';
      end if;
      insert into public.appointment_services values (clinic,proc,(payload->>'minutes')::int,(payload->>'public_demo')::boolean)
        on conflict (organization_id,procedure_id) do update set minutes = excluded.minutes, public_demo = excluded.public_demo;
    when 'public' then
      insert into public.appointment_settings values (clinic,(payload->>'public_demo')::boolean)
        on conflict (organization_id) do update set public_demo = excluded.public_demo;
    else raise exception 'Invalid operation' using errcode = '22023';
  end case;
end
$$;

create function public.phase12_bookable_clinic(clinic_slug text)
returns uuid language sql stable set search_path = '' as $$
  select o.id from public.organizations o join public.appointment_settings s on s.organization_id = o.id
  where o.slug = clinic_slug and o.status = 'active' and s.public_demo
$$;

create function public.phase12_catalog(clinic_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name',o.name,'zone',public.phase12_zone(o.id),
    'services',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'minutes',s.minutes) order by p.name)
      from public.appointment_services s join public.procedures p on p.id = s.procedure_id
      where s.organization_id = o.id and s.public_demo and p.status = 'active'),'[]'::jsonb),
    'specialists',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'label','Uzman ' || x.position) order by x.position)
      from (select m.id, row_number() over (order by m.id) as position from public.organization_memberships m
        where m.organization_id = o.id and m.status = 'active'
          and exists (select 1 from public.appointment_availability a
            where a.organization_id = o.id and a.membership_id = m.id and a.kind = 'work')) x),'[]'::jsonb))
  from public.organizations o where o.id = public.phase12_bookable_clinic(clinic_slug)
$$;

create function public.phase12_slots(clinic_slug text, procedure uuid, specialist uuid, local_day date)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with clinic as (
    select id, public.phase12_zone(id) as zone from (select public.phase12_bookable_clinic(clinic_slug) as id) x
  ), service as (
    select c.id,c.zone,s.minutes from clinic c
    join public.appointment_services s on s.organization_id = c.id and s.procedure_id = procedure and s.public_demo
    join public.procedures p on p.organization_id = c.id and p.id = procedure and p.status = 'active'
    join public.organization_memberships m on m.organization_id = c.id and m.id = specialist and m.status = 'active'
    where local_day between (now() at time zone c.zone)::date and (now() at time zone c.zone)::date + 60
  ), candidates as (
    select s.*, w.wall, w.wall at time zone s.zone as instant
    from service s cross join lateral
      (select local_day + n * interval '15 minutes' as wall from generate_series(0,95) n) w
  )
  select c.instant from candidates c
  where c.instant > now() and c.instant at time zone c.zone = c.wall
    and public.phase12_fits(c.id,specialist,c.instant,c.instant + make_interval(mins => c.minutes),c.zone)
    and not exists (select 1 from public.appointments a where a.organization_id = c.id
      and a.membership_id = specialist and a.status in ('pending','confirmed')
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(c.instant,c.instant + make_interval(mins=>c.minutes),'[)'))
  order by c.instant
$$;

create function public.phase12_write(actor uuid, clinic uuid, operation text, appointment uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  role_key text;
  own_member uuid;
  old_row public.appointments%rowtype;
  saved public.appointments%rowtype;
  client uuid;
  procedure uuid;
  specialist uuid;
  plan uuid;
  zone text;
  wall timestamp;
  begins timestamptz;
  finishes timestamptz;
  minutes integer;
  destination text;
  action text;
  online boolean := operation = 'request';
  appointment_kind text := coalesce(payload->>'kind','procedure');
  note text := coalesce(payload->>'notes','');
  reference text := payload->>'reference';
begin
  if clinic is null then raise exception 'Clinic unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('phase11:org:' || clinic::text, 0));
  zone := public.phase12_zone(clinic);
  if online then
    if actor is not null or reference is null or reference !~ '^DEMO-[0-9]{4}$'
        or clinic is distinct from public.phase12_bookable_clinic(payload->>'slug') then
      raise exception 'Demo closed' using errcode = '42501';
    end if;
  else
    role_key := public.phase11_actor_role(actor, clinic);
    if role_key is null then raise exception 'Appointment access denied' using errcode = '42501'; end if;
    select id into own_member from public.organization_memberships where organization_id=clinic and user_id=actor and status='active';
  end if;

  if operation in ('edit','status') then
    select * into old_row from public.appointments where organization_id=clinic and id=appointment for update;
    if not found or (role_key = 'staff' and own_member is distinct from old_row.membership_id) then
      raise exception 'Appointment access denied' using errcode = '42501';
    end if;
    if old_row.status not in ('pending','confirmed') then
      raise exception 'Terminal appointment' using errcode = '22023';
    end if;
  end if;

  if operation = 'status' then
    destination := payload->>'status';
    if not coalesce(
      (old_row.status='pending' and destination in ('confirmed','cancelled'))
      or (old_row.status='confirmed' and destination in ('completed','no_show','cancelled')),false) then
      raise exception 'Invalid status transition' using errcode = '22023';
    end if;
    client := coalesce(old_row.client_id,nullif(payload->>'client_id','')::uuid);
    if destination = 'confirmed' then
      if old_row.starts_at <= now() or not exists (select 1 from public.clients where organization_id=clinic and id=client and status='active')
        or not exists (select 1 from public.organization_memberships where organization_id=clinic and id=old_row.membership_id and status='active')
        or not public.phase12_fits(clinic,old_row.membership_id,old_row.starts_at,old_row.ends_at,zone) then
        raise exception 'Appointment unavailable' using errcode = '22023';
      end if;
    end if;
    if destination in ('completed','no_show') and old_row.starts_at > now() then
      raise exception 'Appointment has not started' using errcode = '22023';
    end if;
    update public.appointments set status=destination, updated_at=clock_timestamp(),
        client_id=case when destination='confirmed' then client else old_row.client_id end
      where id=old_row.id returning * into saved;
    action := case when destination='cancelled' and old_row.status='pending' and old_row.source='online_demo'
      then 'rejected' else destination end;

  elsif operation in ('create','edit','request') then
    procedure := (payload->>'procedure_id')::uuid;
    specialist := (payload->>'membership_id')::uuid;
    if not exists (select 1 from public.procedures where organization_id=clinic and id=procedure and status='active')
      or not exists (select 1 from public.organization_memberships where organization_id=clinic and id=specialist and status='active')
      or (role_key='staff' and own_member is distinct from specialist) then
      raise exception 'Procedure or specialist unavailable' using errcode = '42501';
    end if;

    if online then
      select s.minutes into minutes from public.appointment_services s
        where organization_id=clinic and procedure_id=procedure and public_demo;
      begins := (payload->>'starts_at')::timestamptz;
      wall := begins at time zone zone;
      if minutes is null or begins <= now() or wall::date > (now() at time zone zone)::date + 60
        or extract(minute from wall)::int % 15 <> 0 or extract(second from wall) <> 0
        or (wall at time zone zone) is distinct from begins then
        raise exception 'Invalid online slot' using errcode = '22023';
      end if;
      appointment_kind := 'procedure';
      note := '';
    else
      wall := (payload->>'local_start')::timestamp;
      begins := wall at time zone zone;
      minutes := (payload->>'minutes')::int;
      client := nullif(payload->>'client_id','')::uuid;
      plan := nullif(payload->>'care_plan_id','')::uuid;
      if not exists (select 1 from public.clients c where c.organization_id=clinic and c.id=client and c.status='active')
        and not (operation='edit' and old_row.source='online_demo' and old_row.status='pending' and client is null) then
        raise exception 'Client unavailable' using errcode = '42501';
      end if;
      if plan is not null and (appointment_kind <> 'follow_up' or not exists (select 1 from public.care_plans p
        where p.organization_id=clinic and p.id=plan and p.client_id=client and p.procedure_id=procedure)) then
        raise exception 'Plan mismatch' using errcode = '42501';
      end if;
      if (begins at time zone zone) is distinct from wall or minutes not between 5 and 480 or minutes % 5 <> 0
        or (begins <= now() and (operation='create' or begins is distinct from old_row.starts_at))
        or (operation='edit' and old_row.source='online_demo'
          and (procedure is distinct from old_row.procedure_id or specialist is distinct from old_row.membership_id)) then
        raise exception 'Invalid appointment timing or assignment' using errcode = '22023';
      end if;
    end if;
    finishes := begins + make_interval(mins=>minutes);
    if not public.phase12_fits(clinic,specialist,begins,finishes,zone) then
      raise exception 'Outside availability' using errcode = '22023';
    end if;

    if operation = 'edit' then
      update public.appointments set client_id=client, procedure_id=procedure, membership_id=specialist, care_plan_id=plan,
        kind=appointment_kind, starts_at=begins, ends_at=finishes, time_zone=zone, notes=note, updated_at=clock_timestamp()
        where id=old_row.id returning * into saved;
      action := case when begins is distinct from old_row.starts_at or finishes is distinct from old_row.ends_at
        or specialist is distinct from old_row.membership_id then 'rescheduled' else 'updated' end;
    else
      insert into public.appointments (organization_id,client_id,procedure_id,membership_id,care_plan_id,source,kind,
        status,starts_at,ends_at,time_zone,notes,demo_reference)
        values (clinic,client,procedure,specialist,plan,case when online then 'online_demo' else 'clinic' end,
          appointment_kind,case when online then 'pending' else 'confirmed' end,begins,finishes,zone,note,
          case when online then reference end) returning * into saved;
      action := case when online then 'requested' else 'created' end;
    end if;
  else
    raise exception 'Invalid operation' using errcode = '22023';
  end if;

  insert into public.appointment_events(organization_id,appointment_id,actor_user_id,event,status,starts_at,ends_at,membership_id,client_id,procedure_id)
    values (clinic,saved.id,actor,action,saved.status,saved.starts_at,saved.ends_at,saved.membership_id,saved.client_id,saved.procedure_id);
  return saved.id;
end
$$;

create function public.phase12_request(clinic_slug text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.phase12_write(null,public.phase12_bookable_clinic(clinic_slug),'request',null,
    payload || jsonb_build_object('slug',clinic_slug));
end
$$;

revoke all on function public.phase12_zone(uuid), public.phase12_roster(uuid,uuid),
 public.phase12_fits(uuid,uuid,timestamptz,timestamptz,text), public.phase12_configure(uuid,uuid,text,jsonb),
 public.phase12_bookable_clinic(text), public.phase12_catalog(text), public.phase12_slots(text,uuid,uuid,date),
 public.phase12_write(uuid,uuid,text,uuid,jsonb), public.phase12_request(text,jsonb)
 from public, anon, authenticated, service_role;
grant execute on function public.phase12_roster(uuid,uuid), public.phase12_configure(uuid,uuid,text,jsonb),
 public.phase12_catalog(text), public.phase12_slots(text,uuid,uuid,date), public.phase12_write(uuid,uuid,text,uuid,jsonb),
 public.phase12_request(text,jsonb) to service_role;
