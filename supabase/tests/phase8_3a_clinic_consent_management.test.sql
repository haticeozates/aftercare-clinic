begin;
select plan(2);

-- Integration Test: Staff vs Owner permissions
do $$
declare
  alpha_org_id uuid;
  beta_org_id uuid;
  staff_uid uuid;
  owner_uid uuid;
  result jsonb;
begin
  select id into alpha_org_id from public.organizations where slug = 'organization-alpha';
  select id into beta_org_id from public.organizations where slug = 'organization-beta';
  select id into staff_uid from auth.users where email = 'staff@alpha.test';
  select id into owner_uid from auth.users where email = 'owner@alpha.test';

  -- Staff tries to create a document (should fail)
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub": "%s"}', staff_uid), true);
  
  result := public.create_consent_document('test-doc', 'Test Document', 'consent', 'test.purpose');
  if coalesce(result->>'error', '') <> 'permission denied' then
    raise exception 'Staff should be denied creating documents. Result: %', result;
  end if;

  -- Owner tries to create a document (should succeed)
  perform set_config('request.jwt.claims', format('{"sub": "%s"}', owner_uid), true);
  
  result := public.create_consent_document('test-doc-2', 'Test Document 2', 'consent', 'test.purpose');
  if result ? 'error' then
    raise exception 'Owner should be able to create documents. Result: %', result;
  end if;

end $$;

select pass('Role-based document management functions verified');

-- Check that published version cannot be updated
do $$
declare
  owner_uid uuid;
  test_doc_id uuid;
  test_ver_id uuid;
  result jsonb;
begin
  select id into owner_uid from auth.users where email = 'owner@alpha.test';
  set local role authenticated;
  perform set_config('request.jwt.claims', format('{"sub": "%s"}', owner_uid), true);

  -- We need to mock a document and a published version
  result := public.create_consent_document('pub-test', 'Pub Test', 'notice', 'pub.test');
  test_doc_id := (result->>'document_id')::uuid;

  result := public.create_consent_document_draft_version(test_doc_id, 'Draft 1', 'Summ 1', 'Body length must be at least 20 chars');
  test_ver_id := (result->>'version_id')::uuid;

  result := public.publish_consent_document_version(test_ver_id);
  if result ? 'error' then
    raise exception 'Failed to publish version: %', result;
  end if;

  -- Now try to update it via our update RPC
  result := public.update_consent_document_draft_version(test_ver_id, 'Draft modified', 'Summ modified', 'Body length modified to be 20 chars');
  if coalesce(result->>'error', '') <> 'version is not draft' then
    raise exception 'Should not be able to update published version. Result: %', result;
  end if;
  
end $$;

select pass('Published version immutability verified');

select finish();
rollback;
