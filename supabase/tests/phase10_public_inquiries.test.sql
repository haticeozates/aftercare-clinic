begin;
select plan(10);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.public_inquiries'::regclass), 'Public form table forces RLS');
select ok(not has_table_privilege('anon', 'public.public_inquiries', 'select'), 'Anonymous users cannot read inquiries');
select ok(not has_column_privilege('anon', 'public.public_inquiries', 'email', 'insert'), 'Anonymous users cannot bypass form protections');
select ok(not has_table_privilege('authenticated', 'public.public_inquiries', 'select'), 'Clinic accounts cannot read inquiries');
select ok(not has_column_privilege('authenticated', 'public.public_inquiries', 'email', 'insert'), 'Clinic accounts have no direct insert grant');
select ok(not has_table_privilege('service_role', 'public.public_inquiries', 'select'), 'Application credential has only the write path on this table');
set local role service_role;
select lives_ok($$insert into public.public_inquiries (kind, name, email, clinic) values ('demo', 'Synthetic test', 'public-demo@example.test', 'Synthetic clinic')$$, 'Service can store demo with validated fields');
select lives_ok($$insert into public.public_inquiries (kind, name, email, message) values ('contact', 'Synthetic test', 'public-contact@example.test', 'Synthetic contact request')$$, 'Service can store contact request');
select throws_ok($$insert into public.public_inquiries (kind, name, email, clinic) values ('unknown', 'Synthetic test', 'public-demo@example.test', 'Synthetic clinic')$$, '23514', null, 'Invalid inquiry kind is rejected');
select throws_ok($$insert into public.public_inquiries (kind, name, email) values ('contact', 'Synthetic test', 'public-contact@example.test')$$, '23514', null, 'Contact message is required');
reset role;

select * from finish();
rollback;
