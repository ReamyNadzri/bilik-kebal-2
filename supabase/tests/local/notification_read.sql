\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test'), ('00000000-0000-0000-0000-00000000000b','b@x.test');
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','A'), ('00000000-0000-0000-0000-00000000000b','B') on conflict do nothing;
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  perform public.enqueue_notification(gen_random_uuid(), a, 'welcome', gen_random_uuid());
  perform public.enqueue_notification(gen_random_uuid(), a, 'wanted_reply', gen_random_uuid());
  perform public.enqueue_notification(gen_random_uuid(), b, 'wanted_reply', gen_random_uuid());
  perform set_config('request.jwt.claim.sub', a::text, true);
  assert public.mark_all_notifications_read() = 2, 'marks the caller''s two';
  assert public.mark_all_notifications_read() = 0, 'repeat changes nothing';
  assert (select read_at is null from public.notifications where recipient_user_id = b), 'others untouched';
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.mark_all_notifications_read(); raise exception 'anonymous marked';
  exception when invalid_authorization_specification then null; end;
  assert not has_function_privilege('anon', 'public.mark_all_notifications_read()', 'execute'), 'anon cannot call';
  raise notice 'ALL READ ASSERTIONS PASSED';
end $$;
rollback;
