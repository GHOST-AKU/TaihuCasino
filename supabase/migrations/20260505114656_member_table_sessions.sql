do $$
declare
  source_constraint_name text;
begin
  select conname
  into source_constraint_name
  from pg_constraint
  where conrelid = 'public.member_wallet_ledger'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%source%';

  if source_constraint_name is not null then
    execute format('alter table public.member_wallet_ledger drop constraint %I', source_constraint_name);
  end if;
end $$;

alter table public.member_wallet_ledger
add constraint member_wallet_ledger_source_check
check (source in ('game_round', 'ad_reward', 'purchase', 'admin_adjustment', 'system', 'table_buy_in', 'table_cash_out'));

create table if not exists public.member_table_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_slug text not null,
  status text not null default 'active' check (status in ('active', 'cashed_out', 'abandoned')),
  buy_in_amount numeric(14, 2) not null check (buy_in_amount > 0),
  chip_balance numeric(14, 2) not null check (chip_balance >= 0),
  wallet_ledger_id uuid references public.member_wallet_ledger(id),
  cash_out_ledger_id uuid references public.member_wallet_ledger(id),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  check (status = 'active' or closed_at is not null),
  check (status <> 'cashed_out' or chip_balance = 0)
);

create unique index if not exists member_table_sessions_user_idempotency_key_idx
on public.member_table_sessions (user_id, idempotency_key)
where idempotency_key is not null;

create unique index if not exists member_table_sessions_one_active_game_idx
on public.member_table_sessions (user_id, game_slug)
where status = 'active';

create index if not exists member_table_sessions_user_opened_at_idx
on public.member_table_sessions (user_id, opened_at desc);

alter table public.member_game_rounds
add column if not exists table_session_id uuid references public.member_table_sessions(id),
add column if not exists chip_balance_before numeric(14, 2),
add column if not exists chip_balance_after numeric(14, 2);

create index if not exists member_game_rounds_table_session_created_at_idx
on public.member_game_rounds (table_session_id, created_at desc)
where table_session_id is not null;

alter table public.member_table_sessions enable row level security;

drop policy if exists "Members can read their own table sessions" on public.member_table_sessions;
create policy "Members can read their own table sessions"
on public.member_table_sessions for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.member_table_sessions to authenticated;
grant select, insert, update on table public.member_table_sessions to service_role;

