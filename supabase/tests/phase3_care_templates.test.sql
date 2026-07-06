begin;

select no_plan();

create or replace function pg_temp.as_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
end;
$$;

create or replace function pg_temp.as_user(user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end;
$$;

create or replace function pg_temp.as_service()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  set local role service_role;
end;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.care_templates where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha owner can read Alpha templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select count(*)::int from public.care_templates where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha admin can read Alpha templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.care_templates where organization_id = '00000000-0000-4000-8000-0000000000a1'), 3, 'Alpha staff can read Alpha templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.care_templates where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha user cannot read Beta templates');

select pg_temp.as_anon();
prepare anon_template_read as select count(*)::int from public.care_templates;
select throws_ok('anon_template_read', '42501', null, 'Anonymous user cannot read templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.care_templates), 0, 'Inactive member cannot read templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_template_insert as
  insert into public.care_templates (organization_id, procedure_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000d101', 'Staff Template', 'staff template', '00000000-0000-4000-8000-00000000a103');
select throws_ok('staff_template_insert', '42501', null, 'Staff cannot create templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_template_insert as
  insert into public.care_templates (id, organization_id, procedure_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-00000000a491', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000d101', 'Alpha Template New', 'alpha template new', '00000000-0000-4000-8000-00000000a101');
select lives_ok('owner_template_insert', 'Owner can create template');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_template_update as
  update public.care_templates set name = 'Staff Tamper', updated_by_user_id = '00000000-0000-4000-8000-00000000a103'
  where id = '00000000-0000-4000-8000-00000000a491';
select lives_ok('staff_template_update', 'Staff template update attempt affects no rows');
select is((select name from public.care_templates where id = '00000000-0000-4000-8000-00000000a491'), 'Alpha Template New', 'Staff cannot update template');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_template_deactivate as
  update public.care_templates set status = 'inactive', archived_at = now(), updated_by_user_id = '00000000-0000-4000-8000-00000000a101'
  where id = '00000000-0000-4000-8000-00000000a491';
select lives_ok('owner_template_deactivate', 'Owner can deactivate template');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_tenant_template_procedure as
  insert into public.care_templates (organization_id, procedure_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000d201', 'Cross Procedure Template', 'cross procedure template', '00000000-0000-4000-8000-00000000a101');
select throws_ok('cross_tenant_template_procedure', '23503', null, 'Cross-tenant procedure cannot be used by template');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_template_name as
  insert into public.care_templates (organization_id, procedure_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000d101', 'Alpha Template One', 'alpha template one', '00000000-0000-4000-8000-00000000a101');
select throws_ok('duplicate_template_name', '23505', null, 'Duplicate normalized template name in same organization and procedure is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000b101');
prepare same_template_name_beta as
  insert into public.care_templates (organization_id, procedure_id, name, normalized_name, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000d201', 'Alpha Template One', 'alpha template one', '00000000-0000-4000-8000-00000000b101');
select lives_ok('same_template_name_beta', 'Different organizations can reuse template names');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare template_delete as delete from public.care_templates where id = '00000000-0000-4000-8000-00000000a491';
select throws_ok('template_delete', '42501', null, 'Browser client cannot hard delete templates');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare owner_version_insert as
  insert into public.care_template_versions (id, organization_id, care_template_id, version_number, status, title, created_by_user_id)
  values ('00000000-0000-4000-8000-00000000a591', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a401', 99, 'draft', 'Draft 99', '00000000-0000-4000-8000-00000000a101');
select lives_ok('owner_version_insert', 'Owner can create draft version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_version_insert as
  insert into public.care_template_versions (organization_id, care_template_id, version_number, status, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a401', 100, 'draft', '00000000-0000-4000-8000-00000000a103');
select throws_ok('staff_version_insert', '42501', null, 'Staff cannot create draft version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_version_number as
  insert into public.care_template_versions (organization_id, care_template_id, version_number, status, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a401', 99, 'draft', '00000000-0000-4000-8000-00000000a101');
select throws_ok('duplicate_version_number', '23505', null, 'Duplicate version number is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_org_version_insert as
  insert into public.care_template_versions (organization_id, care_template_id, version_number, status, created_by_user_id)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b401', 10, 'draft', '00000000-0000-4000-8000-00000000a101');
select throws_ok('cross_org_version_insert', '23503', null, 'Version cannot be created under another organization template');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_version_update as
  update public.care_template_versions set title = 'Updated Draft', updated_at = now() where id = '00000000-0000-4000-8000-00000000a591';
select lives_ok('draft_version_update', 'Draft version can be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_version_update as
  update public.care_template_versions set title = 'Tamper Published' where id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_version_update', '42501', null, 'Published version cannot be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_version_delete as delete from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_version_delete', '42501', null, 'Published version cannot be deleted');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_to_draft as
  update public.care_template_versions set status = 'draft' where id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_to_draft', '42501', null, 'Published version cannot become draft');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare retired_version_delete as delete from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a502';
select throws_ok('retired_version_delete', '42501', null, 'Retired version cannot be deleted');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_day_insert as
  insert into public.care_template_days (id, organization_id, template_version_id, day_number, title, display_order)
  values ('00000000-0000-4000-8000-00000000a691', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', 1, 'Temsili Gün', 1);
select lives_ok('draft_day_insert', 'Day can be added to draft');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_day_insert as
  insert into public.care_template_days (organization_id, template_version_id, day_number, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a501', 99, 99);
select throws_ok('published_day_insert', '42501', null, 'Day cannot be added to published version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_day_update as update public.care_template_days set title = 'Tamper' where template_version_id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_day_update', '42501', null, 'Published day cannot be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_day_delete as delete from public.care_template_days where template_version_id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_day_delete', '42501', null, 'Published day cannot be deleted');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_day_update as update public.care_template_days set title = 'Updated Day' where id = '00000000-0000-4000-8000-00000000a691';
select lives_ok('draft_day_update', 'Draft day can be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_day_number as
  insert into public.care_template_days (organization_id, template_version_id, day_number, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', 1, 2);
select throws_ok('duplicate_day_number', '23505', null, 'Duplicate day number is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_task_insert as
  insert into public.care_template_tasks (id, organization_id, template_day_id, title, description, task_type, required, display_order)
  values ('00000000-0000-4000-8000-00000000a791', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a691', 'Klinik tarafından yapılandırılmış temsili günlük görev', null, 'do', true, 1);
select lives_ok('draft_task_insert', 'Task can be added to draft day');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_task_insert as
  insert into public.care_template_tasks (organization_id, template_day_id, title, task_type, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a601', 'Tamper Task', 'do', 99);
select throws_ok('published_task_insert', '42501', null, 'Task cannot be added to published day');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_task_update as update public.care_template_tasks set title = 'Tamper' where template_day_id = '00000000-0000-4000-8000-00000000a601';
select throws_ok('published_task_update', '42501', null, 'Published task cannot be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_task_delete as delete from public.care_template_tasks where template_day_id = '00000000-0000-4000-8000-00000000a601';
select throws_ok('published_task_delete', '42501', null, 'Published task cannot be deleted');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_tenant_task_insert as
  insert into public.care_template_tasks (organization_id, template_day_id, title, task_type, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b602', 'Cross Task', 'do', 1);
select throws_ok('cross_tenant_task_insert', '23503', null, 'Cross-tenant day/task relation is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_symptom_insert as
  insert into public.symptom_options (id, organization_id, template_version_id, label, normalized_label, allows_severity, display_order)
  values ('00000000-0000-4000-8000-00000000a891', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', 'Klinik değerlendirmesi için temsili durum', 'klinik değerlendirmesi için temsili durum', true, 1);
select lives_ok('draft_symptom_insert', 'Symptom option can be added to draft version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare published_symptom_update as update public.symptom_options set label = 'Tamper' where template_version_id = '00000000-0000-4000-8000-00000000a501';
select throws_ok('published_symptom_update', '42501', null, 'Published symptom option cannot be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare duplicate_symptom_label as
  insert into public.symptom_options (organization_id, template_version_id, label, normalized_label, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', 'Klinik değerlendirmesi için temsili durum', 'klinik değerlendirmesi için temsili durum', 2);
select throws_ok('duplicate_symptom_label', '23505', null, 'Duplicate symptom label in same version is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare draft_alert_rule_insert as
  insert into public.alert_rules (id, organization_id, template_version_id, symptom_option_id, rule_type, severity_level, configuration, message_label)
  values ('00000000-0000-4000-8000-00000000a991', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', '00000000-0000-4000-8000-00000000a891', 'symptom_selected', 'medium', '{}', 'Temsili takip uyarısı');
select lives_ok('draft_alert_rule_insert', 'Alert rule can use symptom option from same version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_version_alert_rule as
  insert into public.alert_rules (organization_id, template_version_id, symptom_option_id, rule_type, severity_level, configuration, message_label)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', '00000000-0000-4000-8000-00000000a801', 'symptom_selected', 'medium', '{}', 'Cross Version');
select throws_ok('cross_version_alert_rule', '23503', null, 'Cross-version symptom option cannot be attached to alert rule');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare cross_tenant_alert_rule as
  insert into public.alert_rules (organization_id, template_version_id, symptom_option_id, rule_type, severity_level, configuration, message_label)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', '00000000-0000-4000-8000-00000000b801', 'symptom_selected', 'medium', '{}', 'Cross Tenant');
select throws_ok('cross_tenant_alert_rule', '23503', null, 'Cross-tenant alert rule relation is rejected');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_symptom_insert as
  insert into public.symptom_options (organization_id, template_version_id, label, normalized_label, display_order)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000a591', 'Staff Symptom', 'staff symptom', 10);
select throws_ok('staff_symptom_insert', '42501', null, 'Staff cannot manage symptom options');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare publish_empty_draft as select public.publish_care_template_version('00000000-0000-4000-8000-00000000a581');
select throws_ok('publish_empty_draft', '23514', null, 'Publish fails when draft has no days');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare publish_day_without_task as select public.publish_care_template_version('00000000-0000-4000-8000-00000000a582');
select throws_ok('publish_day_without_task', '23514', null, 'Publish fails when draft has no tasks');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
prepare staff_publish as select public.publish_care_template_version('00000000-0000-4000-8000-00000000a591');
select throws_ok('staff_publish', '42501', null, 'Staff cannot publish draft');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare admin_publish as select public.publish_care_template_version('00000000-0000-4000-8000-00000000a591');
select lives_ok('admin_publish', 'Admin can publish valid draft');
select is((select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a591'), 'published', 'Publish updates version status');
select isnt((select published_at from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a591'), null, 'Publish sets published_at');
select is((select published_by_user_id from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a591'), '00000000-0000-4000-8000-00000000a102'::uuid, 'Publish sets published_by');
select is((select current_published_version_id from public.care_templates where id = '00000000-0000-4000-8000-00000000a401'), '00000000-0000-4000-8000-00000000a591'::uuid, 'Publish updates current published version');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare post_publish_task_update as update public.care_template_tasks set title = 'Tamper After Publish' where id = '00000000-0000-4000-8000-00000000a791';
select throws_ok('post_publish_task_update', '42501', null, 'Publish makes content immutable');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
prepare second_publish as select public.publish_care_template_version('00000000-0000-4000-8000-00000000a591');
select throws_ok('second_publish', '23514', null, 'Same version cannot be published twice');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a102');
select is((select status from public.care_template_versions where id = '00000000-0000-4000-8000-00000000a581'), 'draft', 'Failed publish leaves status unchanged');
select ok(exists(select 1 from public.audit_logs where action = 'template.published' and entity_id = '00000000-0000-4000-8000-00000000a591'), 'Publish audit is created');
select ok(not exists(select 1 from public.audit_logs where safe_metadata ?| array['template_name', 'task_title', 'task_description', 'internal_note', 'symptom_label', 'message_label', 'form_payload']), 'Template audit metadata contains no clinical content');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
select is((select count(*)::int from public.care_template_versions where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha owner cannot read Beta version details');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a103');
select is((select count(*)::int from public.care_template_tasks where organization_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'Alpha staff cannot read Beta published content');

select pg_temp.as_user('00000000-0000-4000-8000-00000000f002');
select is((select count(*)::int from public.care_template_versions), 0, 'Inactive membership loses template version access');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare template_audit_update as update public.audit_logs set safe_metadata = '{"tamper":true}' where action = 'template.published';
select throws_ok('template_audit_update', '42501', null, 'Template audit logs cannot be updated');

select pg_temp.as_user('00000000-0000-4000-8000-00000000a101');
prepare normal_audit_insert as
  insert into public.audit_logs (organization_id, actor_type, action, entity_type, result)
  values ('00000000-0000-4000-8000-0000000000a1', 'user', 'template.updated', 'template', 'success');
select throws_ok('normal_audit_insert', '42501', null, 'Browser client cannot insert audit logs directly');

select * from finish();

rollback;
