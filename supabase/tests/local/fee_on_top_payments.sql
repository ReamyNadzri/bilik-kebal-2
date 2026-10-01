\set ON_ERROR_STOP 1
-- Migration 202610180001: the fee is billed on top of each contribution, held,
-- earned at payout and refunded in full; payment details are required to pay;
-- backing an open Wanted; the test gateway goes through the verified path.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','poster@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','backer@x.test',now()),
 ('00000000-0000-0000-0000-00000000000c','hunter@x.test',now()),
 ('00000000-0000-0000-0000-00000000000d','owner@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Backer'),
 ('00000000-0000-0000-0000-00000000000c','Hunter'),('00000000-0000-0000-0000-00000000000d','Owner') on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values ('00000000-0000-0000-0000-00000000000d','owner');
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM');
insert into public.campuses (id, institution_id, slug, name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
create or replace function private.current_user_can_transact_at(target_institution_id uuid) returns boolean language sql as $$ select auth.uid() is not null $$;
create function pg_temp.mk(p_title text, p_status public.wanted_status) returns uuid language sql as $$
  insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    'academic', false, p_title, 'A description that is long enough.', 14, p_status, 14, 1000, '2026-09-13',
    'contributors_only', now(),
    case when p_status = 'awaiting_payment' then null else now() - interval '2 hours' end,
    case when p_status = 'awaiting_payment' then null else now() + interval '14 days' end)
  returning public_id $$;
create function pg_temp.pay(p_bill text, p_total integer, p_status text default 'successful') returns text language sql as $$
  select public.record_verified_contribution('mock', 'tx-' || p_bill || '-' || p_status || '-' || p_total, p_bill, p_total, p_status, repeat('ab', 32)) $$;
create function pg_temp.balanced() returns boolean language sql as $$
  select coalesce(bool_and(d = c), true) from (
    select sum(debit_sen) d, sum(credit_sen) c from public.ledger_entries group by transaction_id) t $$;
create function pg_temp.account(p_code text) returns bigint language sql as $$
  select coalesce(sum(credit_sen) - sum(debit_sen), 0) from public.ledger_entries where account_code = p_code $$;
do $$
declare
  open_one uuid; open_two uuid; awaiting uuid; w_id uuid; detail record; payout_id uuid; refund record; n integer;
  poster constant text := '00000000-0000-0000-0000-00000000000a';
  backer constant text := '00000000-0000-0000-0000-00000000000b';
  hunter constant text := '00000000-0000-0000-0000-00000000000c';
  owner_id constant text := '00000000-0000-0000-0000-00000000000d';
