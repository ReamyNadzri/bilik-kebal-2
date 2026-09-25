\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test',now()), ('00000000-0000-0000-0000-00000000000b','b@x.test',now()), ('00000000-0000-0000-0000-00000000000c','c@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Finder'),('00000000-0000-0000-0000-00000000000c','Sheriff') on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values ('00000000-0000-0000-0000-00000000000c','platform_sheriff');
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
create or replace function private.current_user_can_transact_at(target_institution_id uuid) returns boolean language sql as $$ select auth.uid() is not null $$;
insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    'missing_item', true, 'Missing blue water bottle', 'A description that is long enough.', 30, 'open', 30, 1000, '2026-09-13',
    'contributors_only', now(), now(), now() + interval '30 days');
do $$
declare w uuid := '30000000-0000-0000-0000-000000000001'; r1 uuid; r2 uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  r1 := public.post_wanted_reply(w, 'Saw it at the library');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  r2 := public.post_wanted_reply(w, 'Which floor?', r1);
  assert (select parent_reply_id = r1 from public.wanted_replies where id = r2), 'parent';
  begin perform public.post_wanted_reply(w, 'bad parent', gen_random_uuid()); raise exception 'x';
  exception when invalid_parameter_value then null; end;
  -- someone else cannot edit
  begin perform public.edit_own_wanted_reply(r1, 'hacked'); raise exception 'edited others';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  perform public.edit_own_wanted_reply(r1, 'Saw it at the library, level 2');
  assert (select edited_at is not null and body like '%level 2' from public.wanted_replies where id = r1), 'edit';
  update public.wanted_replies set created_at = now() - interval '16 minutes' where id = r1;
  begin perform public.edit_own_wanted_reply(r1, 'late'); raise exception 'late edit';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_reply_edit_window_closed'; end;
  perform public.delete_own_wanted_reply(r1);
  assert (select body = 'deleted' and deleted_at is not null from public.wanted_replies where id = r1), 'delete erases';
  begin perform public.post_wanted_reply(w, 'reply to deleted', r1); raise exception 'x';
  exception when invalid_parameter_value then null; end;
  -- members cannot hide; sheriff can, audited
  begin perform public.set_wanted_reply_hidden(r2, true, 'spam'); raise exception 'member hid';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  perform public.set_wanted_reply_hidden(r2, true, 'personal_info');
  assert (select hidden_reason = 'personal_info' from public.wanted_replies where id = r2), 'hidden';
  assert (select count(*) = 1 from public.identity_audit_events where event_type = 'chat.reply_hidden'), 'audited';
  -- The writer (the poster, a) is told, with the request as the subject and nothing else.
  assert (select count(*) = 1 from public.notifications
          where kind = 'wanted_reply_hidden' and recipient_user_id = '00000000-0000-0000-0000-00000000000a'
            and subject_id = w), 'writer notified';
  perform public.set_wanted_reply_hidden(r2, true, 'personal_info');
  assert (select count(*) = 1 from public.notifications where kind = 'wanted_reply_hidden'), 'hiding twice notifies once';
  perform public.set_wanted_reply_hidden(r2, false);
  assert (select hidden_at is null from public.wanted_replies where id = r2), 'restored';
  assert (select count(*) = 1 from public.notifications where kind = 'wanted_reply_hidden'), 'restoring does not notify';
  -- A Sheriff hiding their own message is not notified.
  r1 := public.post_wanted_reply(w, 'Sheriff note');
  perform public.set_wanted_reply_hidden(r1, true, 'off_topic');
  assert (select count(*) = 1 from public.notifications where kind = 'wanted_reply_hidden'), 'no self notice';
  raise notice 'ALL CHAT EDIT ASSERTIONS PASSED';
end $$;
rollback;