create or replace function public.apply_member_wallet_entry(
  p_user_id uuid,
  p_source text,
  p_amount numeric,
  p_reference_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  member_id uuid := p_user_id;
  existing_entry public.member_wallet_ledger%rowtype;
  current_balance numeric(14, 2);
  next_balance numeric(14, 2);
  ledger_entry public.member_wallet_ledger%rowtype;
begin
  if member_id is null then
    raise exception 'Wallet user id is required.' using errcode = '22004';
  end if;

  if p_source not in ('game_round', 'ad_reward', 'purchase', 'admin_adjustment', 'system', 'table_buy_in', 'table_cash_out') then
    raise exception 'Unsupported wallet source: %', p_source using errcode = '22023';
  end if;

  if p_amount is null then
    raise exception 'Wallet amount is required.' using errcode = '22004';
  end if;

  if p_idempotency_key is not null then
    select *
    into existing_entry
    from public.member_wallet_ledger
    where member_wallet_ledger.idempotency_key = p_idempotency_key
      and member_wallet_ledger.user_id = member_id
    limit 1;

    if found then
      return jsonb_build_object(
        'ledger_id', existing_entry.id,
        'balance_before', existing_entry.balance_before,
        'balance_after', existing_entry.balance_after,
        'amount', existing_entry.amount,
        'currency', existing_entry.currency,
        'idempotent', true,
        'created_at', existing_entry.created_at
      );
    end if;
  end if;

  insert into public.member_wallets (user_id)
  values (member_id)
  on conflict (user_id) do nothing;

  select balance
  into current_balance
  from public.member_wallets
  where user_id = member_id
  for update;

  if current_balance is null then
    raise exception 'Member wallet is unavailable.' using errcode = 'P0002';
  end if;

  next_balance := round(current_balance + p_amount, 2);

  if next_balance < 0 then
    raise exception 'Insufficient wallet balance.' using errcode = 'P0001';
  end if;

  insert into public.member_wallet_ledger (
    user_id,
    source,
    amount,
    balance_before,
    balance_after,
    reference_id,
    idempotency_key,
    metadata
  )
  values (
    member_id,
    p_source,
    round(p_amount, 2),
    current_balance,
    next_balance,
    p_reference_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into ledger_entry;

  update public.member_wallets
  set balance = next_balance,
      updated_at = timezone('utc', now())
  where user_id = member_id;

  return jsonb_build_object(
    'ledger_id', ledger_entry.id,
    'balance_before', ledger_entry.balance_before,
    'balance_after', ledger_entry.balance_after,
    'amount', ledger_entry.amount,
    'currency', ledger_entry.currency,
    'idempotent', false,
    'created_at', ledger_entry.created_at
  );
exception
  when unique_violation then
    if p_idempotency_key is null then
      raise;
    end if;

    select *
    into existing_entry
    from public.member_wallet_ledger
    where member_wallet_ledger.idempotency_key = p_idempotency_key
      and member_wallet_ledger.user_id = member_id
    limit 1;

    if not found then
      raise;
    end if;

    return jsonb_build_object(
      'ledger_id', existing_entry.id,
      'balance_before', existing_entry.balance_before,
      'balance_after', existing_entry.balance_after,
      'amount', existing_entry.amount,
      'currency', existing_entry.currency,
      'idempotent', true,
      'created_at', existing_entry.created_at
    );
end;
$$;

create or replace function public.open_member_table_session(
  p_user_id uuid,
  p_game_slug text,
  p_buy_in_amount numeric,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  member_id uuid := p_user_id;
  normalized_buy_in numeric(14, 2) := round(p_buy_in_amount, 2);
  existing_session public.member_table_sessions%rowtype;
  session_id uuid := gen_random_uuid();
  wallet_entry jsonb;
  inserted_session public.member_table_sessions%rowtype;
begin
  if member_id is null then
    raise exception 'Table session user id is required.' using errcode = '22004';
  end if;

  if p_game_slug is null or length(trim(p_game_slug)) = 0 then
    raise exception 'Game slug is required.' using errcode = '22004';
  end if;

  if normalized_buy_in <= 0 then
    raise exception 'Buy-in amount must be greater than zero.' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select *
    into existing_session
    from public.member_table_sessions
    where user_id = member_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'session', to_jsonb(existing_session),
        'wallet_entry', null,
        'idempotent', true
      );
    end if;
  end if;

  select *
  into existing_session
  from public.member_table_sessions
  where user_id = member_id
    and game_slug = p_game_slug
    and status = 'active'
  order by opened_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'session', to_jsonb(existing_session),
      'wallet_entry', null,
      'idempotent', true
    );
  end if;

  wallet_entry := public.apply_member_wallet_entry(
    member_id,
    'table_buy_in',
    -normalized_buy_in,
    session_id,
    case when p_idempotency_key is null then null else 'table-buy-in:' || p_idempotency_key end,
    jsonb_build_object('gameSlug', p_game_slug, 'tableSessionId', session_id) || coalesce(p_metadata, '{}'::jsonb)
  );

  insert into public.member_table_sessions (
    id,
    user_id,
    game_slug,
    status,
    buy_in_amount,
    chip_balance,
    wallet_ledger_id,
    idempotency_key,
    metadata
  )
  values (
    session_id,
    member_id,
    p_game_slug,
    'active',
    normalized_buy_in,
    normalized_buy_in,
    (wallet_entry->>'ledger_id')::uuid,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_session;

  return jsonb_build_object(
    'session', to_jsonb(inserted_session),
    'wallet_entry', wallet_entry,
    'idempotent', false
  );
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select *
      into existing_session
      from public.member_table_sessions
      where user_id = member_id
        and idempotency_key = p_idempotency_key
      limit 1;

      if found then
        return jsonb_build_object(
          'session', to_jsonb(existing_session),
          'wallet_entry', null,
          'idempotent', true
        );
      end if;
    end if;

    raise;
end;
$$;

create or replace function public.cash_out_member_table_session(
  p_user_id uuid,
  p_session_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  member_id uuid := p_user_id;
  table_session public.member_table_sessions%rowtype;
  wallet_entry jsonb := null;
  cash_out_amount numeric(14, 2);
begin
  if member_id is null or p_session_id is null then
    raise exception 'Table session user id and session id are required.' using errcode = '22004';
  end if;

  select *
  into table_session
  from public.member_table_sessions
  where id = p_session_id
    and user_id = member_id
  for update;

  if not found then
    raise exception 'Table session was not found.' using errcode = 'P0002';
  end if;

  if table_session.status <> 'active' then
    return jsonb_build_object(
      'session', to_jsonb(table_session),
      'wallet_entry', null,
      'idempotent', true
    );
  end if;

  cash_out_amount := table_session.chip_balance;

  if cash_out_amount > 0 then
    wallet_entry := public.apply_member_wallet_entry(
      member_id,
      'table_cash_out',
      cash_out_amount,
      table_session.id,
      coalesce(p_idempotency_key, 'table-cash-out:' || table_session.id),
      jsonb_build_object('gameSlug', table_session.game_slug, 'tableSessionId', table_session.id)
    );
  end if;

  update public.member_table_sessions
  set status = 'cashed_out',
      chip_balance = 0,
      cash_out_ledger_id = case when wallet_entry is null then null else (wallet_entry->>'ledger_id')::uuid end,
      closed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = table_session.id
  returning * into table_session;

  return jsonb_build_object(
    'session', to_jsonb(table_session),
    'wallet_entry', wallet_entry,
    'cash_out_amount', cash_out_amount,
    'idempotent', false
  );
end;
$$;

create or replace function public.apply_member_table_session_delta(
  p_user_id uuid,
  p_session_id uuid,
  p_delta numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  member_id uuid := p_user_id;
  table_session public.member_table_sessions%rowtype;
  normalized_delta numeric(14, 2) := round(p_delta, 2);
  balance_before numeric(14, 2);
  balance_after numeric(14, 2);
begin
  if member_id is null or p_session_id is null then
    raise exception 'Table session user id and session id are required.' using errcode = '22004';
  end if;

  select *
  into table_session
  from public.member_table_sessions
  where id = p_session_id
    and user_id = member_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active table session was not found.' using errcode = 'P0002';
  end if;

  balance_before := table_session.chip_balance;
  balance_after := round(balance_before + normalized_delta, 2);

  if balance_after < 0 then
    raise exception 'Insufficient table chips.' using errcode = 'P0001';
  end if;

  update public.member_table_sessions
  set chip_balance = balance_after,
      updated_at = timezone('utc', now())
  where id = table_session.id
  returning * into table_session;

  return jsonb_build_object(
    'session', to_jsonb(table_session),
    'chip_balance_before', balance_before,
    'chip_balance_after', balance_after,
    'delta', normalized_delta
  );
end;
$$;

revoke execute on function public.open_member_table_session(uuid, text, numeric, text, jsonb) from public;
revoke execute on function public.open_member_table_session(uuid, text, numeric, text, jsonb) from anon;
revoke execute on function public.open_member_table_session(uuid, text, numeric, text, jsonb) from authenticated;
grant execute on function public.open_member_table_session(uuid, text, numeric, text, jsonb) to service_role;

revoke execute on function public.cash_out_member_table_session(uuid, uuid, text) from public;
revoke execute on function public.cash_out_member_table_session(uuid, uuid, text) from anon;
revoke execute on function public.cash_out_member_table_session(uuid, uuid, text) from authenticated;
grant execute on function public.cash_out_member_table_session(uuid, uuid, text) to service_role;

revoke execute on function public.apply_member_table_session_delta(uuid, uuid, numeric) from public;
revoke execute on function public.apply_member_table_session_delta(uuid, uuid, numeric) from anon;
revoke execute on function public.apply_member_table_session_delta(uuid, uuid, numeric) from authenticated;
grant execute on function public.apply_member_table_session_delta(uuid, uuid, numeric) to service_role;
