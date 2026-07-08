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
    'photo.view',
    'consent.read',
    'consent.manage',
    'data_request.read',
    'data_request.manage'
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
    'photo.view_denied',
    'photo.view_authorized',
    'photo.cleanup_completed',
    'photo.cleanup_failed',
    'consent_document.created',
    'consent_version.created',
    'consent_version.published',
    'consent_assignment.created',
    'consent.event_recorded',
    'data_request.created',
    'data_request.status_changed',
    'data_request.assigned'
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
    'photo_record',
    'consent_document',
    'consent_document_version',
    'client_document_assignment',
    'client_document_event',
    'data_request',
    'data_request_event'
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
        'size_bytes',
        'width',
        'height',
        'result_reason_code',
        'retry',
        'idempotent_result',
        'document_kind',
        'request_type',
        'actor_role'
      )
    ),
    '{}'::jsonb
  );
$$;

insert into public.permissions (key, description)
values
  ('consent.read', 'Read consent document metadata and assignments'),
  ('consent.manage', 'Manage consent documents and assignments'),
  ('data_request.read', 'Read data request workflow records'),
  ('data_request.manage', 'Manage data request workflow records')
on conflict (key) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'consent.manage', 'data_request.read', 'data_request.manage')
where r.key in ('organization_owner', 'organization_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('consent.read', 'data_request.read')
where r.key = 'staff'
on conflict do nothing;

create unique index if not exists care_plans_org_id_client_id_unique
on public.care_plans(organization_id, id, client_id);

create table public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code = btrim(lower(code)) and code ~ '^[a-z0-9][a-z0-9_-]{1,80}$'),
  title text not null check (title = btrim(title) and length(title) between 2 and 160),
  document_kind text not null check (document_kind in ('notice', 'consent')),
  purpose_key text not null check (purpose_key = btrim(lower(purpose_key)) and purpose_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consent_documents_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint consent_documents_org_code_unique unique (organization_id, code)
);

create unique index consent_documents_organization_id_id_unique
on public.consent_documents(organization_id, id);

create index consent_documents_org_status_idx
on public.consent_documents(organization_id, status, created_at desc);

create table public.consent_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  consent_document_id uuid not null,
  version_number integer not null check (version_number >= 1),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  title_snapshot text not null check (title_snapshot = btrim(title_snapshot) and length(title_snapshot) between 2 and 160),
  body_text text not null check (body_text = btrim(body_text) and length(body_text) between 20 and 20000),
  summary_text text check (summary_text is null or (summary_text = btrim(summary_text) and length(summary_text) between 2 and 1000)),
  effective_from timestamptz,
  published_at timestamptz,
  published_by_user_id uuid,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consent_versions_document_same_org_fk
    foreign key (organization_id, consent_document_id)
    references public.consent_documents(organization_id, id)
    on delete restrict,
  constraint consent_versions_created_by_same_org_fk
    foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint consent_versions_published_by_same_org_fk
    foreign key (organization_id, published_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint consent_versions_number_unique unique (consent_document_id, version_number),
  constraint consent_versions_publish_fields check (
    (status = 'published' and published_at is not null and published_by_user_id is not null)
    or
    (status <> 'published')
  )
);

create unique index consent_document_versions_organization_id_id_unique
on public.consent_document_versions(organization_id, id);

create unique index consent_document_versions_org_document_id_id_unique
on public.consent_document_versions(organization_id, consent_document_id, id);

create index consent_versions_org_status_idx
on public.consent_document_versions(organization_id, status, created_at desc);

create table public.client_document_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  care_plan_id uuid,
  document_version_id uuid not null,
  assignment_type text not null check (assignment_type in ('notice', 'consent')),
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  assigned_by_user_id uuid not null,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint client_doc_assignments_client_same_org_fk
    foreign key (organization_id, client_id)
    references public.clients(organization_id, id),
  constraint client_doc_assignments_plan_same_client_fk
    foreign key (organization_id, care_plan_id, client_id)
    references public.care_plans(organization_id, id, client_id),
  constraint client_doc_assignments_version_same_org_fk
    foreign key (organization_id, document_version_id)
    references public.consent_document_versions(organization_id, id),
  constraint client_doc_assignments_assigned_by_same_org_fk
    foreign key (organization_id, assigned_by_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint client_doc_assignments_completion_fields check (
    (status = 'completed' and completed_at is not null)
    or
    (status <> 'completed' and completed_at is null)
  )
);

