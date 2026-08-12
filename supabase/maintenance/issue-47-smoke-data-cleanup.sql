-- Issue #47: bounded historical smoke-data cleanup.
--
-- SAFE DEFAULTS:
--   1. Sentinel identity/window values fail validation until explicitly edited.
--   2. apply_deletes is false, so the inventory path never executes DELETE.
--   3. Apply requires the exact Phase 1 counts and frozen manifest SHA-256.
--   4. The transaction always ends with ROLLBACK in the repository copy.
--
-- A live run is a separately reviewed copy in an approved maintenance window.
-- Never turn this file into a migration or execute it against live data as-is.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local timezone = 'UTC';

create temp table issue47_cleanup_config (
  target_user_id uuid not null,
  expected_email text not null,
  allow_known_demo_account boolean not null default false,
  window_start timestamptz not null,
  window_end timestamptz not null,
  idempotency_prefixes text[] not null,
  exact_event_ids uuid[] not null,
  max_rows_per_table integer not null check (max_rows_per_table between 1 and 10000),
  expected_counts jsonb not null default '{}'::jsonb,
  expected_manifest_sha256 text not null default 'NOT_FROZEN',
  apply_deletes boolean not null default false,
  confirmation_token text not null default 'NOT_APPROVED'
) on commit drop;

insert into issue47_cleanup_config (
  target_user_id,
  expected_email,
  allow_known_demo_account,
  window_start,
  window_end,
  idempotency_prefixes,
  exact_event_ids,
  max_rows_per_table,
  expected_counts,
  expected_manifest_sha256,
  apply_deletes,
  confirmation_token
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid, -- REPLACE: exact auth.users.id
  'e2e@taihu.casino',                            -- VERIFY: exact auth.users.email
  false,                                         -- demo@ requires true plus exact UUID/email
  '1900-01-01T00:00:00Z'::timestamptz,          -- REPLACE: inclusive UTC start
  '1900-01-02T00:00:00Z'::timestamptz,          -- REPLACE: exclusive UTC end
  array['e2e-']::text[],                         -- literal prefixes, never SQL patterns
  array[]::uuid[],                               -- exact member_events.id manifest only
  500,
  '{}'::jsonb,                                   -- APPLY: paste Phase 1 candidate_counts
  'NOT_FROZEN',                                  -- APPLY: paste Phase 1 manifest_sha256
  false,                                         -- SAFE DEFAULT: inventory only
  'NOT_APPROVED'                                 -- APPLY: ISSUE-47-DELETE-REVIEWED
);

do $$
declare
  cfg issue47_cleanup_config%rowtype;
  actual_email text;
  bad_prefix text;
begin
  select * into strict cfg from issue47_cleanup_config;

  if cfg.target_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Issue #47 guard: replace the sentinel target_user_id.';
  end if;

  if cfg.window_start = '1900-01-01T00:00:00Z'::timestamptz
     or cfg.window_end = '1900-01-02T00:00:00Z'::timestamptz
     or cfg.window_start >= cfg.window_end then
    raise exception 'Issue #47 guard: provide a real half-open UTC window [start, end).';
  end if;

  if cfg.window_end - cfg.window_start > interval '7 days' then
    raise exception 'Issue #47 guard: one run may cover at most seven days.';
  end if;

  select email
  into actual_email
  from auth.users
  where id = cfg.target_user_id;

  if actual_email is null or lower(actual_email) <> lower(cfg.expected_email) then
    raise exception 'Issue #47 guard: exact UUID/email mismatch or auth user missing.';
  end if;

  if lower(actual_email) = 'demo@taihu.casino' then
    if not cfg.allow_known_demo_account then
      raise exception 'Issue #47 guard: demo@taihu.casino requires allow_known_demo_account=true.';
    end if;
  elsif lower(actual_email) !~ '(e2e|smoke|test)' then
    raise exception 'Issue #47 guard: target email is not visibly a disposable test account.';
  end if;

  if coalesce(cardinality(cfg.idempotency_prefixes), 0) = 0 then
    raise exception 'Issue #47 guard: at least one literal idempotency prefix is required.';
  end if;

  if cardinality(cfg.idempotency_prefixes) <>
     (select count(distinct prefix) from unnest(cfg.idempotency_prefixes) as p(prefix)) then
    raise exception 'Issue #47 guard: idempotency prefixes must be unique.';
  end if;

  select prefix
  into bad_prefix
  from unnest(cfg.idempotency_prefixes) as candidate(prefix)
  where length(prefix) < 4
     or prefix !~ '^(e2e|smoke|ci)[-:]'
  limit 1;

  if bad_prefix is not null then
    raise exception 'Issue #47 guard: unsafe prefix "%". Use an explicit e2e-, smoke-, or ci- prefix.', bad_prefix;
  end if;

  if cardinality(cfg.exact_event_ids) <>
     (select count(distinct event_id) from unnest(cfg.exact_event_ids) as e(event_id)) then
    raise exception 'Issue #47 guard: exact_event_ids must be unique.';
  end if;
