create table if not exists public.member_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('game_round', 'ad_reward', 'purchase', 'admin_adjustment', 'system')),
  amount numeric(14, 2) not null,
  balance_before numeric(14, 2) not null,
  balance_after numeric(14, 2) not null,
  currency text not null default 'USD' check (currency = 'USD'),
  reference_id uuid,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (balance_after = balance_before + amount)
);

create table if not exists public.member_game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_slug text not null,
  round_status text not null check (round_status in ('settled', 'rejected', 'voided')),
  total_stake numeric(14, 2) not null default 0 check (total_stake >= 0),
  delta numeric(14, 2) not null default 0,
  outcome text not null check (outcome in ('win', 'loss', 'push')),
  result_summary text not null default '',
  bet_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.member_ad_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  placement text not null check (placement in ('daily_bonus', 'loss_recovery', 'lobby_reward')),
  reward_amount numeric(14, 2) not null default 0 check (reward_amount >= 0),
  status text not null check (status in ('started', 'completed', 'credited', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  credited_at timestamptz,
  check (status <> 'credited' or credited_at is not null)
);

create table if not exists public.member_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  credits numeric(14, 2) not null default 0 check (credits >= 0),
  status text not null check (status in ('created', 'succeeded', 'failed', 'canceled', 'credited')),
  provider text not null default 'stub',
  provider_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  credited_at timestamptz,
  check (status <> 'credited' or credited_at is not null)
);

create unique index if not exists member_wallet_ledger_idempotency_key_idx
on public.member_wallet_ledger (idempotency_key)
where idempotency_key is not null;

create unique index if not exists member_wallet_ledger_source_reference_idx
on public.member_wallet_ledger (source, reference_id)
where reference_id is not null;

create index if not exists member_wallet_ledger_user_created_at_idx
on public.member_wallet_ledger (user_id, created_at desc);

create index if not exists member_wallet_ledger_reference_idx
on public.member_wallet_ledger (reference_id)
where reference_id is not null;

create index if not exists member_game_rounds_user_created_at_idx
on public.member_game_rounds (user_id, created_at desc);

create index if not exists member_game_rounds_user_game_created_at_idx
on public.member_game_rounds (user_id, game_slug, created_at desc);

create index if not exists member_ad_rewards_user_created_at_idx
on public.member_ad_rewards (user_id, created_at desc);

create index if not exists member_purchases_user_created_at_idx
on public.member_purchases (user_id, created_at desc);

create unique index if not exists member_purchases_provider_reference_idx
on public.member_purchases (provider, provider_reference)
where provider_reference is not null;

alter table public.member_wallet_ledger enable row level security;
alter table public.member_game_rounds enable row level security;
alter table public.member_ad_rewards enable row level security;
alter table public.member_purchases enable row level security;

drop policy if exists "Members can update their own wallets" on public.member_wallets;
drop policy if exists "Members can insert their own wallets" on public.member_wallets;

drop policy if exists "Members can read their own wallet ledger" on public.member_wallet_ledger;
create policy "Members can read their own wallet ledger"
on public.member_wallet_ledger for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own wallet ledger stubs" on public.member_wallet_ledger;

drop policy if exists "Members can read their own game rounds" on public.member_game_rounds;
create policy "Members can read their own game rounds"
on public.member_game_rounds for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own game round stubs" on public.member_game_rounds;

drop policy if exists "Members can read their own ad rewards" on public.member_ad_rewards;
create policy "Members can read their own ad rewards"
on public.member_ad_rewards for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own ad reward stubs" on public.member_ad_rewards;

drop policy if exists "Members can update their own ad reward stubs" on public.member_ad_rewards;

drop policy if exists "Members can read their own purchases" on public.member_purchases;
create policy "Members can read their own purchases"
on public.member_purchases for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own purchase stubs" on public.member_purchases;

drop policy if exists "Members can update their own purchase stubs" on public.member_purchases;
