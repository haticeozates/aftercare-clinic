alter table public.permissions drop constraint permissions_key_check;
alter table public.permissions add constraint permissions_key_check check (
  key in (
    'organization.read',
    'organization.update',
    'membership.read',
    'membership.manage',
    'audit.read',
    'client.read',
    'client.create',
    'client.update',
    'client.archive',
    'procedure.read',
    'procedure.manage',
    'template.read',
    'template.create',
    'template.update',
    'template.publish',
    'template.deactivate',
    'plan.read',
    'plan.create',
    'plan.update',
    'plan.stop',
    'secure_link.create',
    'secure_link.revoke',
    'secure_link.rotate',
    'alert.read',
    'alert.acknowledge',
    'alert.resolve',
    'alert.dismiss',
    'photo.read',
    'photo.request.manage',
    'photo.view'
  )
);

alter table public.audit_logs drop constraint audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check check (
  action in (
    'auth.login_success',
    'auth.login_failure',
    'organization.viewed',
    'organization.updated',
    'membership.viewed',
    'membership.created',
    'membership.role_updated',
    'membership.deactivated',
    'authorization.denied',
    'client.created',
    'client.viewed',
    'client.updated',
    'client.archived',
    'client.archive_denied',
    'procedure.created',
    'procedure.viewed',
    'procedure.updated',
    'procedure.deactivated',
    'procedure.manage_denied',
    'template.created',
    'template.updated',
    'template.deactivated',
    'template.viewed',
    'template_draft.created',
    'template_day.created',
    'template_day.updated',
    'template_day.deleted',
    'template_task.created',
    'template_task.updated',
    'template_task.deleted',
    'symptom_option.created',
    'symptom_option.updated',
    'alert_rule.created',
    'alert_rule.updated',
    'template.published',
    'template.publish_denied',
    'template.immutable_change_denied',
    'plan.created',
    'plan.viewed',
    'plan.updated',
    'plan.stopped',
    'plan.status_change_denied',
    'plan.create_denied',
    'secure_link.created',
    'secure_link.rotated',
    'secure_link.revoked',
    'secure_link.validation_succeeded',
    'secure_link.validation_failed',
    'secure_link.create_denied',
    'portal.viewed',
    'portal.session_invalid',
    'portal.task_completed',
    'portal.task_reopened',
    'portal.task_change_denied',
    'portal.future_task_denied',
    'portal.plan_inactive_denied',
    'symptom_report.submitted',
    'symptom_report.submit_denied',
    'alert.created',
    'alert.viewed',
    'alert.acknowledged',
    'alert.resolved',
    'alert.dismissed',
    'alert.status_change_denied',
    'photo_request.created',
    'photo_request.cancelled',
    'photo_upload_intent.created',
    'photo.uploaded',
    'photo.upload_denied',
    'photo.view_access_granted',
    'photo.view_denied'
  )
);

alter table public.audit_logs drop constraint audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (
  entity_type in (
    'auth',
    'organization',
    'membership',
    'audit_log',
    'client',
    'procedure',
    'template',
    'template_version',
    'template_day',
    'template_task',
    'symptom_option',
    'alert_rule',
    'plan',
    'plan_day',
    'plan_task',
    'plan_task_event',
    'secure_link',
    'portal_session',
    'symptom_report',
    'symptom_report_item',
    'alert',
    'alert_event',
    'photo_request',
    'photo_upload_intent',
    'photo_record'
  )
);

create or replace function public.sanitize_audit_metadata(input_metadata jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, value)
      from jsonb_each(coalesce(input_metadata, '{}'::jsonb))
      where key in (
        'reason',
        'target_role',
        'previous_role',
        'membership_status',
        'request_path',
        'permission',
        'permission_key',
        'source',
        'previous_status',
        'new_status',
        'changed_fields',
        'version_number',
        'task_type',
        'rule_type',
        'severity_level',
        'day_count',
        'task_count',
        'expiry_category',
        'result_reason',
        'rotated',
        'event_type',
        'day_number',
        'required',
        'selected_option_count',
        'alert_count',
        'resolution_code',
        'mime_type',
        'size_bytes'
      )
    ),
    '{}'::jsonb
  );
