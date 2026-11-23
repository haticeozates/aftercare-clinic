-- Phase 9B Stage 1B — deterministic local-only demo fixture
-- Separate from Alpha/Beta base seed. Synthetic .test data only.
-- No raw secure-link tokens. No storage keys. No signed URLs.

begin;

insert into public.organizations (id, name, slug, status)
values (
  '00000000-0000-4000-8000-00000000d901',
  'Demo Pilot Clinic',
  'demo-pilot-clinic',
  'active'
)
on conflict (id) do update set name = excluded.name, slug = excluded.slug, status = excluded.status;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000d911',
    'authenticated', 'authenticated', 'demo-owner@example.test',
    crypt('local-test-password', gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true,"demo":true}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000d912',
    'authenticated', 'authenticated', 'demo-admin@example.test',
    crypt('local-test-password', gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true,"demo":true}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000d913',
    'authenticated', 'authenticated', 'demo-staff@example.test',
    crypt('local-test-password', gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"synthetic":true,"demo":true}'::jsonb, now(), now()
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  updated_at = now();

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (
    '10000000-0000-4000-8000-00000000d911', 'demo-owner@example.test', '00000000-0000-4000-8000-00000000d911',
    '{"sub":"00000000-0000-4000-8000-00000000d911","email":"demo-owner@example.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '10000000-0000-4000-8000-00000000d912', 'demo-admin@example.test', '00000000-0000-4000-8000-00000000d912',
    '{"sub":"00000000-0000-4000-8000-00000000d912","email":"demo-admin@example.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  ),
  (
    '10000000-0000-4000-8000-00000000d913', 'demo-staff@example.test', '00000000-0000-4000-8000-00000000d913',
    '{"sub":"00000000-0000-4000-8000-00000000d913","email":"demo-staff@example.test","email_verified":true}'::jsonb,
    'email', now(), now(), now()
  )
on conflict (id) do nothing;

insert into public.user_profiles (id, display_name)
values
  ('00000000-0000-4000-8000-00000000d911', 'Demo Owner'),
  ('00000000-0000-4000-8000-00000000d912', 'Demo Admin'),
  ('00000000-0000-4000-8000-00000000d913', 'Demo Staff')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.organization_memberships (id, organization_id, user_id, role_id, status)
values
  (
    '00000000-0000-4000-8000-00000000d921',
    '00000000-0000-4000-8000-00000000d901',
    '00000000-0000-4000-8000-00000000d911',
    (select id from public.roles where key = 'organization_owner'),
    'active'
  ),
  (
    '00000000-0000-4000-8000-00000000d922',
    '00000000-0000-4000-8000-00000000d901',
    '00000000-0000-4000-8000-00000000d912',
    (select id from public.roles where key = 'organization_admin'),
    'active'
  ),
  (
    '00000000-0000-4000-8000-00000000d923',
    '00000000-0000-4000-8000-00000000d901',
    '00000000-0000-4000-8000-00000000d913',
    (select id from public.roles where key = 'staff'),
    'active'
  )
on conflict (id) do nothing;

-- Client/procedure/template writes require authenticated membership context (same pattern as seed.sql).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000d911', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.clients (
  id, organization_id, full_name, phone, phone_normalized, email, responsible_membership_id, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000d931',
  '00000000-0000-4000-8000-00000000d901',
  'Synthetic Demo Client',
  '+90 555 990 00 01',
  '+905559900001',
  'demo-client@example.test',
  '00000000-0000-4000-8000-00000000d923',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.procedures (
  id, organization_id, name, normalized_name, category, description, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000d941',
  '00000000-0000-4000-8000-00000000d901',
  'Demo Procedure One',
  'demo procedure one',
  'Demo',
  'Klinik tarafından yapılandırılacak temsili işlem kaydı',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.care_templates (
  id, organization_id, procedure_id, name, normalized_name, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000d951',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000d941',
  'Demo Care Template',
  'demo care template',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from public.care_template_versions where id = '00000000-0000-4000-8000-00000000d961'
  ) then
    insert into public.care_template_versions (
      id, organization_id, care_template_id, version_number, status, title, internal_note, created_by_user_id
    )
    values (
      '00000000-0000-4000-8000-00000000d961',
      '00000000-0000-4000-8000-00000000d901',
      '00000000-0000-4000-8000-00000000d951',
      1,
      'draft',
      'Temsili demo yayın versiyonu',
      'Temsili demo içeriği; gerçek bakım talimatı değildir.',
      '00000000-0000-4000-8000-00000000d911'
    );

    insert into public.care_template_days (id, organization_id, template_version_id, day_number, title, display_order)
    values
      ('00000000-0000-4000-8000-00000000d971', '00000000-0000-4000-8000-00000000d901', '00000000-0000-4000-8000-00000000d961', 1, 'Demo takip günü 1', 1),
      ('00000000-0000-4000-8000-00000000d972', '00000000-0000-4000-8000-00000000d901', '00000000-0000-4000-8000-00000000d961', 2, 'Demo takip günü 2', 2);

    insert into public.care_template_tasks (
      id, organization_id, template_day_id, title, description, task_type, required, display_order
    )
    values
      (
        '00000000-0000-4000-8000-00000000d981',
        '00000000-0000-4000-8000-00000000d901',
        '00000000-0000-4000-8000-00000000d971',
        'Klinik tarafından yapılandırılmış temsili günlük görev',
        'Merkez tarafından belirlenecek takip adımı',
        'do', true, 1
      ),
      (
        '00000000-0000-4000-8000-00000000d982',
        '00000000-0000-4000-8000-00000000d901',
        '00000000-0000-4000-8000-00000000d972',
        'Klinik tarafından yapılandırılmış temsili ikinci gün görevi',
        'Merkez tarafından belirlenecek takip adımı',
        'do', true, 1
      );

    insert into public.symptom_options (
      id, organization_id, template_version_id, label, normalized_label, allows_severity, display_order
    )
    values (
      '00000000-0000-4000-8000-00000000d991',
      '00000000-0000-4000-8000-00000000d901',
      '00000000-0000-4000-8000-00000000d961',
      'Klinik değerlendirmesi için temsili durum',
      'klinik değerlendirmesi için temsili durum',
      true,
      1
    );

    insert into public.alert_rules (
      id, organization_id, template_version_id, symptom_option_id, rule_type, severity_level, configuration, message_label
    )
    values (
      '00000000-0000-4000-8000-00000000d992',
      '00000000-0000-4000-8000-00000000d901',
      '00000000-0000-4000-8000-00000000d961',
      '00000000-0000-4000-8000-00000000d991',
      'severity_threshold',
      'medium',
      '{"threshold":4}',
      'Temsili takip uyarısı'
    );
  end if;

  if (select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000d961') = 'draft' then
    perform public.publish_care_template_version('00000000-0000-4000-8000-00000000d961');
  end if;
end $$;

reset role;

select set_config('app.creating_care_plan_snapshot', 'on', true);

insert into public.care_plans (
  id, organization_id, client_id, procedure_id, care_template_id, template_version_id,
  responsible_membership_id, status, start_date, end_date, control_date, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000d931',
  '00000000-0000-4000-8000-00000000d941',
  '00000000-0000-4000-8000-00000000d951',
  '00000000-0000-4000-8000-00000000d961',
  '00000000-0000-4000-8000-00000000d923',
  'active',
  public.portal_today(),
  public.portal_today() + 1,
  public.portal_today() + 7,
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.care_plan_days (
  id, organization_id, care_plan_id, source_template_day_id, day_number, scheduled_date, title, status
)
values
  (
    '00000000-0000-4000-8000-00000000da11',
    '00000000-0000-4000-8000-00000000d901',
    '00000000-0000-4000-8000-00000000da01',
    '00000000-0000-4000-8000-00000000d971',
    1, public.portal_today(), 'Demo takip günü 1', 'completed'
  ),
  (
    '00000000-0000-4000-8000-00000000da12',
    '00000000-0000-4000-8000-00000000d901',
    '00000000-0000-4000-8000-00000000da01',
    '00000000-0000-4000-8000-00000000d972',
    2, public.portal_today() + 1, 'Demo takip günü 2', 'pending'
  )
on conflict (id) do nothing;

select set_config('app.creating_care_plan_snapshot', 'on', true);

insert into public.care_plan_tasks (
  id, organization_id, care_plan_day_id, source_template_task_id, title, description, task_type, required, display_order, status, completed_at
)
values (
  '00000000-0000-4000-8000-00000000da21',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da11',
  '00000000-0000-4000-8000-00000000d981',
  'Klinik tarafından yapılandırılmış temsili günlük görev',
  'Merkez tarafından belirlenecek takip adımı',
  'do', true, 1, 'completed', now()
)
on conflict (id) do update set
  status = excluded.status,
  completed_at = coalesce(public.care_plan_tasks.completed_at, excluded.completed_at),
  updated_at = now();

insert into public.care_plan_tasks (
  id, organization_id, care_plan_day_id, source_template_task_id, title, description, task_type, required, display_order, status, completed_at
)
values (
  '00000000-0000-4000-8000-00000000da22',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da12',
  '00000000-0000-4000-8000-00000000d982',
  'Klinik tarafından yapılandırılmış temsili ikinci gün görevi',
  'Merkez tarafından belirlenecek takip adımı',
  'do', true, 1, 'pending', null
)
on conflict (id) do nothing;

update public.care_plan_days
set status = 'completed',
    updated_at = now()
where id = '00000000-0000-4000-8000-00000000da11';

select set_config('app.creating_care_plan_snapshot', 'off', true);
select public.snapshot_care_plan_checkin_configuration('00000000-0000-4000-8000-00000000da01');

insert into public.photo_requests (
  id, organization_id, care_plan_id, care_plan_day_id, label, required, status, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da31',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000da11',
  'Temsili demo fotoğraf talebi',
  false,
  'active',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.consent_documents (
  id, organization_id, code, title, document_kind, purpose_key, status, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da41',
  '00000000-0000-4000-8000-00000000d901',
  'demo-notice',
  'Temsili bilgilendirme belgesi',
  'notice',
  'demo_notice',
  'active',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.consent_document_versions (
  id, organization_id, consent_document_id, version_number, status, title_snapshot, body_text, summary_text,
  published_at, published_by_user_id, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da42',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da41',
  1,
  'published',
  'Temsili bilgilendirme v1',
  'Temsili bilgilendirme metni — yalnızca yerel demo kullanımı içindir. Gerçek hukuki metin değildir.',
  'Bu belge gerçek bir hukuki metin değildir.',
  now(),
  '00000000-0000-4000-8000-00000000d911',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.client_document_assignments (
  id, organization_id, client_id, care_plan_id, document_version_id, assignment_type, required, status, assigned_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da43',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000d931',
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000da42',
  'notice',
  true,
  'pending',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.data_requests (
  id, organization_id, client_id, care_plan_id, request_type, status, submitted_source, submitted_at
)
values (
  '00000000-0000-4000-8000-00000000da51',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000d931',
  '00000000-0000-4000-8000-00000000da01',
  'access',
  'submitted',
  'clinic',
  now()
)
on conflict (id) do nothing;

insert into public.secure_links (
  id, organization_id, care_plan_id, token_hash, token_prefix, status, expires_at, created_by_user_id
)
values (
  '00000000-0000-4000-8000-00000000da61',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da01',
  'phase9b-demo-fixture-hash-only-not-a-token',
  'dem',
  'expired',
  now() + interval '3 days',
  '00000000-0000-4000-8000-00000000d911'
)
on conflict (id) do nothing;

insert into public.portal_sessions (
  id, organization_id, secure_link_id, care_plan_id, session_hash, status, expires_at
)
values (
  '00000000-0000-4000-8000-00000000da71',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da61',
  '00000000-0000-4000-8000-00000000da01',
  'phase9b-demo-session-hash-only',
  'revoked',
  now()
)
on conflict (id) do nothing;

insert into public.care_plan_task_events (
  id, organization_id, care_plan_id, care_plan_day_id, care_plan_task_id, portal_session_id, event_type
)
values (
  '00000000-0000-4000-8000-00000000daa1',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000da11',
  '00000000-0000-4000-8000-00000000da21',
  '00000000-0000-4000-8000-00000000da71',
  'completed'
)
on conflict (id) do nothing;

insert into public.symptom_reports (
  id, organization_id, care_plan_id, care_plan_day_id, portal_session_id, report_date, status, submitted_at
)
values (
  '00000000-0000-4000-8000-00000000da81',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000da11',
  '00000000-0000-4000-8000-00000000da71',
  public.portal_today(),
  'submitted',
  now()
)
on conflict (id) do nothing;

insert into public.symptom_report_items (
  id, organization_id, symptom_report_id, care_plan_symptom_option_id, selected, severity
)
select
  '00000000-0000-4000-8000-00000000da82',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da81',
  cpso.id,
  true,
  5
from public.care_plan_symptom_options cpso
where cpso.care_plan_id = '00000000-0000-4000-8000-00000000da01'
  and cpso.source_symptom_option_id = '00000000-0000-4000-8000-00000000d991'
on conflict (id) do nothing;

insert into public.alerts (
  id, organization_id, care_plan_id, care_plan_day_id, symptom_report_id, care_plan_alert_rule_id,
  severity_level, status
)
select
  '00000000-0000-4000-8000-00000000da91',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da01',
  '00000000-0000-4000-8000-00000000da11',
  '00000000-0000-4000-8000-00000000da81',
  cpar.id,
  'medium',
  'open'
from public.care_plan_alert_rules cpar
where cpar.care_plan_id = '00000000-0000-4000-8000-00000000da01'
  and cpar.source_alert_rule_id = '00000000-0000-4000-8000-00000000d992'
on conflict (id) do nothing;

insert into public.alert_events (
  id, organization_id, alert_id, event_type, previous_status, new_status, occurred_at
)
values (
  '00000000-0000-4000-8000-00000000da92',
  '00000000-0000-4000-8000-00000000d901',
  '00000000-0000-4000-8000-00000000da91',
  'created',
  null,
  'open',
  now()
)
on conflict (id) do nothing;

commit;
