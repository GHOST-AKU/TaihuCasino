create extension if not exists pgcrypto;

create table if not exists public.member_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('light', 'dark', 'system')),
  language text not null default 'zh' check (language in ('zh', 'en')),
  sound_enabled boolean not null default true,
  notification_enabled boolean not null default true,
  marketing_opt_in boolean not null default false,
  profile_visibility text not null default 'private' check (profile_visibility in ('private', 'friends', 'public')),
  quick_bet_amount integer not null default 100 check (quick_bet_amount between 10 and 5000),
  table_density text not null default 'comfortable' check (table_density in ('comfortable', 'compact')),
  responsible_limit integer not null default 5000 check (responsible_limit between 100 and 100000),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.member_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  balance numeric(14, 2) not null default 25000,
  bonus_balance numeric(14, 2) not null default 1200,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.member_game_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_slug text not null,
  plays integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  bankroll numeric(14, 2) not null default 25000,
  last_result text check (last_result in ('win', 'loss', 'push')),
  last_delta numeric(14, 2) not null default 0,
  last_summary text not null default '',
  last_played_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, game_slug)
);

create table if not exists public.member_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.member_settings enable row level security;
alter table public.member_wallets enable row level security;
alter table public.member_game_progress enable row level security;
alter table public.member_events enable row level security;

drop policy if exists "Members can read their own settings" on public.member_settings;
create policy "Members can read their own settings"
on public.member_settings for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own settings" on public.member_settings;
create policy "Members can insert their own settings"
on public.member_settings for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own settings" on public.member_settings;
create policy "Members can update their own settings"
on public.member_settings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can read their own wallets" on public.member_wallets;
create policy "Members can read their own wallets"
on public.member_wallets for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own wallets" on public.member_wallets;
create policy "Members can insert their own wallets"
on public.member_wallets for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own wallets" on public.member_wallets;
create policy "Members can update their own wallets"
on public.member_wallets for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can read their own progress" on public.member_game_progress;
create policy "Members can read their own progress"
on public.member_game_progress for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own progress" on public.member_game_progress;
create policy "Members can insert their own progress"
on public.member_game_progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own progress" on public.member_game_progress;
create policy "Members can update their own progress"
on public.member_game_progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Members can read their own events" on public.member_events;
create policy "Members can read their own events"
on public.member_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Members can insert their own events" on public.member_events;
create policy "Members can insert their own events"
on public.member_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop trigger if exists set_member_settings_updated_at on public.member_settings;
create trigger set_member_settings_updated_at
before update on public.member_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_member_wallets_updated_at on public.member_wallets;
create trigger set_member_wallets_updated_at
before update on public.member_wallets
for each row
execute function public.set_updated_at();

drop trigger if exists set_member_game_progress_updated_at on public.member_game_progress;
create trigger set_member_game_progress_updated_at
before update on public.member_game_progress
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_member_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.member_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_member_data_created on auth.users;
create trigger on_auth_user_member_data_created
after insert on auth.users
for each row
execute function public.handle_new_member_data();
