-- Optional portfolio dataset. Synthetic names only. Never part of db reset or hosted seed.
begin;

update public.organizations set name = 'Ardıç Kıyısı Bakım Kliniği'
where id = '00000000-0000-4000-8000-00000000d901' and slug = 'demo-pilot-clinic';

update public.user_profiles as profile set display_name = name.label
from (values
  ('00000000-0000-4000-8000-00000000d911'::uuid, 'Ekin Koral'),
  ('00000000-0000-4000-8000-00000000d912'::uuid, 'Aylin Ilgaz'),
  ('00000000-0000-4000-8000-00000000d913'::uuid, 'Deniz Akçıl')
) as name(id, label)
where profile.id = name.id;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d911', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.clients set full_name = 'Duru Ilgın', phone = '+90 000 000 00 01', phone_normalized = '+900000000001'
where organization_id = '00000000-0000-4000-8000-00000000d901' and id = '00000000-0000-4000-8000-00000000d931';

-- The 000 national prefix makes the placeholder numbers non-dialable.
insert into public.clients (id, organization_id, full_name, phone, phone_normalized, email, responsible_membership_id, created_by_user_id)
select id, '00000000-0000-4000-8000-00000000d901', full_name, phone, replace(phone, ' ', ''), email, member_id, '00000000-0000-4000-8000-00000000d911'
from (values
  ('00000000-0000-4000-8000-00000000fa01'::uuid, 'Mert Yalın', '+90 000 000 00 02', 'portfolyo-mert@example.test', '00000000-0000-4000-8000-00000000d921'::uuid),
  ('00000000-0000-4000-8000-00000000fa02'::uuid, 'Selin Tunçer', '+90 000 000 00 03', 'portfolyo-selin@example.test', '00000000-0000-4000-8000-00000000d922'::uuid),
  ('00000000-0000-4000-8000-00000000fa03'::uuid, 'Toprak Serez', '+90 000 000 00 04', 'portfolyo-toprak@example.test', '00000000-0000-4000-8000-00000000d923'::uuid)
) as people(id, full_name, phone, email, member_id)
on conflict (id) do nothing;

update public.procedures
set name = 'Cilt bakımı sonrası takip', normalized_name = 'cilt bakımı sonrası takip', category = 'Bakım takibi'
where organization_id = '00000000-0000-4000-8000-00000000d901' and id = '00000000-0000-4000-8000-00000000d941';

insert into public.procedures (id, organization_id, name, normalized_name, category, created_by_user_id)
values ('00000000-0000-4000-8000-00000000fa11', '00000000-0000-4000-8000-00000000d901',
  'Bakım kontrol görüşmesi', 'bakım kontrol görüşmesi', 'Kontrol', '00000000-0000-4000-8000-00000000d911')
on conflict (id) do nothing;

update public.care_templates set name = 'İlk hafta bakım planı', normalized_name = 'ilk hafta bakım planı'
where organization_id = '00000000-0000-4000-8000-00000000d901' and id = '00000000-0000-4000-8000-00000000d951';

-- The appointment rows feed the existing calendar and analytics queries.
reset role;
with clinic as (
  select '00000000-0000-4000-8000-00000000d901'::uuid as id,
    (now() at time zone 'Europe/Istanbul')::date as today
), slots as (
  select n, id,
    (array['00000000-0000-4000-8000-00000000d931','00000000-0000-4000-8000-00000000fa01',
      '00000000-0000-4000-8000-00000000fa02','00000000-0000-4000-8000-00000000fa03']::uuid[])[1 + n % 4] as client,
    (array['00000000-0000-4000-8000-00000000d921','00000000-0000-4000-8000-00000000d922',
      '00000000-0000-4000-8000-00000000d923']::uuid[])[1 + (n + n / 12) % 3] as specialist,
    ((today + (case when n >= 60 then n - 59 else -(n % 12) end) + time '08:30')
      + (n / 12 * 75) * interval '1 minute') at time zone 'Europe/Istanbul' as starts
  from clinic cross join generate_series(0, 61) as n
)
insert into public.appointments (id, organization_id, client_id, procedure_id, membership_id, source, kind, status, starts_at, ends_at, time_zone)
select ('00000000-0000-4000-8000-00000000fb' || lpad(to_hex(n), 2, '0'))::uuid,
  id, client, case when n % 4 = 0 then '00000000-0000-4000-8000-00000000fa11'::uuid
    else '00000000-0000-4000-8000-00000000d941'::uuid end,
  specialist, 'clinic', case when n % 4 = 0 then 'follow_up' else 'procedure' end,
  case when n = 61 then 'pending' when starts > now() then 'confirmed'
    else (array['completed','completed','completed','cancelled','no_show'])[1 + n % 5] end,
  starts, starts + interval '20 minutes', 'Europe/Istanbul'
from slots
on conflict (id) do nothing;

commit;
