create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.handle_new_auth_user() from anon;
revoke execute on function public.handle_new_auth_user() from authenticated;

revoke execute on function public.handle_new_member_data() from public;
revoke execute on function public.handle_new_member_data() from anon;
revoke execute on function public.handle_new_member_data() from authenticated;

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

create index if not exists member_events_user_created_at_idx
on public.member_events (user_id, created_at desc);
