\set ON_ERROR_STOP 1
-- Migration 202610200005: a refund task tells its Backer once per Wanted and the
-- Owner and every Platform Sheriff once per Wanted; the Backer's own list keeps
-- a withdrawn Wanted with its refund state.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','poster@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','backer1@x.test',now()),
 ('00000000-0000-0000-0000-00000000000c','backer2@x.test',now()),
 ('00000000-0000-0000-0000-00000000000d','owner@x.test',now()),
 ('00000000-0000-0000-0000-00000000000e','sheriff1@x.test',now()),
 ('00000000-0000-0000-0000-00000000000f','sheriff2@x.test',now()),
 ('00000000-0000-0000-0000-000000000010','member@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Backer One'),
 ('00000000-0000-0000-0000-00000000000c','Backer Two'),('00000000-0000-0000-0000-00000000000d','Owner'),
 ('00000000-0000-0000-0000-00000000000e','Sheriff One'),('00000000-0000-0000-0000-00000000000f','Sheriff Two'),
 ('00000000-0000-0000-0000-000000000010','Member') on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values
 ('00000000-0000-0000-0000-00000000000d','owner'),
 ('00000000-0000-0000-0000-00000000000e','platform_sheriff'),
 ('00000000-0000-0000-0000-00000000000f','platform_sheriff');
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
create function pg_temp.mk(p_title text) returns uuid language sql as $$
  insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    'academic', false, p_title, 'A description that is long enough.', 14, 'open', 14, 1000, '2026-09-13',
    'contributors_only', now(), now() - interval '10 minutes', now() + interval '14 days')
  returning public_id $$;
-- A confirmed contribution (10% fee on top) without the provider path.
create function pg_temp.contribute(p_public uuid, p_user uuid, p_sen integer) returns uuid language plpgsql as $$
declare w uuid; intent uuid := gen_random_uuid(); ev uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  select id into w from public.wanted_requests where public_id = p_public;
  insert into public.contribution_intents (id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, fee_sen, expires_at, status, paid_at)
  values (intent, w, p_user, 'toyyibpay', 'bill-' || intent, p_sen, p_sen / 10, now() + interval '30 minutes', 'paid', now());
  insert into public.provider_events (id, provider, provider_transaction_id, provider_bill_id, amount_sen, status, payload_hash, processed_at)
  values (ev, 'toyyibpay', 'tx-' || ev, 'bill-' || intent, p_sen + p_sen / 10, 'successful', '\x00', now());
  insert into public.contributions (id, contribution_intent_id, wanted_request_id, contributor_user_id, provider_event_id, amount_sen, fee_sen)
  values (c, intent, w, p_user, ev, p_sen, p_sen / 10);
  return c;
end $$;
create function pg_temp.notices(p_kind text, p_user uuid default null) returns bigint language sql as $$
  select count(*) from public.notifications
  where kind = p_kind and (p_user is null or recipient_user_id = p_user) $$;
do $$
declare
  withdrawn_w uuid; live_w uuid; staff_w uuid; row record; n integer;
  backer1 constant uuid := '00000000-0000-0000-0000-00000000000b';
  backer2 constant uuid := '00000000-0000-0000-0000-00000000000c';
  owner_id constant uuid := '00000000-0000-0000-0000-00000000000d';
  sheriff1 constant uuid := '00000000-0000-0000-0000-00000000000e';
  sheriff2 constant uuid := '00000000-0000-0000-0000-00000000000f';
  member constant uuid := '00000000-0000-0000-0000-000000000010';
