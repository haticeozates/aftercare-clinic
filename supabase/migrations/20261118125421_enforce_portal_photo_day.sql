-- Match the portal day availability contract for uploads, including legacy intents.
create function public.require_available_photo_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := public.portal_today();
begin
  if not exists (
    select 1
    from public.care_plan_days as day
    join public.care_plans as plan
      on plan.id = day.care_plan_id
     and plan.organization_id = day.organization_id
    where day.id = new.care_plan_day_id
      and plan.id = new.care_plan_id
      and plan.organization_id = new.organization_id
      and plan.start_date <= today
      and day.scheduled_date <= today
  ) then
    raise exception 'photo upload day is not available' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_available_photo_day() from public, anon, authenticated;

create trigger photo_upload_intents_require_available_day
before insert or update of status on public.photo_upload_intents
for each row when (new.status in ('pending', 'processing', 'consumed'))
execute function public.require_available_photo_day();

create trigger photo_records_require_available_day
before insert on public.photo_records
for each row execute function public.require_available_photo_day();
