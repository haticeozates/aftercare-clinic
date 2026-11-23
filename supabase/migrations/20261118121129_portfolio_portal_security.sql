-- Portal credentials are usable only through the server routes.
revoke select on public.secure_links from public, anon, authenticated;
grant select (id, organization_id, care_plan_id, token_prefix, status, expires_at,
  revoked_at, revoked_by_user_id, rotated_from_link_id, created_by_user_id,
  created_at, last_used_at, usage_count) on public.secure_links to authenticated;

-- Plan dates are part of the snapshot and determine the link window.
revoke update on public.care_plans from public, anon, authenticated;
grant update (status, stopped_at, stopped_by_user_id, control_date, responsible_membership_id)
  on public.care_plans to authenticated;

create or replace function public.create_secure_link_for_plan(
  target_plan_id uuid,
  target_token_hash text,
  target_token_prefix text,
  target_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  link_id uuid;
  old_link_id uuid;
  plan_row public.care_plans%rowtype;
  expires_at_limit timestamptz;
  link_expiry timestamptz;
begin
  select om.organization_id into org_id
  from public.organization_memberships om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;

  if org_id is null or not public.current_user_has_permission(org_id, 'secure_link.create') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into plan_row from public.care_plans
  where id = target_plan_id and organization_id = org_id
  for update;
  if not found then
    raise exception 'plan not found for organization';
  end if;

  if plan_row.status in ('stopped', 'completed') then
    raise exception 'stopped plan cannot receive secure link';
  end if;

  if not isfinite(plan_row.end_date) then
    raise exception 'secure link requires a finite plan end date';
  end if;

  expires_at_limit := (plan_row.end_date + 4)::timestamp at time zone 'Europe/Istanbul';
  link_expiry := least(target_expires_at, expires_at_limit);
  if link_expiry <= now() then
    raise exception 'secure link expiry must be in the future';
  end if;

  select id into old_link_id
  from public.secure_links
  where care_plan_id = target_plan_id and status = 'active'
  order by created_at desc
  limit 1;

  if old_link_id is not null then
    update public.secure_links
    set status = 'revoked', revoked_at = now(), revoked_by_user_id = auth.uid()
    where id = old_link_id;
  end if;

  insert into public.secure_links (
    organization_id,
    care_plan_id,
    token_hash,
    token_prefix,
    expires_at,
    rotated_from_link_id,
    created_by_user_id
  )
  values (org_id, target_plan_id, target_token_hash, target_token_prefix, link_expiry, old_link_id, auth.uid())
  returning id into link_id;

  insert into public.audit_logs (organization_id, actor_type, actor_user_id, action, entity_type, entity_id, result, safe_metadata)
  values (
    org_id,
    'user',
    auth.uid(),
    case when old_link_id is null then 'secure_link.created' else 'secure_link.rotated' end,
    'secure_link',
    link_id,
    'success',
    public.sanitize_audit_metadata(jsonb_build_object('source', 'db_function', 'rotated', old_link_id is not null, 'expiry_category', 'plan_window'))
  );

  return link_id;
end;
$$;

create or replace function public.create_portal_session_for_link(
  target_token_hash text,
  target_session_hash text,
  target_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_id uuid;
  link_row public.secure_links%rowtype;
  session_id uuid;
  session_expiry timestamptz;
begin
  if target_expires_at <= now() then
    return null;
  end if;

  link_id := public.validate_secure_link_hash(target_token_hash);
  if link_id is null then
    return null;
  end if;

  select * into link_row from public.secure_links where id = link_id;

  session_expiry := least(target_expires_at, link_row.expires_at, now() + interval '15 minutes');

  insert into public.portal_sessions (
    organization_id,
    secure_link_id,
    care_plan_id,
    session_hash,
    expires_at
  )
  values (link_row.organization_id, link_row.id, link_row.care_plan_id, target_session_hash, session_expiry)
  returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.validate_portal_session_hash(target_session_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.portal_sessions%rowtype;
  link_row public.secure_links%rowtype;
  plan_status text;
begin
  select * into session_row
  from public.portal_sessions
  where session_hash = target_session_hash and status = 'active' and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  select * into link_row
  from public.secure_links
  where id = session_row.secure_link_id
    and organization_id = session_row.organization_id
    and care_plan_id = session_row.care_plan_id;

  if not found or link_row.status <> 'active' or link_row.expires_at <= now() then
    return null;
  end if;

  select status into plan_status
  from public.care_plans
  where id = session_row.care_plan_id and organization_id = session_row.organization_id;

  if plan_status is null or plan_status = 'stopped' then
    return null;
  end if;

  -- Activate only the validated session's plan. The status predicate preserves a concurrent stop.
  update public.care_plans
  set status = 'active'
  where id = session_row.care_plan_id
    and organization_id = session_row.organization_id
    and status = 'scheduled'
    and start_date <= public.portal_today();

  update public.portal_sessions set last_used_at = now() where id = session_row.id;
  return session_row.id;
end;
$$;

revoke execute on function
  public.validate_secure_link_hash(text),
  public.create_portal_session_for_link(text, text, timestamptz),
  public.validate_portal_session_hash(text),
  public.get_portal_plan_for_session(text, uuid),
  public.set_portal_task_status(text, uuid, text),
  public.submit_symptom_report_for_portal(text, uuid, jsonb),
  public.get_portal_document_assignments(text),
  public.record_portal_document_event(text, uuid, text),
  public.submit_portal_data_request(text, text),
  public.get_portal_data_requests(text),
  public.create_photo_upload_intent_for_portal(text, uuid, text, integer, text, timestamptz),
  public.claim_photo_upload_intent_for_portal(text, uuid),
  public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text)
from public, anon, authenticated;

grant execute on function
  public.validate_secure_link_hash(text),
  public.create_portal_session_for_link(text, text, timestamptz),
  public.validate_portal_session_hash(text),
  public.get_portal_plan_for_session(text, uuid),
  public.set_portal_task_status(text, uuid, text),
  public.submit_symptom_report_for_portal(text, uuid, jsonb),
  public.get_portal_document_assignments(text),
  public.record_portal_document_event(text, uuid, text),
  public.submit_portal_data_request(text, text),
  public.get_portal_data_requests(text),
  public.create_photo_upload_intent_for_portal(text, uuid, text, integer, text, timestamptz),
  public.claim_photo_upload_intent_for_portal(text, uuid),
  public.record_finalized_photo_for_portal(text, uuid, uuid, text, integer, integer, integer, text)
to service_role;

revoke execute on function public.phase8_validate_portal_session(text) from public, anon, authenticated;

-- Discard sessions which may have been minted under the previous public RPC grants.
-- Preserve valid share links and shorten previously oversized expiry windows.
update public.portal_sessions set status = 'revoked' where status = 'active';

-- Known synthetic placeholders were never issued by the SHA-256 token path.
update public.secure_links set status = 'expired'
where status = 'active' and token_hash !~ '^[a-f0-9]{64}$';

update public.secure_links as link
set status = case when cutoff.expires_at <= now() then 'expired' else link.status end,
    expires_at = case when cutoff.expires_at > link.created_at then cutoff.expires_at else link.expires_at end
from (
  select id, organization_id, (end_date + 4)::timestamp at time zone 'Europe/Istanbul' as expires_at
  from public.care_plans
) as cutoff
where link.care_plan_id = cutoff.id
  and link.organization_id = cutoff.organization_id
  and link.status = 'active'
  and link.expires_at > cutoff.expires_at;
