create table if not exists public.store_owner_login_rate_limits (
  ip_hash text primary key,
  failed_attempts integer not null default 0,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.store_owner_login_rate_limits enable row level security;
revoke all on table public.store_owner_login_rate_limits from anon, authenticated;

create or replace function public.check_store_owner_login_rate_limit(p_ip_hash text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
as $$
declare
  v_row public.store_owner_login_rate_limits%rowtype;
  v_now timestamptz := now();
  v_retry integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  select * into v_row from public.store_owner_login_rate_limits where ip_hash = p_ip_hash;

  if v_row.cooldown_until is not null and v_row.cooldown_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_row.cooldown_until - v_now)))::integer);
    return query select false, v_retry;
    return;
  end if;

  if v_row.ip_hash is null then
    insert into public.store_owner_login_rate_limits (ip_hash) values (p_ip_hash)
    on conflict (ip_hash) do nothing;
  elsif v_row.cooldown_until is not null then
    update public.store_owner_login_rate_limits
    set failed_attempts = 0, cooldown_until = null, updated_at = v_now
    where ip_hash = p_ip_hash;
  end if;

  return query select true, 0;
end;
$$;

create or replace function public.record_store_owner_login_failure(p_ip_hash text)
returns table(cooldown_started boolean, retry_after_seconds integer)
language plpgsql
security invoker
as $$
declare
  v_row public.store_owner_login_rate_limits%rowtype;
  v_attempts integer;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  select * into v_row from public.store_owner_login_rate_limits where ip_hash = p_ip_hash;

  if v_row.ip_hash is null then
    insert into public.store_owner_login_rate_limits (ip_hash, failed_attempts, updated_at)
    values (p_ip_hash, 1, v_now);
    return query select false, 0;
    return;
  end if;

  if v_row.cooldown_until is not null and v_row.cooldown_until > v_now then
    return query select true, greatest(1, ceil(extract(epoch from (v_row.cooldown_until - v_now)))::integer);
    return;
  end if;

  v_attempts := coalesce(v_row.failed_attempts, 0) + 1;
  if v_attempts >= 5 then
    update public.store_owner_login_rate_limits
    set failed_attempts = 0, cooldown_until = v_now + interval '1 minute', updated_at = v_now
    where ip_hash = p_ip_hash;
    return query select true, 60;
  end if;

  update public.store_owner_login_rate_limits
  set failed_attempts = v_attempts, cooldown_until = null, updated_at = v_now
  where ip_hash = p_ip_hash;

  return query select false, 0;
end;
$$;

create or replace function public.reset_store_owner_login_rate_limit(p_ip_hash text)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.store_owner_login_rate_limits where ip_hash = p_ip_hash;
end;
$$;

revoke execute on function public.check_store_owner_login_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.record_store_owner_login_failure(text) from public, anon, authenticated;
revoke execute on function public.reset_store_owner_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_store_owner_login_rate_limit(text) to service_role;
grant execute on function public.record_store_owner_login_failure(text) to service_role;
grant execute on function public.reset_store_owner_login_rate_limit(text) to service_role;