$$;

insert into public.permissions (key, description)
values
  ('photo.read', 'Read photo request and record metadata'),
  ('photo.request.manage', 'Create or cancel photo requests'),
  ('photo.view', 'Request short-lived access to finalized photo records')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.request.manage', 'photo.view')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('photo.read', 'photo.view')
where r.key = 'staff'
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('care-photo-incoming', 'care-photo-incoming', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('care-photos', 'care-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create table public.photo_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  label text not null check (label = btrim(label) and length(label) between 2 and 120 and label !~* '<script'),
  required boolean not null default false,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by_user_id uuid not null,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_requests_plan_same_org_fk
    foreign key (organization_id, care_plan_id)
    references public.care_plans(organization_id, id),
  constraint photo_requests_day_same_plan_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id)
    references public.care_plan_days(organization_id, care_plan_id, id),
  constraint photo_requests_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint photo_requests_cancelled_by_same_org_fk
    foreign key (organization_id, cancelled_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint photo_requests_cancel_fields_valid check (
    (status = 'active' and cancelled_at is null and cancelled_by_user_id is null)
    or
    (status = 'cancelled' and cancelled_at is not null and cancelled_by_user_id is not null)
  )
);

create unique index photo_requests_organization_id_id_unique
on public.photo_requests(organization_id, id);

create unique index photo_requests_org_plan_day_id_unique
on public.photo_requests(organization_id, care_plan_id, care_plan_day_id, id);

create unique index photo_requests_one_active_per_day
on public.photo_requests(organization_id, care_plan_day_id)
where status = 'active';

create table public.photo_upload_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  photo_request_id uuid not null,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  portal_session_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired')),
  incoming_bucket_id text not null default 'care-photo-incoming' check (incoming_bucket_id = 'care-photo-incoming'),
  incoming_object_key text not null unique check (incoming_object_key ~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  declared_mime_type text not null check (declared_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  declared_size_bytes integer not null check (declared_size_bytes between 1 and 5242880),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint photo_upload_intents_request_same_scope_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id, photo_request_id)
    references public.photo_requests(organization_id, care_plan_id, care_plan_day_id, id),
  constraint photo_upload_intents_session_same_plan_fk
    foreign key (organization_id, care_plan_id, portal_session_id)
    references public.portal_sessions(organization_id, care_plan_id, id),
  constraint photo_upload_intents_status_fields_valid check (
    (status = 'pending' and consumed_at is null)
    or
    (status = 'consumed' and consumed_at is not null)
    or
    (status = 'expired' and consumed_at is null)
  )
);

create unique index photo_upload_intents_organization_id_id_unique
on public.photo_upload_intents(organization_id, id);

create unique index photo_upload_intents_scope_id_unique
on public.photo_upload_intents(organization_id, photo_request_id, care_plan_id, care_plan_day_id, portal_session_id, id);

create unique index photo_upload_intents_one_pending_per_request
on public.photo_upload_intents(photo_request_id)
where status = 'pending';

create table public.photo_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  photo_request_id uuid not null unique,
  upload_intent_id uuid,
  care_plan_id uuid not null,
  care_plan_day_id uuid not null,
  portal_session_id uuid not null,
  final_bucket_id text not null default 'care-photos' check (final_bucket_id = 'care-photos'),
  final_object_key text not null unique check (final_object_key ~ '^photos/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'),
  verified_mime_type text not null check (verified_mime_type = 'image/webp'),
  verified_size_bytes integer not null check (verified_size_bytes between 1 and 5242880),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'ready' check (processing_status in ('ready', 'rejected')),
  uploaded_at timestamptz not null default now(),
  finalized_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint photo_records_request_same_scope_fk
    foreign key (organization_id, care_plan_id, care_plan_day_id, photo_request_id)
    references public.photo_requests(organization_id, care_plan_id, care_plan_day_id, id),
  constraint photo_records_intent_same_scope_fk
    foreign key (organization_id, photo_request_id, care_plan_id, care_plan_day_id, portal_session_id, upload_intent_id)
    references public.photo_upload_intents(organization_id, photo_request_id, care_plan_id, care_plan_day_id, portal_session_id, id)
);