create unique index client_document_assignments_organization_id_id_unique
on public.client_document_assignments(organization_id, id);

create index client_doc_assignments_org_status_idx
on public.client_document_assignments(organization_id, status, assigned_at desc);

create table public.client_document_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null,
  client_id uuid not null,
  document_version_id uuid not null,
  event_type text not null check (event_type in ('presented', 'notice_acknowledged', 'consent_accepted', 'consent_declined', 'consent_withdrawn')),
  source text not null check (source in ('clinic', 'portal', 'system')),
  portal_session_id uuid,
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  safe_metadata jsonb not null default '{}'::jsonb,
  constraint client_document_events_assignment_same_org_fk
    foreign key (organization_id, assignment_id)
    references public.client_document_assignments(organization_id, id),
  constraint client_document_events_client_same_org_fk
    foreign key (organization_id, client_id)
    references public.clients(organization_id, id),
  constraint client_document_events_version_same_org_fk
    foreign key (organization_id, document_version_id)
    references public.consent_document_versions(organization_id, id),
  constraint client_document_events_session_same_org_fk
    foreign key (organization_id, portal_session_id)
    references public.portal_sessions(organization_id, id),
  constraint client_document_events_actor_same_org_fk
    foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint client_document_events_safe_metadata_is_object check (jsonb_typeof(safe_metadata) = 'object')
);

create index client_document_events_assignment_idx
on public.client_document_events(assignment_id, occurred_at desc);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  care_plan_id uuid,
  request_type text not null check (request_type in ('access', 'copy', 'correction', 'deletion', 'restriction', 'objection', 'withdraw_consent', 'other')),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'in_progress', 'completed', 'declined', 'cancelled')),
  submitted_source text not null check (submitted_source in ('clinic', 'portal', 'system')),
  submitted_at timestamptz not null default now(),
  assigned_to_user_id uuid,
  completed_at timestamptz,
  resolution_code text check (
    resolution_code is null or resolution_code in (
      'completed_without_export',
      'manual_review_completed',
      'unsupported_request',
      'duplicate_request',
      'cancelled_by_client',
      'other_internal'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_requests_client_same_org_fk
    foreign key (organization_id, client_id)
    references public.clients(organization_id, id),
  constraint data_requests_plan_same_client_fk
    foreign key (organization_id, care_plan_id, client_id)
    references public.care_plans(organization_id, id, client_id),
  constraint data_requests_assigned_to_same_org_fk
    foreign key (organization_id, assigned_to_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint data_requests_completed_fields check (
    (status in ('completed', 'declined', 'cancelled') and completed_at is not null)
    or
    (status not in ('completed', 'declined', 'cancelled') and completed_at is null)
  )
);

create unique index data_requests_organization_id_id_unique
on public.data_requests(organization_id, id);

create index data_requests_org_status_idx
on public.data_requests(organization_id, status, submitted_at desc);

create table public.data_request_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  data_request_id uuid not null,
  event_type text not null check (event_type in ('submitted', 'review_started', 'assigned', 'status_changed', 'completed', 'declined', 'cancelled')),
  from_status text check (from_status is null or from_status in ('submitted', 'under_review', 'in_progress', 'completed', 'declined', 'cancelled')),
  to_status text not null check (to_status in ('submitted', 'under_review', 'in_progress', 'completed', 'declined', 'cancelled')),
  actor_user_id uuid,
  source text not null check (source in ('clinic', 'portal', 'system')),
  occurred_at timestamptz not null default now(),
  safe_metadata jsonb not null default '{}'::jsonb,
  constraint data_request_events_request_same_org_fk
    foreign key (organization_id, data_request_id)
    references public.data_requests(organization_id, id),
  constraint data_request_events_actor_same_org_fk
    foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id),
  constraint data_request_events_safe_metadata_is_object check (jsonb_typeof(safe_metadata) = 'object')
);