end;
$$;

-- Phase 2 only: block concurrent writes before candidate discovery. This closes
-- races from newly inserted dependency rows, including ledger.reference_id (no
-- foreign key), and protects wallet/progress aggregates. Dynamic SQL means the
-- inventory path neither plans nor acquires these write locks.
do $$
declare
  cfg issue47_cleanup_config%rowtype;
  locked_rows bigint;
begin
  select * into strict cfg from issue47_cleanup_config;

  if cfg.apply_deletes then
    execute $lock$
      lock table
        public.member_events,
        public.member_blackjack_round_states,
        public.member_game_rounds,
        public.member_table_sessions,
        public.member_wallet_ledger
      in share row exclusive mode
    $lock$;

    execute $lock$
      select count(*)
      from (
        select user_id
        from public.member_wallets
        where user_id = $1
        for update
      ) as locked_wallet
    $lock$
    into locked_rows
    using cfg.target_user_id;

    execute $lock$
      select count(*)
      from (
        select user_id
        from public.member_game_progress
        where user_id = $1
        for update
      ) as locked_progress
    $lock$
    into locked_rows
    using cfg.target_user_id;
  end if;
end;
$$;

-- Phase 1 anchors: exact user, half-open UTC window, and literal prefix equality.
-- left(value, length(prefix)) = prefix is intentionally used instead of LIKE.
create temp table issue47_round_seeds on commit drop as
select distinct round_row.id
from public.member_game_rounds as round_row
cross join issue47_cleanup_config as cfg
where round_row.user_id = cfg.target_user_id
  and round_row.created_at >= cfg.window_start
  and round_row.created_at < cfg.window_end
  and exists (
    select 1
    from unnest(cfg.idempotency_prefixes) as p(prefix)
    where left(coalesce(round_row.idempotency_key, ''), length(p.prefix)) = p.prefix
  );

create unique index on issue47_round_seeds (id);

create temp table issue47_session_seeds on commit drop as
select distinct session_row.id
from public.member_table_sessions as session_row
cross join issue47_cleanup_config as cfg
where session_row.user_id = cfg.target_user_id
  and session_row.opened_at >= cfg.window_start
  and session_row.opened_at < cfg.window_end
  and exists (
    select 1
    from unnest(cfg.idempotency_prefixes) as p(prefix)
    where left(coalesce(session_row.idempotency_key, ''), length(p.prefix)) = p.prefix
  );

create unique index on issue47_session_seeds (id);

create temp table issue47_blackjack_seeds on commit drop as
select distinct state_row.id, state_row.table_session_id, state_row.final_round_id
from public.member_blackjack_round_states as state_row
cross join issue47_cleanup_config as cfg
where state_row.user_id = cfg.target_user_id
  and state_row.created_at >= cfg.window_start
  and state_row.created_at < cfg.window_end
  and exists (
    select 1
    from unnest(cfg.idempotency_prefixes) as p(prefix)
    where left(coalesce(state_row.idempotency_key, ''), length(p.prefix)) = p.prefix
  );

