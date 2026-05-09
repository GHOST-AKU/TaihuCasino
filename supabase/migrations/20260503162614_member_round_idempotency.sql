alter table public.member_game_rounds
add column if not exists idempotency_key text;

create unique index if not exists member_game_rounds_user_idempotency_key_idx
on public.member_game_rounds (user_id, idempotency_key)
where idempotency_key is not null;