create index data_request_events_request_idx
on public.data_request_events(data_request_id, occurred_at desc);

create or replace function public.prevent_published_consent_version_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.status in ('published', 'retired') then
    raise exception 'published consent document version is immutable' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('published', 'retired') and (
    new.consent_document_id is distinct from old.consent_document_id
    or new.version_number is distinct from old.version_number
    or new.title_snapshot is distinct from old.title_snapshot
    or new.body_text is distinct from old.body_text
    or new.summary_text is distinct from old.summary_text
    or new.status is distinct from old.status
    or new.effective_from is distinct from old.effective_from
  ) then
    raise exception 'published consent document version is immutable' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger consent_versions_immutable_guard
before update or delete on public.consent_document_versions
for each row execute function public.prevent_published_consent_version_mutation();

create or replace function public.prevent_client_document_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'client document events are append-only' using errcode = '42501';
end;
$$;

create trigger client_document_events_prevent_update
before update on public.client_document_events
for each row execute function public.prevent_client_document_event_mutation();

create trigger client_document_events_prevent_delete
before delete on public.client_document_events
for each row execute function public.prevent_client_document_event_mutation();

create or replace function public.prevent_data_request_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'data request events are append-only' using errcode = '42501';
end;
$$;

create trigger data_request_events_prevent_update
before update on public.data_request_events
for each row execute function public.prevent_data_request_event_mutation();

create trigger data_request_events_prevent_delete
before delete on public.data_request_events
for each row execute function public.prevent_data_request_event_mutation();

create or replace function public.phase8_data_request_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select (from_status, to_status) in (
    ('submitted', 'under_review'),
    ('submitted', 'cancelled'),
    ('under_review', 'in_progress'),
    ('under_review', 'declined'),
    ('under_review', 'cancelled'),
    ('in_progress', 'completed'),
    ('in_progress', 'declined')
  );
$$;

create or replace function public.publish_consent_document_version(target_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  version_row public.consent_document_versions%rowtype;
begin
  select * into version_row
  from public.consent_document_versions
  where id = target_version_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(version_row.organization_id, 'consent.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (version_row.organization_id, 'user', auth.uid(), 'consent_version.published', 'consent_document_version', version_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'consent.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  if version_row.status <> 'draft' then
    return jsonb_build_object('error', 'version is not draft');
  end if;

  if length(btrim(version_row.body_text)) < 20 or length(btrim(version_row.title_snapshot)) < 2 then
    return jsonb_build_object('error', 'content is required');
  end if;

  update public.consent_document_versions
  set status = 'published',
      published_at = now(),
      published_by_user_id = auth.uid(),
      updated_at = now()
  where id = version_row.id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    version_row.organization_id,
    'user',
    auth.uid(),
    'consent_version.published',
    'consent_document_version',
    version_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('version_number', version_row.version_number, 'source', 'db_function'))
  );

  return jsonb_build_object('status', 'published', 'version_id', version_row.id);
end;
$$;