create unique index on issue47_blackjack_seeds (id);

-- Close the dependency set across session -> round -> blackjack. Every selected
-- row still has the exact user/window restriction; dependencies do not widen it.
create temp table issue47_candidate_sessions on commit drop as
select session_row.id
from public.member_table_sessions as session_row
cross join issue47_cleanup_config as cfg
where session_row.user_id = cfg.target_user_id
  and session_row.opened_at >= cfg.window_start
  and session_row.opened_at < cfg.window_end
  and (
    exists (select 1 from issue47_session_seeds as seed where seed.id = session_row.id)
    or exists (
      select 1
      from issue47_round_seeds as seed
      join public.member_game_rounds as round_row on round_row.id = seed.id
      where round_row.table_session_id = session_row.id
    )
    or exists (
      select 1 from issue47_blackjack_seeds as seed
      where seed.table_session_id = session_row.id
    )
  );

create unique index on issue47_candidate_sessions (id);

create temp table issue47_candidate_rounds on commit drop as
select round_row.id
from public.member_game_rounds as round_row
cross join issue47_cleanup_config as cfg
where round_row.user_id = cfg.target_user_id
  and round_row.created_at >= cfg.window_start
  and round_row.created_at < cfg.window_end
  and (
    exists (select 1 from issue47_round_seeds as seed where seed.id = round_row.id)
    or exists (
      select 1 from issue47_candidate_sessions as candidate
      where candidate.id = round_row.table_session_id
    )
    or exists (
      select 1 from issue47_blackjack_seeds as seed
      where seed.final_round_id = round_row.id
    )
  );

create unique index on issue47_candidate_rounds (id);

create temp table issue47_candidate_blackjack on commit drop as
select state_row.id
from public.member_blackjack_round_states as state_row
cross join issue47_cleanup_config as cfg
where state_row.user_id = cfg.target_user_id
  and state_row.created_at >= cfg.window_start
  and state_row.created_at < cfg.window_end
  and (
    exists (select 1 from issue47_blackjack_seeds as seed where seed.id = state_row.id)
    or exists (
      select 1 from issue47_candidate_sessions as candidate
      where candidate.id = state_row.table_session_id
    )
    or exists (
      select 1 from issue47_candidate_rounds as candidate
      where candidate.id = state_row.final_round_id
    )
  );

create unique index on issue47_candidate_blackjack (id);

create temp table issue47_candidate_ledger on commit drop as
select ledger_row.id
from public.member_wallet_ledger as ledger_row
cross join issue47_cleanup_config as cfg
where ledger_row.user_id = cfg.target_user_id
  and ledger_row.created_at >= cfg.window_start
  and ledger_row.created_at < cfg.window_end
  and (
    exists (
      select 1
      from unnest(cfg.idempotency_prefixes) as p(prefix)
      where left(coalesce(ledger_row.idempotency_key, ''), length(p.prefix)) = p.prefix
         or left(coalesce(ledger_row.idempotency_key, ''), length('table-buy-in:' || p.prefix)) = 'table-buy-in:' || p.prefix
    )
    or exists (
      select 1 from issue47_candidate_sessions as candidate
      where candidate.id = ledger_row.reference_id
    )
    or exists (
      select 1 from issue47_candidate_rounds as candidate
      where candidate.id = ledger_row.reference_id
    )
    or exists (
      select 1
      from issue47_candidate_sessions as candidate
      join public.member_table_sessions as session_row on session_row.id = candidate.id
      where ledger_row.id = session_row.wallet_ledger_id
         or ledger_row.id = session_row.cash_out_ledger_id
    )
  );

create unique index on issue47_candidate_ledger (id);

-- Events have no reliable session/round foreign key. They are selected only by
-- exact UUIDs supplied by the operator; title/outcome text is never a selector.
create temp table issue47_candidate_events on commit drop as
select event_row.id
from issue47_cleanup_config as cfg
cross join unnest(cfg.exact_event_ids) as requested(event_id)
join public.member_events as event_row on event_row.id = requested.event_id
where event_row.user_id = cfg.target_user_id
  and event_row.created_at >= cfg.window_start
  and event_row.created_at < cfg.window_end;

