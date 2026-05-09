grant usage on schema public to service_role;

grant select, insert, update on table public.profiles to service_role;
grant select, insert, update on table public.member_settings to service_role;
grant select, insert, update on table public.member_wallets to service_role;
grant select, insert, update on table public.member_game_progress to service_role;
grant select, insert on table public.member_events to service_role;

grant select, insert on table public.member_wallet_ledger to service_role;
grant select, insert on table public.member_game_rounds to service_role;
grant select, insert on table public.member_ad_rewards to service_role;
grant select, insert on table public.member_purchases to service_role;
