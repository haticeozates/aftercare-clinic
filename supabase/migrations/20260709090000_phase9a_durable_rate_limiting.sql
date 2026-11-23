-- Phase 9A: durable shared rate limiting foundation

create table if not exists public.rate_limit_buckets (
  limiter_key text not null,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  constraint rate_limit_buckets_request_count_positive check (request_count > 0),
  constraint rate_limit_buckets_key_length check (char_length(limiter_key) between 32 and 128),
  constraint rate_limit_buckets_scope_length check (char_length(scope) between 3 and 120),
  primary key (limiter_key, scope, window_start)
);

create index if not exists rate_limit_buckets_expires_at_idx
  on public.rate_limit_buckets (expires_at);

alter table public.rate_limit_buckets enable row level security;

revoke all on table public.rate_limit_buckets from public;
revoke all on table public.rate_limit_buckets from anon;
revoke all on table public.rate_limit_buckets from authenticated;

create or replace function public.consume_rate_limit(
  target_limiter_key text,
  target_scope text,
  target_threshold integer,
  target_window_seconds integer,
  target_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_allowed boolean;
  v_remaining integer;
  v_retry_after integer;
  v_window_end timestamptz;
begin
  if target_limiter_key is null
    or target_scope is null
    or char_length(target_limiter_key) < 32
    or char_length(target_scope) < 3
    or target_threshold is null
    or target_threshold < 1
    or target_window_seconds is null
    or target_window_seconds < 1 then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', 60,
      'reason', 'invalid_request'
    );
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from target_now) / target_window_seconds) * target_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => target_window_seconds);

  insert into public.rate_limit_buckets as buckets (
    limiter_key,
    scope,
    window_start,
    request_count,
    expires_at
  )
  values (
    target_limiter_key,
    target_scope,
    v_window_start,
    1,
    v_window_end
  )
  on conflict (limiter_key, scope, window_start)
  do update
    set request_count = buckets.request_count + 1
  returning request_count into v_count;

  v_allowed := v_count <= target_threshold;
  v_remaining := greatest(0, target_threshold - v_count);
  v_retry_after := case
    when v_allowed then 0
    else greatest(1, ceil(extract(epoch from (v_window_end - target_now)))::integer)
  end;

  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'retry_after_seconds', v_retry_after,
    'reason', case when v_allowed then 'allowed' else 'rate_limited' end
  );
end;
$$;

create or replace function public.cleanup_expired_rate_limit_buckets(
  target_batch_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if target_batch_limit is null or target_batch_limit < 1 or target_batch_limit > 1000 then
    raise exception 'invalid batch limit';
  end if;

  with doomed as (
    select ctid
    from public.rate_limit_buckets
    where expires_at < now()
    limit target_batch_limit
  )
  delete from public.rate_limit_buckets buckets
  using doomed
  where buckets.ctid = doomed.ctid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer, timestamptz) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer, timestamptz) from anon;
revoke all on function public.consume_rate_limit(text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer, timestamptz) to service_role;

revoke all on function public.cleanup_expired_rate_limit_buckets(integer) from public;
revoke all on function public.cleanup_expired_rate_limit_buckets(integer) from anon;
revoke all on function public.cleanup_expired_rate_limit_buckets(integer) from authenticated;
grant execute on function public.cleanup_expired_rate_limit_buckets(integer) to service_role;