create unique index on issue47_candidate_events (id);

-- Phase 2 only: additionally lock exact candidate rows before computing the
-- frozen-row comparison and invariants. Inventory does not take these locks.
do $$
declare
  cfg issue47_cleanup_config%rowtype;
begin
  select * into strict cfg from issue47_cleanup_config;

  if cfg.apply_deletes then
    execute $lock$
      select event_row.id
      from public.member_events as event_row
      join issue47_candidate_events as candidate on candidate.id = event_row.id
      for update of event_row
    $lock$;

    execute $lock$
      select state_row.id
      from public.member_blackjack_round_states as state_row
      join issue47_candidate_blackjack as candidate on candidate.id = state_row.id
      for update of state_row
    $lock$;

    execute $lock$
      select round_row.id
      from public.member_game_rounds as round_row
      join issue47_candidate_rounds as candidate on candidate.id = round_row.id
      for update of round_row
    $lock$;

    execute $lock$
      select session_row.id
      from public.member_table_sessions as session_row
      join issue47_candidate_sessions as candidate on candidate.id = session_row.id
      for update of session_row
    $lock$;

    execute $lock$
      select ledger_row.id
      from public.member_wallet_ledger as ledger_row
      join issue47_candidate_ledger as candidate on candidate.id = ledger_row.id
      for update of ledger_row
    $lock$;
  end if;
end;
$$;

-- Freeze the protected aggregates. Apply may leave them untouched only when the
-- economic/progress invariants below prove that deleting candidates has no effect.
create temp table issue47_protected_snapshot on commit drop as
select
  wallet.balance as wallet_balance,
  (
    select md5(coalesce(jsonb_agg(to_jsonb(progress_row) order by progress_row.game_slug)::text, '[]'))
    from public.member_game_progress as progress_row
    where progress_row.user_id = cfg.target_user_id
  ) as progress_hash
from issue47_cleanup_config as cfg
left join public.member_wallets as wallet on wallet.user_id = cfg.target_user_id;

-- Full-row fingerprints make the Phase 1 manifest sensitive to updates as well
-- as inserted/deleted IDs. Only hashes and exact IDs are exported, not row JSON.
create temp table issue47_manifest_rows (
  table_name text not null,
  record_id uuid not null,
  row_sha256 text not null,
  primary key (table_name, record_id)
) on commit drop;

insert into issue47_manifest_rows (table_name, record_id, row_sha256)
select 'member_events', event_row.id,
       encode(digest(convert_to(to_jsonb(event_row)::text, 'UTF8'), 'sha256'), 'hex')
from issue47_candidate_events as candidate
join public.member_events as event_row on event_row.id = candidate.id
union all
select 'member_blackjack_round_states', state_row.id,
       encode(digest(convert_to(to_jsonb(state_row)::text, 'UTF8'), 'sha256'), 'hex')
from issue47_candidate_blackjack as candidate
join public.member_blackjack_round_states as state_row on state_row.id = candidate.id
union all
select 'member_game_rounds', round_row.id,
       encode(digest(convert_to(to_jsonb(round_row)::text, 'UTF8'), 'sha256'), 'hex')
from issue47_candidate_rounds as candidate
join public.member_game_rounds as round_row on round_row.id = candidate.id
union all
select 'member_table_sessions', session_row.id,
       encode(digest(convert_to(to_jsonb(session_row)::text, 'UTF8'), 'sha256'), 'hex')
from issue47_candidate_sessions as candidate
join public.member_table_sessions as session_row on session_row.id = candidate.id
union all
select 'member_wallet_ledger', ledger_row.id,
       encode(digest(convert_to(to_jsonb(ledger_row)::text, 'UTF8'), 'sha256'), 'hex')
from issue47_candidate_ledger as candidate
join public.member_wallet_ledger as ledger_row on ledger_row.id = candidate.id;

