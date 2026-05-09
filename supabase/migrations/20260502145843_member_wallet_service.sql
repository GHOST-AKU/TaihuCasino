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

  if p_source not in ('game_round', 'ad_reward', 'purchase', 'admin_adjustment', 'system') then
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

revoke execute on function public.apply_member_wallet_entry(uuid, text, numeric, uuid, text, jsonb) from public;
revoke execute on function public.apply_member_wallet_entry(uuid, text, numeric, uuid, text, jsonb) from anon;
revoke execute on function public.apply_member_wallet_entry(uuid, text, numeric, uuid, text, jsonb) from authenticated;
grant execute on function public.apply_member_wallet_entry(uuid, text, numeric, uuid, text, jsonb) to service_role;
