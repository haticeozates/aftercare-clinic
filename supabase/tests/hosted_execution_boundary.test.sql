begin;
select plan(6);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'Public SECURITY DEFINER application functions are unavailable to anonymous callers'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE'))
  ),
  0,
  'Client roles cannot use table-level TRUNCATE, which bypasses row policies'
);

select ok(has_table_privilege('authenticated', 'public.appointments', 'SELECT'),
  'Authenticated users retain scoped appointment reads');
select ok(not has_column_privilege('authenticated', 'public.secure_links', 'token_hash', 'SELECT'),
  'Link hashes are private');
select ok(has_column_privilege('authenticated', 'public.secure_links', 'expires_at', 'SELECT'),
  'Clinic link metadata remains readable through RLS');
select is((select count(*)::integer from public.roles), 3,
  'Clean installs include the three application roles');

select * from finish();
rollback;
