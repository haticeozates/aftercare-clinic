begin;

select no_plan();

create or replace function pg_temp.consume_as_service_role(
  target_limiter_key text,
  target_scope text,
  target_threshold integer,
  target_window_seconds integer,
  target_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('role', 'service_role', true);
  return public.consume_rate_limit(
    target_limiter_key,
    target_scope,
    target_threshold,
    target_window_seconds,
    target_now
  );
end;
$$;

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
  pg_temp.consume_as_service_role(
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
  pg_temp.consume_as_service_role(
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
  pg_temp.consume_as_service_role(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:30Z'
  )->>'allowed',
  'false',
  '8. fourth consume is blocked at threshold 3'
);

select ok(
  (pg_temp.consume_as_service_role(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:00:30Z'
  )->>'retry_after_seconds')::integer > 0,
  '9. blocked consume returns positive retry_after_seconds'
);

select is(
  pg_temp.consume_as_service_role(
    repeat('a', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:01:05Z'
  )->>'allowed',
  'true',
  '10. window reset allows requests again'
);

select is(
  pg_temp.consume_as_service_role(
    repeat('b', 64),
    'secure_link.token_validation',
    3,
    60,
    timestamptz '2026-07-09T10:02:00Z'
  )->>'allowed',
  'true',
  '11. different opaque keys are isolated'
);

select is(
  pg_temp.consume_as_service_role(
    repeat('a', 64),
    'portal.task_mutation',
    3,
    60,
    timestamptz '2026-07-09T10:02:00Z'
  )->>'allowed',
  'true',
  '12. different scopes are isolated'
);

select ok(
  not exists (
    select 1
    from public.rate_limit_buckets
    where limiter_key like '%token%'
      or limiter_key like '%.%@%'
      or scope like '%@%'
  ),
  '13. stored keys remain opaque identifiers only'
);

select * from finish();
rollback;