create or replace function public.record_client_document_event(
  target_assignment_id uuid,
  target_event_type text,
  target_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.client_document_assignments%rowtype;
  version_row public.consent_document_versions%rowtype;
  document_row public.consent_documents%rowtype;
begin
  select * into assignment_row
  from public.client_document_assignments
  where id = target_assignment_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(assignment_row.organization_id, 'consent.manage') then
    return jsonb_build_object('error', 'permission denied');
  end if;

  if assignment_row.status = 'cancelled' then
    return jsonb_build_object('error', 'assignment is cancelled');
  end if;

  if target_event_type not in ('presented', 'notice_acknowledged', 'consent_accepted', 'consent_declined', 'consent_withdrawn') then
    return jsonb_build_object('error', 'invalid event type');
  end if;

  if target_source not in ('clinic', 'portal', 'system') then
    return jsonb_build_object('error', 'invalid source');
  end if;

  select * into version_row
  from public.consent_document_versions
  where id = assignment_row.document_version_id;

  select * into document_row
  from public.consent_documents
  where id = version_row.consent_document_id;

  if document_row.document_kind = 'notice' and target_event_type in ('consent_accepted', 'consent_declined', 'consent_withdrawn') then
    return jsonb_build_object('error', 'event incompatible with document kind');
  end if;

  if document_row.document_kind = 'consent' and target_event_type = 'notice_acknowledged' then
    return jsonb_build_object('error', 'event incompatible with document kind');
  end if;

  insert into public.client_document_events (
    organization_id,
    assignment_id,
    client_id,
    document_version_id,
    event_type,
    source,
    actor_user_id,
    safe_metadata
  )
  values (
    assignment_row.organization_id,
    assignment_row.id,
    assignment_row.client_id,
    assignment_row.document_version_id,
    target_event_type,
    target_source,
    auth.uid(),
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', target_source, 'version_number', version_row.version_number))
  );

  if target_event_type in ('notice_acknowledged', 'consent_accepted', 'consent_declined', 'consent_withdrawn') then
    update public.client_document_assignments
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where id = assignment_row.id;
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    assignment_row.organization_id,
    'user',
    auth.uid(),
    'consent.event_recorded',
    'client_document_assignment',
    assignment_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('event_type', target_event_type, 'source', target_source, 'version_number', version_row.version_number))
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

create or replace function public.transition_data_request_status(
  target_data_request_id uuid,
  target_status text,
  target_resolution_code text,
  target_assigned_to_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.data_requests%rowtype;
  event_name text;
begin
  select * into request_row
  from public.data_requests
  where id = target_data_request_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not found');
  end if;

  if not public.current_user_has_permission(request_row.organization_id, 'data_request.manage') then
    insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
    values (request_row.organization_id, 'user', auth.uid(), 'data_request.status_changed', 'data_request', request_row.id, 'denied', public.sanitize_audit_metadata(jsonb_build_object('permission_key', 'data_request.manage', 'source', 'db_function')));
    return jsonb_build_object('error', 'permission denied');
  end if;

  if target_status not in ('submitted', 'under_review', 'in_progress', 'completed', 'declined', 'cancelled') then
    return jsonb_build_object('error', 'invalid status');
  end if;

  if not public.phase8_data_request_transition_allowed(request_row.status, target_status) then
    return jsonb_build_object('error', 'invalid status transition');
  end if;

  if target_assigned_to_user_id is not null and not exists (
    select 1 from public.organization_memberships
    where organization_id = request_row.organization_id
      and user_id = target_assigned_to_user_id
      and status = 'active'
  ) then
    return jsonb_build_object('error', 'invalid assignee');
  end if;

  if target_resolution_code is not null and target_resolution_code not in ('completed_without_export', 'manual_review_completed', 'unsupported_request', 'duplicate_request', 'cancelled_by_client', 'other_internal') then
    return jsonb_build_object('error', 'invalid resolution code');
  end if;

  event_name := case
    when target_status = 'under_review' then 'review_started'
    when target_status = 'completed' then 'completed'
    when target_status = 'declined' then 'declined'
    when target_status = 'cancelled' then 'cancelled'
    else 'status_changed'
  end;

  update public.data_requests
  set status = target_status,
      assigned_to_user_id = coalesce(target_assigned_to_user_id, assigned_to_user_id),
      resolution_code = case when target_status in ('completed', 'declined', 'cancelled') then target_resolution_code else resolution_code end,
      completed_at = case when target_status in ('completed', 'declined', 'cancelled') then now() else null end,
      updated_at = now()
  where id = request_row.id;

  insert into public.data_request_events (
    organization_id,
    data_request_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    source,
    safe_metadata
  )
  values (
    request_row.organization_id,
    request_row.id,
    event_name,
    request_row.status,
    target_status,
    auth.uid(),
    'clinic',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'previous_status', request_row.status, 'new_status', target_status, 'resolution_code', target_resolution_code, 'source', 'db_function'))
  );

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    request_row.organization_id,
    'user',
    auth.uid(),
    'data_request.status_changed',
    'data_request',
    request_row.id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('request_type', request_row.request_type, 'previous_status', request_row.status, 'new_status', target_status, 'resolution_code', target_resolution_code, 'source', 'db_function'))
  );

  return jsonb_build_object('status', target_status);