create unique index photo_records_organization_id_id_unique
on public.photo_records(organization_id, id);

create index photo_requests_org_plan_day_idx
on public.photo_requests(organization_id, care_plan_id, care_plan_day_id);

create index photo_records_org_plan_day_idx
on public.photo_records(organization_id, care_plan_id, care_plan_day_id);

alter table public.photo_requests enable row level security;
alter table public.photo_upload_intents enable row level security;
alter table public.photo_records enable row level security;

create or replace function public.prevent_photo_record_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'final photo records are immutable'
    using errcode = '42501';
end;
$$;

create trigger photo_records_prevent_update
before update on public.photo_records
for each row execute function public.prevent_photo_record_mutation();

create trigger photo_records_prevent_delete
before delete on public.photo_records
for each row execute function public.prevent_photo_record_mutation();

create or replace function public.enforce_photo_upload_intent_update_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'photo upload intents cannot be deleted'
      using errcode = '42501';
  end if;

  if old.status <> 'pending' then
    raise exception 'photo upload intent is already closed'
      using errcode = '42501';
  end if;

  if new.organization_id <> old.organization_id
    or new.photo_request_id <> old.photo_request_id
    or new.care_plan_id <> old.care_plan_id
    or new.care_plan_day_id <> old.care_plan_day_id
    or new.portal_session_id <> old.portal_session_id
    or new.incoming_bucket_id <> old.incoming_bucket_id
    or new.incoming_object_key <> old.incoming_object_key
    or new.declared_mime_type <> old.declared_mime_type
    or new.declared_size_bytes <> old.declared_size_bytes
    or new.expires_at <> old.expires_at
    or new.created_at <> old.created_at then
    raise exception 'photo upload intent scope is immutable'
      using errcode = '42501';
  end if;

  if new.status = 'consumed' and new.consumed_at is null then
    raise exception 'consumed photo upload intent requires consumed_at'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger photo_upload_intents_enforce_update_rules
before update or delete on public.photo_upload_intents
for each row execute function public.enforce_photo_upload_intent_update_rules();

create or replace function public.enforce_photo_request_update_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'photo requests cannot be deleted'
      using errcode = '42501';
  end if;

  if new.organization_id <> old.organization_id
    or new.care_plan_id <> old.care_plan_id
    or new.care_plan_day_id <> old.care_plan_day_id
    or new.created_by_user_id <> old.created_by_user_id
    or new.created_at <> old.created_at then
    raise exception 'photo request scope is immutable'
      using errcode = '42501';
  end if;

  if old.status = 'cancelled' then
    raise exception 'cancelled photo request cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger photo_requests_enforce_update_rules
before update or delete on public.photo_requests
for each row execute function public.enforce_photo_request_update_rules();

create policy photo_requests_select_own_org
on public.photo_requests
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'photo.read'));

create policy photo_requests_manage_own_org
on public.photo_requests
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'photo.request.manage'));

create policy photo_requests_update_own_org
on public.photo_requests
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'photo.request.manage'))
with check (public.current_user_has_permission(organization_id, 'photo.request.manage'));

create policy photo_upload_intents_select_own_org
on public.photo_upload_intents
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'photo.read'));

create policy photo_records_select_own_org
on public.photo_records
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'photo.read'));

revoke all on public.photo_requests from anon;
revoke all on public.photo_upload_intents from anon;
revoke all on public.photo_records from anon;

revoke all on public.photo_requests from authenticated;
revoke all on public.photo_upload_intents from authenticated;
revoke all on public.photo_records from authenticated;

grant select on public.photo_requests to authenticated;
grant select on public.photo_upload_intents to authenticated;
grant select on public.photo_records to authenticated;

revoke all on function public.prevent_photo_record_mutation() from public;
revoke all on function public.enforce_photo_upload_intent_update_rules() from public;
revoke all on function public.enforce_photo_request_update_rules() from public;
