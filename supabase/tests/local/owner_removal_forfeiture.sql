\set ON_ERROR_STOP 1
-- Migrations 202610190004 and 202610190005: reporting a Wanted, and the Owner's
-- removal where the breacher (the poster) forfeits and every other Backer is refunded.
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
  w_public uuid; w_id uuid; res jsonb;
  poster constant text := '00000000-0000-0000-0000-00000000000a';
  backer constant text := '00000000-0000-0000-0000-00000000000b';
  hunter constant text := '00000000-0000-0000-0000-00000000000c';
  owner_id constant text := '00000000-0000-0000-0000-00000000000d';
begin
  w_public := pg_temp.mk('Notes the poster had no right to share', 'open');
  select id into w_id from public.wanted_requests where public_id = w_public;
  insert into public.institution_memberships (user_id, institution_id, verification_state)
  select u::uuid, '10000000-0000-0000-0000-000000000001', 'verified'
  from unnest(array[poster, backer, hunter]) u
  on conflict do nothing;

  -- The poster puts RM 20 in, a Backer RM 10 (each with the 10% fee on top).
  perform set_config('request.jwt.claim.sub', poster, true);
  perform public.set_own_payment_details('+601112345678', 'public_bank', 'Poster Binti Abu', '4000111122');
  perform public.create_backing_intent(w_public, 'mock', 'mock_fp', 2000, 200, now() + interval '30 minutes');
  assert pg_temp.pay('mock_fp', 2200) = 'accepted', 'poster backs';
  perform set_config('request.jwt.claim.sub', backer, true);
  perform public.set_own_payment_details('+60123456789', 'cimb', 'Backer Bin Ali', '7000123456');
  perform public.create_backing_intent(w_public, 'mock', 'mock_fb', 1000, 100, now() + interval '30 minutes');
  assert pg_temp.pay('mock_fb', 1100) = 'accepted', 'backer backs';
  assert (select count(*) = 2 from public.wanted_public_events
          where wanted_request_id = w_id and event_type in ('wanted_posted_bounty', 'wanted_backed')),
    'both backings are in the activity';

  -- Reports: once per member, never by the poster, read only by reviewers.
  perform set_config('request.jwt.claim.sub', hunter, true);
  assert public.report_wanted(w_public, 'copyright', 'Copied from a paid textbook') = 'reported', 'reported';
  assert public.report_wanted(w_public, 'spam') = 'already_reported', 'once per member';
  begin perform public.list_wanted_reports(); raise exception 'member read the queue';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', poster, true);
  begin perform public.report_wanted(w_public, 'spam'); raise exception 'poster reported own Wanted';
  exception when insufficient_privilege then null; end;

  -- Only the Owner removes, and only with a reason.
  begin perform public.owner_remove_wanted(w_public, 'Broke the terms of use'); raise exception 'member removed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', owner_id, true);
  assert (select count(*) = 1 from public.list_wanted_reports()), 'owner sees the report';
  begin perform public.owner_remove_wanted(w_public, 'bad'); raise exception 'short reason accepted';
  exception when invalid_parameter_value then null; end;

  res := public.owner_remove_wanted(w_public, 'Shared a paid textbook it had no right to share');
  assert (res ->> 'refunds')::int = 1 and (res ->> 'forfeitedSen')::int = 2200, res::text;
  assert (select status = 'withdrawn' and removal_reason is not null from public.wanted_requests where id = w_id), 'removed';
  assert (select count(*) = 1 and sum(amount_sen + fee_sen) = 1100 from public.refund_tasks
          where wanted_request_id = w_id and contributor_user_id = backer::uuid), 'backer refunded in full';
  assert not exists (select 1 from public.refund_tasks
          where wanted_request_id = w_id and contributor_user_id = poster::uuid), 'poster not refunded';
  assert pg_temp.balanced(), 'ledger balanced after forfeiture';
  assert pg_temp.account('platform_forfeit') = 2200, 'poster money is forfeit revenue';
  assert pg_temp.account('wanted_escrow') = 1000 and pg_temp.account('platform_fee_held') = 100,
    'only the backer''s money waits in escrow for the refund';
  assert (select status = 'actioned' from public.wanted_reports where wanted_request_id = w_id), 'report actioned';
  begin perform public.owner_remove_wanted(w_public, 'Shared a paid textbook again'); raise exception 'removed twice';
  exception when no_data_found then null; end;
end $$;
rollback;
