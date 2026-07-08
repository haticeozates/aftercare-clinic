begin;

select plan(13);

select has_table('public', 'rate_limit_buckets', '1. rate_limit_buckets table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_buckets'::regclass),
  '2. rate_limit_buckets RLS is enabled'
);

select ok(
  not has_table_privilege('anon', 'public.rate_limit_buckets', 'INSERT')
  and not has_table_privilege('anon', 'public.rate_limit_buckets', 'UPDATE')
  and not has_table_privilege('anon', 'public.rate_limit_buckets', 'DELETE')
  and not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.rate_limit_buckets', 'DELETE'),
  '3. browser roles cannot mutate rate_limit_buckets directly'
);

select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text, text, integer, integer, timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.consume_rate_limit(text, text, integer, integer, timestamptz)', 'EXECUTE'),
  '4. browser roles cannot execute consume_rate_limit'
);

select ok(
  has_function_privilege('service_role', 'public.consume_rate_limit(text, text, integer, integer, timestamptz)', 'EXECUTE'),
  '5. service_role can execute consume_rate_limit'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:10Z'
  )->>'allowed',
  'true',
  '6. first consume is allowed'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:20Z'
  )->>'remaining',
  '1',
  '7. remaining decreases inside threshold'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:25Z'
  )->>'allowed',
  'true',
  '8. third consume is still allowed at threshold'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:30Z'
  )->>'allowed',
  'false',
  '9. fourth consume is blocked at threshold 3'
);

select ok(
  (public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:30Z'
  )->>'retry_after_seconds')::integer > 0,
  '10. blocked consume returns positive retry_after_seconds'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:01:05Z'
  )->>'allowed',
  'true',
  '11. window reset allows requests again'
);

select is(
  public.consume_rate_limit(
    repeat('b', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:02:00Z'
  )->>'allowed',
  'true',
  '12. different opaque keys are isolated'
);

select is(
  public.consume_rate_limit(
    repeat('a', 64),
    'portal.task_mutation',
    3,
    60,
    timestamptz '2026-07-09T10:02:00Z'
  )->>'allowed',
  'true',
  '13. different scopes are isolated'
);

select * from finish();
rollback;
