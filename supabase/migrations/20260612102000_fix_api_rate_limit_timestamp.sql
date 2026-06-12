create or replace function public.consume_api_rate_limit(
  p_action text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  window_start timestamptz;
  bucket public.api_rate_limit_buckets%rowtype;
  retry_after integer;
begin
  if coalesce(nullif(p_action, ''), '') = ''
    or coalesce(nullif(p_key_hash, ''), '') = ''
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception 'A valid rate limit action, key, limit, and window are required.' using errcode = '22023';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limit_buckets (
    action,
    key_hash,
    window_started_at,
    request_count,
    expires_at,
    updated_at
  )
  values (
    left(p_action, 120),
    left(p_key_hash, 128),
    window_start,
    1,
    window_start + make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (action, key_hash, window_started_at) do update
  set request_count = public.api_rate_limit_buckets.request_count + 1,
      expires_at = excluded.expires_at,
      updated_at = v_now
  returning * into bucket;

  retry_after := greatest(1, ceil(extract(epoch from bucket.expires_at - v_now))::integer);

  return jsonb_build_object(
    'allowed', bucket.request_count <= p_limit,
    'count', bucket.request_count,
    'limit', p_limit,
    'retry_after', retry_after,
    'window_started_at', bucket.window_started_at,
    'expires_at', bucket.expires_at
  );
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
