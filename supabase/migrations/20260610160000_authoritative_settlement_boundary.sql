create or replace function public.settle_member_table_session_round(
  p_user_id uuid,
  p_session_id uuid,
  p_game_slug text,
  p_outcome text,
  p_delta numeric,
  p_total_stake numeric,
  p_summary text default '',
  p_bet_snapshot jsonb default '{}'::jsonb,
  p_result_snapshot jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  member_id uuid := p_user_id;
  normalized_delta numeric(14, 2) := round(p_delta, 2);
  normalized_stake numeric(14, 2) := greatest(0, round(p_total_stake, 2));
  table_session public.member_table_sessions%rowtype;
  existing_round public.member_game_rounds%rowtype;
  game_progress public.member_game_progress%rowtype;
  game_round public.member_game_rounds%rowtype;
  balance_before numeric(14, 2);
  balance_after numeric(14, 2);
begin
  if member_id is null or p_session_id is null then
    raise exception 'Table session user id and session id are required.' using errcode = '22004';
  end if;

  if coalesce(nullif(p_game_slug, ''), '') = '' then
    raise exception 'A game slug is required.' using errcode = '22004';
  end if;

  if p_outcome not in ('win', 'loss', 'push') then
    raise exception 'A valid round outcome is required.' using errcode = '22004';
  end if;

  if p_idempotency_key is not null then
    select *
    into existing_round
    from public.member_game_rounds
    where user_id = member_id
      and idempotency_key = p_idempotency_key;

    if found then
      select *
      into table_session
      from public.member_table_sessions
      where id = coalesce(existing_round.table_session_id, p_session_id)
        and user_id = member_id;

      select *
      into game_progress
      from public.member_game_progress
      where user_id = member_id
        and game_slug = existing_round.game_slug;

      return jsonb_build_object(
        'session', to_jsonb(table_session),
        'progress', to_jsonb(game_progress),
        'round', to_jsonb(existing_round),
        'chip_balance_before', existing_round.chip_balance_before,
        'chip_balance_after', existing_round.chip_balance_after,
        'delta', existing_round.delta,
        'idempotent', true
      );
    end if;
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

  if table_session.game_slug <> p_game_slug then
    raise exception 'Table session game does not match round game.' using errcode = '22000';
  end if;

  if p_idempotency_key is not null then
    select *
    into existing_round
    from public.member_game_rounds
    where user_id = member_id
      and idempotency_key = p_idempotency_key;

    if found then
      select *
      into game_progress
      from public.member_game_progress
      where user_id = member_id
        and game_slug = existing_round.game_slug;

      return jsonb_build_object(
        'session', to_jsonb(table_session),
        'progress', to_jsonb(game_progress),
        'round', to_jsonb(existing_round),
        'chip_balance_before', existing_round.chip_balance_before,
        'chip_balance_after', existing_round.chip_balance_after,
        'delta', existing_round.delta,
        'idempotent', true
      );
    end if;
  end if;

  balance_before := table_session.chip_balance;

  if normalized_stake <= 0 or normalized_stake > balance_before then
    raise exception 'Invalid or unaffordable table stake.' using errcode = 'P0001';
  end if;

  balance_after := round(balance_before + normalized_delta, 2);

  if balance_after < 0 then
    raise exception 'Insufficient table chips.' using errcode = 'P0001';
  end if;

  update public.member_table_sessions
  set chip_balance = balance_after,
      updated_at = timezone('utc', now())
  where id = table_session.id
  returning * into table_session;

  insert into public.member_game_progress (
    user_id,
    game_slug,
    plays,
    wins,
    losses,
    streak,
    best_streak,
    bankroll,
    last_result,
    last_delta,
    last_summary,
    last_played_at
  )
  values (
    member_id,
    p_game_slug,
    1,
    case when p_outcome = 'win' then 1 else 0 end,
    case when p_outcome = 'loss' then 1 else 0 end,
    case when p_outcome = 'win' then 1 else 0 end,
    case when p_outcome = 'win' then 1 else 0 end,
    balance_after,
    p_outcome,
    normalized_delta,
    left(coalesce(p_summary, ''), 280),
    timezone('utc', now())
  )
  on conflict (user_id, game_slug) do update
  set plays = public.member_game_progress.plays + 1,
      wins = public.member_game_progress.wins + case when excluded.last_result = 'win' then 1 else 0 end,
      losses = public.member_game_progress.losses + case when excluded.last_result = 'loss' then 1 else 0 end,
      streak = case
        when excluded.last_result = 'win' then public.member_game_progress.streak + 1
        when excluded.last_result = 'loss' then 0
        else public.member_game_progress.streak
      end,
      best_streak = greatest(
        public.member_game_progress.best_streak,
        case
          when excluded.last_result = 'win' then public.member_game_progress.streak + 1
          when excluded.last_result = 'loss' then 0
          else public.member_game_progress.streak
        end
      ),
      bankroll = balance_after,
      last_result = excluded.last_result,
      last_delta = excluded.last_delta,
      last_summary = excluded.last_summary,
      last_played_at = excluded.last_played_at
  returning * into game_progress;

  insert into public.member_game_rounds (
    user_id,
    game_slug,
    table_session_id,
    round_status,
    total_stake,
    delta,
    outcome,
    chip_balance_before,
    chip_balance_after,
    result_summary,
    bet_snapshot,
    result_snapshot,
    idempotency_key
  )
  values (
    member_id,
    p_game_slug,
    table_session.id,
    'settled',
    normalized_stake,
    normalized_delta,
    p_outcome,
    balance_before,
    balance_after,
    left(coalesce(p_summary, ''), 280),
    coalesce(p_bet_snapshot, '{}'::jsonb),
    coalesce(p_result_snapshot, '{}'::jsonb) || jsonb_build_object(
      'tableSessionId', table_session.id,
      'chipBalanceBefore', balance_before,
      'chipBalanceAfter', balance_after
    ),
    p_idempotency_key
  )
  returning * into game_round;

  insert into public.member_events (user_id, kind, title, detail)
  values (member_id, 'game', p_game_slug || ' ' || p_outcome, left(coalesce(p_summary, ''), 280));

  return jsonb_build_object(
    'session', to_jsonb(table_session),
    'progress', to_jsonb(game_progress),
    'round', to_jsonb(game_round),
    'chip_balance_before', balance_before,
    'chip_balance_after', balance_after,
    'delta', normalized_delta,
    'idempotent', false
  );
end;
$$;

revoke execute on function public.settle_member_table_session_round(uuid, uuid, text, text, numeric, numeric, text, jsonb, jsonb, text) from public;
revoke execute on function public.settle_member_table_session_round(uuid, uuid, text, text, numeric, numeric, text, jsonb, jsonb, text) from anon;
revoke execute on function public.settle_member_table_session_round(uuid, uuid, text, text, numeric, numeric, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.settle_member_table_session_round(uuid, uuid, text, text, numeric, numeric, text, jsonb, jsonb, text) to service_role;

revoke insert, update on table public.member_game_progress from authenticated;
revoke insert on table public.member_events from authenticated;

drop policy if exists "Members can insert their own progress" on public.member_game_progress;
drop policy if exists "Members can update their own progress" on public.member_game_progress;
drop policy if exists "Members can insert their own events" on public.member_events;
