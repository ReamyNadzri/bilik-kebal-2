\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test',now()), ('00000000-0000-0000-0000-00000000000b','b@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Finder') on conflict do nothing;
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
create or replace function private.current_user_can_transact_at(target_institution_id uuid) returns boolean language sql as $$ select auth.uid() is not null $$;
create function pg_temp.mk(p_title text, p_kind public.wanted_kind) returns uuid language sql as $$
  insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    p_kind, true, p_title, 'A description that is long enough.', 30, 'open', 30, 1000, '2026-09-13',
    'contributors_only', now(), now(), now() + interval '30 days')
  returning public_id $$;
do $$
declare acad uuid; item uuid; ok boolean;
begin
  acad := pg_temp.mk('Academic past year paper', 'academic');
  item := pg_temp.mk('Missing blue water bottle', 'missing_item');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  perform public.post_wanted_reply(acad, 'Which semester do you need?');
  begin
    perform public.post_wanted_reply(acad, 'Here: https://drive.google.com/abc');
    raise exception 'link should be refused';
  exception when invalid_parameter_value then
    assert sqlerrm = 'wanted_reply_link_not_allowed', sqlerrm;
  end;
  perform public.post_wanted_reply(item, 'Saw it near https://maps.app/x');  -- links fine on community kinds
  -- reopen: only the poster, only when closed
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  perform public.resolve_own_community_wanted(item);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  begin perform public.reopen_own_community_wanted(item); raise exception 'non-poster reopened';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  perform public.reopen_own_community_wanted(item);
  assert (select status = 'open' and thread_closed_at is null from public.wanted_requests where public_id = item), 'reopened';
  perform public.resolve_own_community_wanted(item);
  update public.wanted_requests set thread_closed_at = now() - interval '8 days' where public_id = item;
  begin perform public.reopen_own_community_wanted(item); raise exception 'reopened after 7 days';
  exception when insufficient_privilege then null; end;
  -- after purge, replying and reading are gone
  perform private.purge_closed_wanted_threads();
  assert (select vanished_at is not null from public.wanted_requests where public_id = item), 'vanished';
  -- academic: close, purge after 7 days keeps the card
  update public.wanted_requests set status = 'fulfilled' where public_id = acad;
  update public.wanted_requests set thread_closed_at = now() - interval '8 days' where public_id = acad;
  perform private.purge_closed_wanted_threads();
  assert (select thread_purged_at is not null and vanished_at is null from public.wanted_requests where public_id = acad), 'academic card stays';
  assert (select count(*) = 0 from public.wanted_replies r join public.wanted_requests w on w.id = r.wanted_request_id where w.public_id = acad), 'academic q&a cleared';
  raise notice 'ALL RPC ASSERTIONS PASSED';
end $$;
rollback;