end;
$$;

alter table public.consent_documents enable row level security;
alter table public.consent_document_versions enable row level security;
alter table public.client_document_assignments enable row level security;
alter table public.client_document_events enable row level security;
alter table public.data_requests enable row level security;
alter table public.data_request_events enable row level security;

create policy "members can read consent documents"
on public.consent_documents
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.read'));

create policy "managers can create consent documents"
on public.consent_documents
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'consent.manage') and created_by_user_id = auth.uid());

create policy "managers can update consent documents"
on public.consent_documents
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.manage'))
with check (public.current_user_has_permission(organization_id, 'consent.manage'));

create policy "members can read consent versions"
on public.consent_document_versions
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.read'));

create policy "managers can create consent versions"
on public.consent_document_versions
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'consent.manage') and created_by_user_id = auth.uid());

create policy "managers can update draft consent versions"
on public.consent_document_versions
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.manage'))
with check (public.current_user_has_permission(organization_id, 'consent.manage'));

create policy "members can read client document assignments"
on public.client_document_assignments
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.read'));

create policy "managers can create client document assignments"
on public.client_document_assignments
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'consent.manage') and assigned_by_user_id = auth.uid());

create policy "managers can update client document assignments"
on public.client_document_assignments
for update
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.manage'))
with check (public.current_user_has_permission(organization_id, 'consent.manage'));

create policy "members can read client document events"
on public.client_document_events
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'consent.read'));

create policy "members can read data requests"
on public.data_requests
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'data_request.read'));

create policy "managers can create data requests"
on public.data_requests
for insert
to authenticated
with check (public.current_user_has_permission(organization_id, 'data_request.manage'));

create policy "members can read data request events"
on public.data_request_events
for select
to authenticated
using (public.current_user_has_permission(organization_id, 'data_request.read'));

grant select, insert, update on public.consent_documents to authenticated;
grant select, insert, update on public.consent_document_versions to authenticated;
grant select, insert, update on public.client_document_assignments to authenticated;
grant select on public.client_document_events to authenticated;
grant select, insert on public.data_requests to authenticated;
grant select on public.data_request_events to authenticated;

grant select, insert, update, delete on public.consent_documents to service_role;
grant select, insert, update, delete on public.consent_document_versions to service_role;
grant select, insert, update, delete on public.client_document_assignments to service_role;
grant select, insert, update, delete on public.client_document_events to service_role;
grant select, insert, update, delete on public.data_requests to service_role;
grant select, insert, update, delete on public.data_request_events to service_role;

revoke all on public.consent_documents from anon;
revoke all on public.consent_document_versions from anon;
revoke all on public.client_document_assignments from anon;
revoke all on public.client_document_events from anon;
revoke all on public.data_requests from anon;
revoke all on public.data_request_events from anon;
revoke insert, update, delete on public.client_document_events from authenticated;
revoke insert, update, delete on public.data_request_events from authenticated;
revoke delete on public.consent_documents from authenticated;
revoke delete on public.consent_document_versions from authenticated;
revoke delete on public.client_document_assignments from authenticated;
revoke update, delete on public.data_requests from authenticated;

revoke all on function public.publish_consent_document_version(uuid) from public;
revoke all on function public.record_client_document_event(uuid, text, text) from public;
revoke all on function public.transition_data_request_status(uuid, text, text, uuid) from public;
grant execute on function public.publish_consent_document_version(uuid) to authenticated;
grant execute on function public.record_client_document_event(uuid, text, text) to authenticated;
grant execute on function public.transition_data_request_status(uuid, text, text, uuid) to authenticated;
