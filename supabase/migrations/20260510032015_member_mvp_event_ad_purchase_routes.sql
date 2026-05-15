grant update on table public.member_ad_rewards to service_role;
grant update on table public.member_purchases to service_role;

create index if not exists member_ad_rewards_user_status_created_at_idx
on public.member_ad_rewards (user_id, status, created_at desc);

create index if not exists member_purchases_user_status_created_at_idx
on public.member_purchases (user_id, status, created_at desc);