create temp table issue47_manifest_counts on commit drop as
select expected.table_name, count(manifest.record_id)::bigint as candidate_count
from (
  values
    ('member_events'::text),
    ('member_blackjack_round_states'::text),
    ('member_game_rounds'::text),
    ('member_table_sessions'::text),
    ('member_wallet_ledger'::text)
) as expected(table_name)
left join issue47_manifest_rows as manifest on manifest.table_name = expected.table_name
group by expected.table_name;

create unique index on issue47_manifest_counts (table_name);

create temp table issue47_manifest_summary on commit drop as
select
  (
    select jsonb_object_agg(table_name, candidate_count order by table_name)
    from issue47_manifest_counts
  ) as candidate_counts,
  encode(
    digest(
      convert_to(
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_array(table_name, record_id, row_sha256)
              order by table_name, record_id
            )
            from issue47_manifest_rows
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) as manifest_sha256;

-- Phase 1 frozen evidence. Paste both values into config for an apply rehearsal.
select candidate_counts, manifest_sha256
from issue47_manifest_summary;

select table_name, record_id, row_sha256
from issue47_manifest_rows
order by table_name, record_id;

select
  round_row.id,
  round_row.game_slug,
  round_row.table_session_id,
  round_row.round_status,
  round_row.total_stake,
  round_row.delta,
  round_row.idempotency_key,
  round_row.created_at
from issue47_candidate_rounds as candidate
join public.member_game_rounds as round_row on round_row.id = candidate.id
order by round_row.created_at, round_row.id;

select
  session_row.id,
  session_row.game_slug,
  session_row.status,
  session_row.buy_in_amount,
  session_row.chip_balance,
  session_row.idempotency_key,
  session_row.opened_at,
  session_row.closed_at
from issue47_candidate_sessions as candidate
join public.member_table_sessions as session_row on session_row.id = candidate.id
order by session_row.opened_at, session_row.id;

create temp table issue47_invariants (
  invariant_name text primary key,
  violation_count bigint not null,
  required_value text not null
) on commit drop;

insert into issue47_invariants (invariant_name, violation_count, required_value)
values
  (
    'exact_event_id_manifest_fully_resolved',
    (
      select cardinality(cfg.exact_event_ids) - count(candidate.id)
      from issue47_cleanup_config as cfg
      left join issue47_candidate_events as candidate on true
      group by cfg.exact_event_ids
    ),
    '0'
  ),
  (
    'no_active_candidate_table_sessions',
    (select count(*) from public.member_table_sessions as session_row
      join issue47_candidate_sessions as candidate on candidate.id = session_row.id
      where session_row.status = 'active'),
    '0'
  ),
  (
    'no_active_candidate_blackjack_states',
    (select count(*) from public.member_blackjack_round_states as state_row
      join issue47_candidate_blackjack as candidate on candidate.id = state_row.id
      where state_row.status = 'active'),
    '0'
  ),
  (
    'candidate_rounds_have_zero_progress_and_chip_effect',
    (select count(*) from public.member_game_rounds as round_row
      join issue47_candidate_rounds as candidate on candidate.id = round_row.id
      where round_row.round_status not in ('rejected', 'voided')
         or round_row.delta <> 0
         or round_row.total_stake <> 0),
    '0'
  ),
  (
    'candidate_ledger_net_amount_is_zero',
    (select case when coalesce(sum(ledger_row.amount), 0) = 0 then 0 else 1 end
      from public.member_wallet_ledger as ledger_row
      join issue47_candidate_ledger as candidate on candidate.id = ledger_row.id),
    '0'
  ),
  (
    'existing_ledger_chain_is_continuous',
    (select count(*)
      from (
        select ledger_row.balance_before,
               lag(ledger_row.balance_after) over (order by ledger_row.created_at, ledger_row.id) as previous_after
        from public.member_wallet_ledger as ledger_row
        cross join issue47_cleanup_config as cfg
        where ledger_row.user_id = cfg.target_user_id
      ) as ordered
      where ordered.previous_after is not null
        and ordered.balance_before is distinct from ordered.previous_after),
    '0'
  ),
  (
    'retained_ledger_chain_is_continuous',
    (select count(*)
      from (
        select ledger_row.balance_before,
               lag(ledger_row.balance_after) over (order by ledger_row.created_at, ledger_row.id) as previous_after
        from public.member_wallet_ledger as ledger_row
        cross join issue47_cleanup_config as cfg
        where ledger_row.user_id = cfg.target_user_id
          and not exists (
            select 1 from issue47_candidate_ledger as candidate
            where candidate.id = ledger_row.id
          )
      ) as ordered
      where ordered.previous_after is not null
        and ordered.balance_before is distinct from ordered.previous_after),
    '0'
  ),
  (
    'retained_ledger_tail_matches_wallet',
    (
      select case
        when not exists (select 1 from issue47_candidate_ledger) then 0
        when retained.balance_after is null then 1
        when retained.balance_after is distinct from wallet.balance then 1
        else 0
      end
      from issue47_cleanup_config as cfg
      left join public.member_wallets as wallet on wallet.user_id = cfg.target_user_id
      left join lateral (
        select ledger_row.balance_after
        from public.member_wallet_ledger as ledger_row
        where ledger_row.user_id = cfg.target_user_id
          and not exists (
            select 1 from issue47_candidate_ledger as candidate
            where candidate.id = ledger_row.id
          )
        order by ledger_row.created_at desc, ledger_row.id desc
        limit 1
      ) as retained on true
    ),
    '0'
  ),
  (
    'no_non_candidate_round_references_candidate_session',
    (select count(*) from public.member_game_rounds as round_row
      where exists (
        select 1 from issue47_candidate_sessions as candidate
        where candidate.id = round_row.table_session_id
      )
      and not exists (
        select 1 from issue47_candidate_rounds as candidate
        where candidate.id = round_row.id
      )),
    '0'
  ),
  (
    'no_non_candidate_blackjack_references_candidate_session_or_round',
    (select count(*) from public.member_blackjack_round_states as state_row
      where (
        exists (select 1 from issue47_candidate_sessions as candidate where candidate.id = state_row.table_session_id)
        or exists (select 1 from issue47_candidate_rounds as candidate where candidate.id = state_row.final_round_id)
      )
      and not exists (
        select 1 from issue47_candidate_blackjack as candidate
        where candidate.id = state_row.id
      )),
    '0'
  ),
  (
    'no_non_candidate_session_references_candidate_ledger',
    (select count(*) from public.member_table_sessions as session_row
      where (
        exists (select 1 from issue47_candidate_ledger as candidate where candidate.id = session_row.wallet_ledger_id)
        or exists (select 1 from issue47_candidate_ledger as candidate where candidate.id = session_row.cash_out_ledger_id)
      )
      and not exists (
        select 1 from issue47_candidate_sessions as candidate
        where candidate.id = session_row.id
      )),
    '0'
  ),
  (
    'candidate_sessions_do_not_reference_non_candidate_ledger',
    (select count(*) from public.member_table_sessions as session_row
      join issue47_candidate_sessions as candidate on candidate.id = session_row.id
      where (
        session_row.wallet_ledger_id is not null
        and not exists (
          select 1 from issue47_candidate_ledger as ledger_candidate
          where ledger_candidate.id = session_row.wallet_ledger_id
        )
      )
      or (
        session_row.cash_out_ledger_id is not null
        and not exists (
          select 1 from issue47_candidate_ledger as ledger_candidate
          where ledger_candidate.id = session_row.cash_out_ledger_id
        )
      )),
    '0'
  ),
  (
    'no_non_candidate_ledger_references_candidate_session_or_round',
    (select count(*) from public.member_wallet_ledger as ledger_row
      where (
        exists (select 1 from issue47_candidate_sessions as candidate where candidate.id = ledger_row.reference_id)
        or exists (select 1 from issue47_candidate_rounds as candidate where candidate.id = ledger_row.reference_id)
      )
      and not exists (
        select 1 from issue47_candidate_ledger as candidate
        where candidate.id = ledger_row.id
      )),
    '0'
  );

insert into issue47_invariants (invariant_name, violation_count, required_value)
select 'candidate_count_within_limit:' || counts.table_name,
       greatest(counts.candidate_count - cfg.max_rows_per_table, 0),
       '0'
from issue47_manifest_counts as counts
cross join issue47_cleanup_config as cfg;

select invariant_name, violation_count, required_value
from issue47_invariants
order by invariant_name;

-- Apply is fail-closed unless Phase 1's exact count object and full-row manifest
-- hash match the current transaction and every invariant is zero.
do $$
declare
  cfg issue47_cleanup_config%rowtype;
  summary issue47_manifest_summary%rowtype;
  violations bigint;
begin
  select * into strict cfg from issue47_cleanup_config;
  select * into strict summary from issue47_manifest_summary;
  select coalesce(sum(violation_count), 0) into violations from issue47_invariants;

  if cfg.apply_deletes then
    if cfg.confirmation_token <> 'ISSUE-47-DELETE-REVIEWED' then
      raise exception 'Issue #47 guard: apply requires confirmation token ISSUE-47-DELETE-REVIEWED.';
    end if;

    if cfg.expected_manifest_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'Issue #47 guard: apply requires the frozen Phase 1 manifest SHA-256.';
    end if;

    if cfg.expected_manifest_sha256 <> summary.manifest_sha256 then
      raise exception 'Issue #47 guard: manifest SHA-256 drifted; return to Phase 1.';
    end if;

    if cfg.expected_counts <> summary.candidate_counts then
      raise exception 'Issue #47 guard: candidate counts drifted; return to Phase 1.';
    end if;

    if violations <> 0 then
      raise exception 'Issue #47 guard: % invariant violation(s); no deletes executed.', violations;
    end if;
  end if;
end;
$$;

-- IMPORTANT: DELETE statements are inside the apply-only PL/pgSQL branch.
-- With apply_deletes=false this block does not execute or plan a DELETE, so the
-- inventory path does not acquire DELETE/RowExclusiveLock or apply table locks.
do $$
declare
  cfg issue47_cleanup_config%rowtype;
begin
  select * into strict cfg from issue47_cleanup_config;

  if cfg.apply_deletes then
    execute $delete$
      delete from public.member_events as target_row
      where exists (
        select 1 from issue47_candidate_events as candidate
        where candidate.id = target_row.id
      )
    $delete$;

    execute $delete$
      delete from public.member_blackjack_round_states as target_row
      where exists (
        select 1 from issue47_candidate_blackjack as candidate
        where candidate.id = target_row.id
      )
    $delete$;

    execute $delete$
      delete from public.member_game_rounds as target_row
      where exists (
        select 1 from issue47_candidate_rounds as candidate
        where candidate.id = target_row.id
      )
    $delete$;

    execute $delete$
      delete from public.member_table_sessions as target_row
      where exists (
        select 1 from issue47_candidate_sessions as candidate
        where candidate.id = target_row.id
      )
    $delete$;

    execute $delete$
      delete from public.member_wallet_ledger as target_row
      where exists (
        select 1 from issue47_candidate_ledger as candidate
        where candidate.id = target_row.id
      )
    $delete$;
  end if;
end;
$$;

-- In inventory mode these counts simply repeat the candidates. In apply rehearsal
-- they must all be zero before the repository-level ROLLBACK restores the rows.
select manifest.table_name, count(target.record_id)::bigint as remaining_candidate_rows
from issue47_manifest_counts as manifest
left join lateral (
  select event_row.id as record_id
  from public.member_events as event_row
  where manifest.table_name = 'member_events'
    and exists (select 1 from issue47_candidate_events as candidate where candidate.id = event_row.id)
  union all
  select state_row.id
  from public.member_blackjack_round_states as state_row
  where manifest.table_name = 'member_blackjack_round_states'
    and exists (select 1 from issue47_candidate_blackjack as candidate where candidate.id = state_row.id)
  union all
  select round_row.id
  from public.member_game_rounds as round_row
  where manifest.table_name = 'member_game_rounds'
    and exists (select 1 from issue47_candidate_rounds as candidate where candidate.id = round_row.id)
  union all
  select session_row.id
  from public.member_table_sessions as session_row
  where manifest.table_name = 'member_table_sessions'
    and exists (select 1 from issue47_candidate_sessions as candidate where candidate.id = session_row.id)
  union all
  select ledger_row.id
  from public.member_wallet_ledger as ledger_row
  where manifest.table_name = 'member_wallet_ledger'
    and exists (select 1 from issue47_candidate_ledger as candidate where candidate.id = ledger_row.id)
) as target on true
group by manifest.table_name
order by manifest.table_name;

do $$
declare
  cfg issue47_cleanup_config%rowtype;
  remaining bigint;
  wallet_balance numeric;
  progress_hash text;
  protected issue47_protected_snapshot%rowtype;
  retained_discontinuities bigint;
  retained_tail numeric;
begin
  select * into strict cfg from issue47_cleanup_config;

  if cfg.apply_deletes then
    select * into strict protected from issue47_protected_snapshot;

    select
      (select count(*) from public.member_events as target_row where exists (select 1 from issue47_candidate_events as c where c.id = target_row.id))
      + (select count(*) from public.member_blackjack_round_states as target_row where exists (select 1 from issue47_candidate_blackjack as c where c.id = target_row.id))
      + (select count(*) from public.member_game_rounds as target_row where exists (select 1 from issue47_candidate_rounds as c where c.id = target_row.id))
      + (select count(*) from public.member_table_sessions as target_row where exists (select 1 from issue47_candidate_sessions as c where c.id = target_row.id))
      + (select count(*) from public.member_wallet_ledger as target_row where exists (select 1 from issue47_candidate_ledger as c where c.id = target_row.id))
    into remaining;

    if remaining <> 0 then
      raise exception 'Issue #47 postcondition: % candidate row(s) remain.', remaining;
    end if;

    select balance into wallet_balance
    from public.member_wallets
    where user_id = cfg.target_user_id;

    select md5(coalesce(jsonb_agg(to_jsonb(progress_row) order by progress_row.game_slug)::text, '[]'))
    into progress_hash
    from public.member_game_progress as progress_row
    where progress_row.user_id = cfg.target_user_id;

    if wallet_balance is distinct from protected.wallet_balance then
      raise exception 'Issue #47 postcondition: member_wallets.balance changed.';
    end if;

    if progress_hash is distinct from protected.progress_hash then
      raise exception 'Issue #47 postcondition: member_game_progress changed.';
    end if;

    select count(*)
    into retained_discontinuities
    from (
      select ledger_row.balance_before,
             lag(ledger_row.balance_after) over (order by ledger_row.created_at, ledger_row.id) as previous_after
      from public.member_wallet_ledger as ledger_row
      where ledger_row.user_id = cfg.target_user_id
    ) as ordered
    where ordered.previous_after is not null
      and ordered.balance_before is distinct from ordered.previous_after;

    if retained_discontinuities <> 0 then
      raise exception 'Issue #47 postcondition: retained ledger chain is discontinuous.';
    end if;

    select ledger_row.balance_after
    into retained_tail
    from public.member_wallet_ledger as ledger_row
    where ledger_row.user_id = cfg.target_user_id
    order by ledger_row.created_at desc, ledger_row.id desc
    limit 1;

    if exists (select 1 from issue47_candidate_ledger)
       and retained_tail is distinct from wallet_balance then
      raise exception 'Issue #47 postcondition: retained ledger tail does not match wallet balance.';
    end if;
  end if;
end;
$$;

-- SAFE DEFAULT. A live execution requires a separately reviewed copy with exact
-- identity/window/prefix/event IDs, frozen Phase 1 counts/hash, explicit demo
-- allowance when applicable, both apply gates, and this ROLLBACK changed to COMMIT.
rollback;
