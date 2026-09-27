\set ON_ERROR_STOP 1
-- Migration 202610130002: the poster edits or withdraws in the first hour,
-- until a claim or someone else's reply locks the Wanted; withdrawal queues
-- a refund for every contribution, including one confirmed afterwards.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','poster@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','backer@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Backer') on conflict do nothing;
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
create or replace function private.current_user_can_transact_at(target_institution_id uuid) returns boolean language sql as $$ select auth.uid() is not null $$;
create function pg_temp.mk(p_title text, p_kind public.wanted_kind, p_published timestamptz) returns uuid language sql as $$
  insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    p_kind, p_kind <> 'academic', p_title, 'A description that is long enough.', 14, 'open', 14, 1000, '2026-09-13',
    'contributors_only', now(), p_published, p_published + interval '14 days')
  returning public_id $$;
-- A confirmed contribution without the provider path: intent, event, contribution.
create function pg_temp.contribute(p_public uuid, p_user uuid, p_sen integer) returns uuid language plpgsql as $$
declare w uuid; intent uuid := gen_random_uuid(); ev uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  select id into w from public.wanted_requests where public_id = p_public;
  insert into public.contribution_intents (id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, expires_at, status, paid_at)
  values (intent, w, p_user, 'toyyibpay', 'bill-' || intent, p_sen, now() + interval '30 minutes', 'paid', now());
  insert into public.provider_events (id, provider, provider_transaction_id, provider_bill_id, amount_sen, status, payload_hash, processed_at)
  values (ev, 'toyyibpay', 'tx-' || ev, 'bill-' || intent, p_sen, 'successful', '\x00', now());
  insert into public.contributions (id, contribution_intent_id, wanted_request_id, contributor_user_id, provider_event_id, amount_sen)
  values (c, intent, w, p_user, ev, p_sen);
  return c;
end $$;
do $$
declare
  fresh uuid; late uuid; claimed uuid; item uuid; refunds integer; win record;
  poster constant text := '00000000-0000-0000-0000-00000000000a';
  backer constant text := '00000000-0000-0000-0000-00000000000b';
begin
  fresh := pg_temp.mk('Past year papers for MAT183', 'academic', now() - interval '10 minutes');
  late := pg_temp.mk('Tutorial answers for CSC510', 'academic', now() - interval '61 minutes');
  claimed := pg_temp.mk('Lab manual for CHM138 please', 'academic', now() - interval '5 minutes');
  item := pg_temp.mk('Missing blue water bottle', 'missing_item', now() - interval '5 minutes');
  perform pg_temp.contribute(fresh, poster::uuid, 1000);
  perform pg_temp.contribute(fresh, backer::uuid, 500);

  -- The window: poster only.
  perform set_config('request.jwt.claim.sub', backer, true);
  assert not exists (select 1 from public.my_wanted_change_window(fresh)), 'non-poster sees no window';
  perform set_config('request.jwt.claim.sub', poster, true);
  select * into win from public.my_wanted_change_window(fresh);
  assert win.locked_reason is null, 'fresh window open';
  select * into win from public.my_wanted_change_window(late);
  assert win.locked_reason = 'window_closed', 'hour passed: ' || coalesce(win.locked_reason, 'null');

  -- Edit: owner only, text limits, previous text kept.
  perform set_config('request.jwt.claim.sub', backer, true);
  begin perform public.update_own_published_wanted(fresh, 'Someone else''s title', 'Someone else''s description here.');
    raise exception 'non-poster edited';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub', poster, true);
  begin perform public.update_own_published_wanted(fresh, 'Short', 'A description that is long enough.');
    raise exception 'short title accepted';
  exception when invalid_parameter_value then null; end;
  perform public.update_own_published_wanted(fresh, '  Past year papers for MAT183 (2022+) ', 'Any final papers from 2022 onwards, answers optional.');
  assert (select title = 'Past year papers for MAT183 (2022+)' from public.wanted_requests where public_id = fresh), 'edited and trimmed';
  assert (select count(*) = 1 from public.wanted_request_revisions r join public.wanted_requests w on w.id = r.wanted_request_id
          where w.public_id = fresh and r.previous_title = 'Past year papers for MAT183'), 'revision kept';
  begin perform public.update_own_published_wanted(late, 'Tutorial answers for CSC510 v2', 'A description that is long enough.');
    raise exception 'edited after the hour';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_change_locked:window_closed', sqlerrm; end;

  -- A claim locks it.
  insert into public.claims (wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
  select w.id, backer::uuid, w.institution_id, 'a.pdf', 'application/pdf', 10, decode(repeat('aa', 32), 'hex'), 'k/one', now()
  from public.wanted_requests w where w.public_id = claimed;
  begin perform public.withdraw_own_wanted(claimed); raise exception 'withdrew after a claim';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_change_locked:claim_submitted', sqlerrm; end;

  -- Someone else's reply locks a community Wanted; the poster's own does not.
  perform public.post_wanted_reply(item, 'Still looking for it, thanks!');
  select * into win from public.my_wanted_change_window(item);
  assert win.locked_reason is null, 'own reply does not lock';
  perform set_config('request.jwt.claim.sub', backer, true);
  perform public.post_wanted_reply(item, 'I think I saw it at the cafe.');
  perform set_config('request.jwt.claim.sub', poster, true);
  select * into win from public.my_wanted_change_window(item);
  assert win.locked_reason = 'reply_received', 'reply locks: ' || coalesce(win.locked_reason, 'null');

  -- Withdraw: every contribution queued once, the Wanted hidden, claims refused.
  refunds := public.withdraw_own_wanted(fresh);
  assert refunds = 2, 'two refunds queued: ' || refunds;
  assert (select status = 'withdrawn' and withdrawn_at is not null from public.wanted_requests where public_id = fresh), 'withdrawn';
  assert (select coalesce(sum(amount_sen), 0) = 1500 from public.refund_tasks t join public.wanted_requests w on w.id = t.wanted_request_id
          where w.public_id = fresh and t.status = 'pending'), 'full amounts queued';
  begin perform public.withdraw_own_wanted(fresh); raise exception 'withdrew twice';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_change_locked:not_open', sqlerrm; end;

  -- A late confirmed contribution is refunded too.
  perform pg_temp.contribute(fresh, backer::uuid, 300);
  assert (select count(*) = 3 from public.refund_tasks t join public.wanted_requests w on w.id = t.wanted_request_id
          where w.public_id = fresh), 'late contribution queued for refund';

  -- No claim on a withdrawn Wanted.
  begin
    insert into public.claims (wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
    select w.id, backer::uuid, w.institution_id, 'b.pdf', 'application/pdf', 10, decode(repeat('bb', 32), 'hex'), 'k/two', now()
    from public.wanted_requests w where w.public_id = fresh;
    raise exception 'claimed a withdrawn Wanted';
  exception when raise_exception then assert sqlerrm = 'wanted request is not open', sqlerrm; end;

  raise notice 'ALL POSTER EDIT/WITHDRAW ASSERTIONS PASSED';
end $$;
rollback;