begin
  assert not has_function_privilege('anon', 'public.list_own_backed_wanted()', 'execute'), 'anon may list';
  assert has_function_privilege('authenticated', 'public.list_own_backed_wanted()', 'execute'), 'members may not list';

  withdrawn_w := pg_temp.mk('Past year papers for MAT183');
  live_w := pg_temp.mk('Tutorial answers for CSC510');
  perform pg_temp.contribute(withdrawn_w, backer1, 1000);
  perform pg_temp.contribute(withdrawn_w, backer1, 500);
  perform pg_temp.contribute(withdrawn_w, backer2, 2000);
  perform pg_temp.contribute(live_w, backer1, 700);

  -- Withdrawal: three refund tasks, one notice per Backer, one per staff member.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  n := public.withdraw_own_wanted(withdrawn_w);
  assert n = 3, 'three refunds queued: ' || n;
  assert pg_temp.notices('wanted_refund_queued', backer1) = 1, 'backer one told once';
  assert pg_temp.notices('wanted_refund_queued', backer2) = 1, 'backer two told once';
  assert pg_temp.notices('wanted_refund_queued') = 2, 'only the two Backers told';
  assert pg_temp.notices('refund_queue_pending', owner_id) = 1, 'owner told once';
  assert pg_temp.notices('refund_queue_pending', sheriff1) = 1, 'sheriff one told once';
  assert pg_temp.notices('refund_queue_pending', sheriff2) = 1, 'sheriff two told once';
  assert pg_temp.notices('refund_queue_pending') = 3, 'only staff told';
  assert not exists (select 1 from public.notifications where recipient_user_id = member
                     and kind in ('wanted_refund_queued', 'refund_queue_pending')), 'member told nothing';
  assert (select bool_and(subject_id = withdrawn_w) from public.notifications
          where kind in ('wanted_refund_queued', 'refund_queue_pending')), 'subject is the public id';
  assert not exists (select 1 from private.notification_email_outbox o join public.notifications x on x.id = o.notification_id
                     where x.kind in ('wanted_refund_queued', 'refund_queue_pending')), 'refund notices are in-app only';

  -- Replaying the queueing changes nothing.
  insert into public.refund_tasks (wanted_request_id, contribution_id, contributor_user_id, amount_sen, status)
  select c.wanted_request_id, c.id, c.contributor_user_id, c.amount_sen, 'pending'
  from public.contributions c join public.wanted_requests w on w.id = c.wanted_request_id
  where w.public_id = withdrawn_w
  on conflict (contribution_id) do nothing;
  assert pg_temp.notices('wanted_refund_queued') = 2 and pg_temp.notices('refund_queue_pending') = 3,
    'replay is a no-op';

  -- A late payment while refunds are outstanding is queued without another notice.
  perform pg_temp.contribute(withdrawn_w, backer1, 300);
  assert (select count(*) = 4 from public.refund_tasks t join public.wanted_requests w on w.id = t.wanted_request_id
          where w.public_id = withdrawn_w), 'late payment queued';
  assert pg_temp.notices('wanted_refund_queued', backer1) = 1, 'no second notice for backer one';
  assert pg_temp.notices('refund_queue_pending', owner_id) = 1, 'no second notice for the owner';

  -- The Backer's own list keeps the withdrawn Wanted, pending, with the full refund.
  perform set_config('request.jwt.claim.sub', backer1::text, true);
  assert (select count(*) = 2 from public.list_own_backed_wanted()), 'both backed Wanteds listed';
  select * into row from public.list_own_backed_wanted() where public_id = withdrawn_w;
  assert row.status = 'withdrawn' and row.withdrawn and not row.removed, 'withdrawn by the poster';
  assert row.refund_state = 'pending', 'refund pending: ' || row.refund_state;
  assert row.contributed_sen = 1800, 'contributed: ' || row.contributed_sen;
  assert row.refund_sen = 1980, 'refund with fee: ' || row.refund_sen;
  select * into row from public.list_own_backed_wanted() where public_id = live_w;
  assert row.status = 'open' and row.refund_state = 'none' and row.refund_sen = 0, 'live Wanted, no refund';

  -- Once every refund is recorded the state is refunded (status set directly:
  -- these contributions never entered the ledger the completion RPC balances).
  update public.refund_tasks t set status = 'completed', completed_at = now()
  from public.wanted_requests w where w.id = t.wanted_request_id and w.public_id = withdrawn_w;
  select * into row from public.list_own_backed_wanted() where public_id = withdrawn_w;
  assert row.refund_state = 'refunded', 'refunded: ' || row.refund_state;

  -- A payment confirmed after everything was refunded opens a new episode.
  perform pg_temp.contribute(withdrawn_w, backer2, 400);
  assert pg_temp.notices('wanted_refund_queued', backer2) = 2, 'backer two told again';
  assert pg_temp.notices('wanted_refund_queued', backer1) = 1, 'backer one not told again';
  assert pg_temp.notices('refund_queue_pending', sheriff2) = 2, 'staff told again';

  -- A staff member who backed a withdrawn Wanted gets both notices, and the withdrawal succeeds.
  staff_w := pg_temp.mk('Lab manual for CHM138 please');
  perform pg_temp.contribute(staff_w, owner_id, 500);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  assert public.withdraw_own_wanted(staff_w) = 1, 'staff-backed Wanted withdrawn';
  assert pg_temp.notices('wanted_refund_queued', owner_id) = 1, 'owner told as a Backer';
  assert pg_temp.notices('refund_queue_pending', owner_id) = 3, 'owner told as staff';

  -- Another member, the poster and a signed-out caller see nothing.
  perform set_config('request.jwt.claim.sub', member::text, true);
  assert not exists (select 1 from public.list_own_backed_wanted()), 'member lists nothing';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  assert not exists (select 1 from public.list_own_backed_wanted()), 'poster lists nothing';
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.list_own_backed_wanted(); raise exception 'signed out listed';
  exception when invalid_authorization_specification then null; end;
end $$;
rollback;