begin
  open_one := pg_temp.mk('Past year papers for MAT183', 'open');
  open_two := pg_temp.mk('Tutorial answers for CSC510', 'open');

  -- Payment details: required, validated, read back masked.
  perform set_config('request.jwt.claim.sub', backer, true);
  begin perform public.create_backing_intent(open_one, 'mock', 'mock_b1', 1000, 100, now() + interval '30 minutes');
    raise exception 'paid without payment details';
  exception when insufficient_privilege then assert sqlerrm = 'payment_details_required', sqlerrm; end;
  begin perform public.set_own_payment_details('0123456789', 'maybank', 'Backer Bin Ali', '1234567890');
    raise exception 'unnormalised phone accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'payment_details_invalid', sqlerrm; end;
  begin perform public.set_own_payment_details('+60123456789', 'not_a_bank', 'Backer Bin Ali', '1234567890');
    raise exception 'unknown bank accepted';
  exception when invalid_parameter_value then null; end;
  perform public.set_own_payment_details('+60123456789', 'maybank', ' Backer Bin Ali ', '1234567890');
  perform public.set_own_payment_details('+60123456789', 'cimb', 'Backer Bin Ali', '7000123456');
  select * into detail from public.my_payment_details();
  assert detail.bank_code = 'cimb' and detail.account_number_last4 = '3456'
    and detail.account_holder_name = 'Backer Bin Ali', 'masked own details';

  -- Backing: the fee must match the snapshotted rate, rounded down.
  begin perform public.create_backing_intent(open_one, 'mock', 'mock_b1', 1000, 0, now() + interval '30 minutes');
    raise exception 'fee mismatch accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'contribution_fee_mismatch', sqlerrm; end;
  assert public.backing_fee_rate(open_one) = 1000, 'fee rate readable';
  perform public.create_backing_intent(open_one, 'mock', 'mock_b1', 1000, 100, now() + interval '30 minutes');
  perform public.create_backing_intent(open_one, 'mock', 'mock_b2', 555, 55, now() + interval '30 minutes');
  assert (select purpose = 'back' and amount_sen = 1000 and fee_sen = 100 from public.my_payment_bill('mock_b1')), 'bill reads as backing';
  perform set_config('request.jwt.claim.sub', poster, true);
  assert not exists (select 1 from public.my_payment_bill('mock_b1')), 'someone else''s bill is hidden';

  -- The provider must report contribution + fee; the contribution alone is rejected.
  assert pg_temp.pay('mock_b2', 555) = 'rejected', 'contribution-only amount rejected';
  assert (select status = 'failed' from public.contribution_intents where provider_bill_id = 'mock_b2'), 'short payment fails the bill';
  assert pg_temp.pay('mock_b1', 1100) = 'accepted', 'total accepted';
  assert pg_temp.pay('mock_b1', 1100) = 'duplicate', 'replay is a duplicate';
  assert (select c.amount_sen = 1000 and c.fee_sen = 100 from public.contributions c
          join public.contribution_intents i on i.id = c.contribution_intent_id where i.provider_bill_id = 'mock_b1'), 'contribution split';
  assert pg_temp.balanced(), 'ledger balanced after contribution';
  assert pg_temp.account('wanted_escrow') = 1000 and pg_temp.account('platform_fee_held') = 100
    and pg_temp.account('platform_cash') = -1100, 'escrow holds the bounty, fee held apart';

  -- The poster adds more and the Hunter wins: paid the whole bounty.
  perform public.set_own_payment_details('+601112345678', 'public_bank', 'Poster Binti Abu', '4000111122');
  perform public.create_backing_intent(open_one, 'mock', 'mock_p1', 2000, 200, now() + interval '30 minutes');
  assert pg_temp.pay('mock_p1', 2200) = 'accepted', 'poster backs too';
  select id into w_id from public.wanted_requests where public_id = open_one;
  insert into private.member_payment_details (user_id, phone_e164, bank_code, account_holder_name, account_number)
  values (hunter::uuid, '+60198765432', 'rhb', 'Hunter Bin Hassan', '5550001111');
  insert into public.claims (id, wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
  values ('30000000-0000-0000-0000-000000000001', w_id, hunter::uuid, '10000000-0000-0000-0000-000000000001', 'a.pdf', 'application/pdf', 10, decode(repeat('aa', 32), 'hex'), 'k/one', now());
  -- Claiming a Wanted with a bounty needs payment details.
  begin
    insert into public.claims (wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
    values (w_id, owner_id::uuid, '10000000-0000-0000-0000-000000000001', 'b.pdf', 'application/pdf', 10, decode(repeat('bb', 32), 'hex'), 'k/none', now());
    raise exception 'claimed without payment details';
  exception when insufficient_privilege then assert sqlerrm = 'payment_details_required', sqlerrm; end;
  -- Created the way claim approval does, with the old "fee inside" figures.
  insert into public.payout_tasks (wanted_request_id, claim_id, hunter_user_id, gross_bounty_sen, fee_rate_basis_points, platform_fee_sen, net_payout_sen)
  values (w_id, '30000000-0000-0000-0000-000000000001', hunter::uuid, 3000, 1000, 300, 2700)
  returning id into payout_id;
  assert (select net_payout_sen = 3000 and platform_fee_sen = 300 and test_money from public.payout_tasks where id = payout_id), 'Hunter gets the whole bounty';

  -- Owner sees full details only for pending tasks, and only as Owner.
  perform set_config('request.jwt.claim.sub', hunter, true);
  perform public.set_own_payment_details('+60198765432', 'rhb', 'Hunter Bin Hassan', '5550001111');
  begin perform * from public.owner_payment_recipients(array[hunter::uuid]); raise exception 'non-owner read bank details';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', owner_id, true);
  assert (select account_number = '5550001111' from public.owner_payment_recipients(array[hunter::uuid, backer::uuid])), 'owner reads payee';
  assert (select count(*) = 1 from public.owner_payment_recipients(array[hunter::uuid, backer::uuid])), 'no pending task, no details';

  perform public.record_owner_payout_completion(payout_id, 'DUITNOW-1', 'bank_transfer');
  assert pg_temp.balanced(), 'ledger balanced after payout';
  assert pg_temp.account('wanted_escrow') = 0 and pg_temp.account('platform_fee_held') = 0
    and pg_temp.account('platform_fee_revenue') = 300 and pg_temp.account('payout_disbursement') = 3000, 'payout moves bounty and fee';
  assert not exists (select 1 from public.owner_payment_recipients(array[hunter::uuid])), 'paid task no longer exposes details';

  -- Late payment to a Wanted that closed meanwhile is refunded in full.
  perform set_config('request.jwt.claim.sub', backer, true);
  perform public.create_backing_intent(open_two, 'mock', 'mock_b3', 1500, 150, now() + interval '30 minutes');
  update public.wanted_requests set status = 'expired' where public_id = open_two;
  begin perform public.create_backing_intent(open_two, 'mock', 'mock_b4', 1000, 100, now() + interval '30 minutes');
    raise exception 'backed an expired Wanted';
  exception when no_data_found then assert sqlerrm = 'wanted_not_open', sqlerrm; end;
  assert pg_temp.pay('mock_b3', 1650) = 'accepted', 'late payment recorded';
  select * into refund from public.refund_tasks t join public.wanted_requests w on w.id = t.wanted_request_id where w.public_id = open_two;
  assert refund.amount_sen = 1500 and refund.fee_sen = 150 and refund.test_money, 'refund carries the fee';
  perform set_config('request.jwt.claim.sub', owner_id, true);
  assert (select account_number = '7000123456' from public.owner_payment_recipients(array[backer::uuid])), 'owner reads refund payee';
  perform public.record_owner_refund_completion(refund.id, 'DUITNOW-2', 'bank_transfer');
  assert pg_temp.balanced(), 'ledger balanced after refund';
  assert pg_temp.account('wanted_escrow') = 0 and pg_temp.account('platform_fee_held') = 0
    and pg_temp.account('refund_disbursement') = 1650, 'refund returns contribution + fee';

  -- A failed or abandoned first contribution hands the draft back.
  awaiting := pg_temp.mk('Lab manual for CHM138 please', 'awaiting_payment');
  insert into public.contribution_intents (wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, fee_sen, expires_at)
  select id, poster::uuid, 'mock', 'mock_d1', 1000, 100, now() + interval '30 minutes' from public.wanted_requests where public_id = awaiting;
  assert pg_temp.pay('mock_d1', 1100, 'failed') = 'rejected', 'failed payment';
  assert (select status = 'draft' and fee_rate_basis_points_snapshot is null from public.wanted_requests where public_id = awaiting), 'back to draft';
  update public.wanted_requests set status = 'awaiting_payment', duration_days_snapshot = 14, fee_rate_basis_points_snapshot = 1000,
    policy_version_snapshot = '2026-09-13', access_basis_snapshot = 'contributors_only' where public_id = awaiting;
  insert into public.contribution_intents (wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, fee_sen, expires_at)
  select id, poster::uuid, 'mock', 'mock_d2', 1000, 100, now() + interval '30 minutes' from public.wanted_requests where public_id = awaiting;
  perform set_config('request.jwt.claim.sub', backer, true);
  begin perform public.cancel_own_payment('mock_d2'); raise exception 'cancelled someone else''s bill';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub', poster, true);
  assert (select purpose = 'publish' from public.my_payment_bill('mock_d2')), 'bill reads as publishing';
  perform public.cancel_own_payment('mock_d2');
  perform public.cancel_own_payment('mock_d2');
  assert (select status = 'draft' from public.wanted_requests where public_id = awaiting), 'cancel hands the draft back';
  -- Paid anyway at the provider after cancelling: recorded, then refunded in full.
  assert pg_temp.pay('mock_d2', 1100) = 'accepted', 'late payment on a cancelled bill is recorded';
  assert (select status = 'draft' from public.wanted_requests where public_id = awaiting), 'still a draft';
  assert (select t.amount_sen = 1000 and t.fee_sen = 100 from public.refund_tasks t
          join public.wanted_requests w on w.id = t.wanted_request_id where w.public_id = awaiting), 'refund queued for it';

  select count(*) into n from public.ledger_entries;
  raise notice 'ALL FEE-ON-TOP PAYMENT ASSERTIONS PASSED (% ledger entries)', n;
end $$;
rollback;
