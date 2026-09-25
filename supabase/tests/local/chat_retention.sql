\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','b@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Finder')
 on conflict (user_id) do nothing;
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');

create temp table w as select 1;
-- helper: a published free community wanted
create function pg_temp.mk(p_title text, p_free boolean, p_kind public.wanted_kind default 'missing_item') returns uuid language sql as $$
  insert into public.wanted_requests (commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values ('00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    p_kind, p_free, p_title, 'A description that is long enough.', 30, 'open', 30, 1000, '2026-09-13',
    'contributors_only', now() - interval '60 days', now() - interval '60 days', now() + interval '60 days')
  returning id $$;

do $$
declare fresh uuid; stale uuid; found_ uuid; paid uuid; r jsonb; n int;
begin
  fresh := pg_temp.mk('Fresh lost wallet', true);
  stale := pg_temp.mk('Stale lost umbrella', true);
  found_ := pg_temp.mk('Found lost student card', true);
  paid := pg_temp.mk('Paid lost laptop charger', false);

  -- replies count as activity
  insert into public.wanted_replies (wanted_request_id, author_user_id, body) values (fresh, '00000000-0000-0000-0000-00000000000b', 'Saw it at the library');
  select thread_reply_count into n from public.wanted_requests where id = fresh;
  assert n = 1, 'reply count';
  update public.wanted_requests set thread_last_activity_at = now() - interval '31 days' where id in (stale, found_, paid);

  insert into public.wanted_replies (wanted_request_id, author_user_id, body, created_at) values (found_, '00000000-0000-0000-0000-00000000000b', 'It is at the guard house', now() - interval '31 days');
  update public.wanted_requests set thread_last_activity_at = now() - interval '31 days' where id = found_;

  -- poster marks found: thread clock starts
  update public.wanted_requests set status = 'closed' where id = found_;
  assert (select thread_closed_at is not null from public.wanted_requests where id = found_), 'closed_at set';

  r := private.run_wanted_thread_retention();
  assert (r->>'closed')::int = 1, 'only the stale free one auto-closes: ' || r::text;
  assert (select status = 'closed' and thread_auto_closed from public.wanted_requests where id = stale), 'stale closed';
  assert (select status = 'open' from public.wanted_requests where id = fresh), 'fresh stays open';
  assert (select status = 'open' from public.wanted_requests where id = paid), 'paid never auto-closes';
  assert (select count(*) = 1 from public.notifications where kind = 'wanted_thread_auto_closed'), 'one notification';
  assert (r->>'purged')::int = 0, 'nothing purged before 7 days';

  -- second run is a no-op
  r := private.run_wanted_thread_retention();
  assert r = '{"closed":0,"purged":0}'::jsonb, 'idempotent: ' || r::text;
  assert (select count(*) = 1 from public.notifications where kind = 'wanted_thread_auto_closed'), 'no second notification';

  -- 8 days later
  update public.wanted_requests set thread_closed_at = now() - interval '8 days' where id in (found_, stale);
  r := private.run_wanted_thread_retention();
  assert (r->>'purged')::int = 2, 'both purge: ' || r::text;
  assert (select count(*) = 0 from public.wanted_replies where wanted_request_id = found_), 'replies deleted';
  assert (select vanished_at is not null and thread_reply_count = 1 from public.wanted_requests where id = found_), 'card vanished, count kept';

  -- paid: closed with a pending release is not purged
  update public.wanted_requests set status = 'closed' where id = paid;
  set local session_replication_role = replica;
  insert into public.contributions (id, contribution_intent_id, wanted_request_id, contributor_user_id, provider_event_id, amount_sen)
  values (gen_random_uuid(), gen_random_uuid(), paid, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 500);
  set local session_replication_role = origin;
  update public.wanted_requests set thread_closed_at = now() - interval '8 days' where id = paid;
  r := private.run_wanted_thread_retention();
  assert (r->>'purged')::int = 0, 'paid unsettled not purged: ' || r::text;
  insert into public.community_payout_requests (wanted_request_id, requester_user_id, finder_user_id, status, decided_at)
  values (paid, '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'approved', now());
  update public.wanted_requests set status = 'fulfilled' where id = paid;
  assert (select thread_closed_at = now() - interval '8 days' from public.wanted_requests where id = paid), 'closed -> fulfilled keeps clock';
  r := private.run_wanted_thread_retention();
  assert (r->>'purged')::int = 1, 'paid released purges: ' || r::text;

  -- reopen clears the clock; reviewing clears it too
  update public.wanted_requests set status = 'closed' where id = fresh;
  update public.wanted_requests set status = 'open' where id = fresh;
  assert (select thread_closed_at is null and not thread_auto_closed from public.wanted_requests where id = fresh), 'reopen clears';

  -- link rule
  assert private.text_contains_contact_or_link('see https://drive.google.com/x'), 'url';
  assert private.text_contains_contact_or_link('go to bit.ly/abc'), 'short';
  assert private.text_contains_contact_or_link('mail me at ali@gmail.com'), 'email';
  assert private.text_contains_contact_or_link('t.me/someone'), 'telegram';
  assert not private.text_contains_contact_or_link('Which chapter? Is it the 2024 paper, part 3.2?'), 'plain';
  assert not private.text_contains_contact_or_link('Does it cover the cover page, e.g. the index?'), 'e.g.';
  raise notice 'ALL RETENTION ASSERTIONS PASSED';
end $$;
rollback;
