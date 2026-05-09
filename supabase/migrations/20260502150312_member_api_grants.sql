grant usage on schema public to authenticated;

grant select on table public.profiles to authenticated;
grant insert, update on table public.profiles to authenticated;

grant select on table public.member_settings to authenticated;
grant insert, update on table public.member_settings to authenticated;

grant select on table public.member_wallets to authenticated;

grant select on table public.member_game_progress to authenticated;
grant insert, update on table public.member_game_progress to authenticated;

grant select on table public.member_events to authenticated;
grant insert on table public.member_events to authenticated;

grant select on table public.member_wallet_ledger to authenticated;
grant select on table public.member_game_rounds to authenticated;
grant select on table public.member_ad_rewards to authenticated;
grant select on table public.member_purchases to authenticated;
