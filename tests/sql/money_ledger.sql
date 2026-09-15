begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

select has_table('public', 'contribution_intents', 'contribution intents exist');
select has_table('public', 'provider_events', 'provider events exist');
select has_table('public', 'contributions', 'successful contributions exist');
select has_table('public', 'ledger_transactions', 'ledger transactions exist');
select has_table('public', 'ledger_entries', 'ledger entries exist');
select has_table('public', 'money_outbox', 'money outbox exists');
select has_function('public', 'create_contribution_intent', 'trusted contribution intent function exists');
select has_function('public', 'record_verified_contribution', 'provider callback function exists');
select has_function('public', 'list_unresolved_provider_events', 'reconciliation projection exists');
select results_eq(
  $$ select count(*)::integer from pg_class where oid in (
    'public.contribution_intents'::regclass,
    'public.provider_events'::regclass,
    'public.contributions'::regclass,
    'public.ledger_transactions'::regclass,
    'public.ledger_entries'::regclass,
    'public.money_outbox'::regclass
  ) and relrowsecurity $$,
  array[6],
  'all money tables have RLS enabled'
);

set local role anon;
select throws_ok($$ select count(*) from public.ledger_entries $$, '42501', 'permission denied for table ledger_entries', 'anonymous cannot read ledger internals');
select throws_ok($$ select public.record_verified_contribution('toyyibpay', 'txn', 'bill', 100, 'successful', repeat('0', 64)) $$, '42501', null, 'anonymous cannot invoke trusted callback recording');
reset role;

select has_trigger('public', 'ledger_entries', 'ledger_entries_immutable', 'ledger entries are append-only');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '81000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'money@example.test', '', now(), '{}',
  '{"display_name":"Money Tester"}', now(), now()
);
insert into public.institutions (id, slug, name)
values ('82000000-0000-0000-0000-000000000001', 'money-test', 'Money Test Institution');
insert into public.institution_memberships (
  user_id, institution_id, verification_state, verification_method, verified_at
)
values (
  '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001',
  'verified', 'manual', now()
);
insert into public.campuses (id, institution_id, slug, name)
values ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'main', 'Main');
insert into public.faculties (id, institution_id, slug, name)
values ('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', 'computing', 'Computing');
insert into public.programmes (id, institution_id, faculty_id, slug, name)
values ('83000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000002', 'cs', 'Computer Science');
insert into public.courses (id, institution_id, programme_id, slug, code, name)
values ('83000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000003', 'money', 'MNY101', 'Money Systems');
insert into public.academic_sessions (id, institution_id, slug, name)
values ('83000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000001', '2026-s1', '2026 S1');
insert into public.resource_types (id, slug, name)
values ('83000000-0000-0000-0000-000000000006', 'money-notes', 'Money notes');
insert into public.languages (id, slug, name)
values ('83000000-0000-0000-0000-000000000007', 'money-english', 'Money English');
insert into public.wanted_requests (
  id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id,
  course_id, academic_session_id, resource_type_id, language_id, title, description,
  requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot,
  policy_version_snapshot, access_basis_snapshot, policy_accepted_at
)
values (
  '84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003',
  '83000000-0000-0000-0000-000000000004', '83000000-0000-0000-0000-000000000005',
  '83000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000007',
  'Complete money systems notes', 'Complete notes for the money systems course.',
  7, 'awaiting_payment', 7, 1000, '2026-09-15.1', 'contributors_only', now()
);

insert into public.wanted_requests (
  id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id,
  course_id, academic_session_id, resource_type_id, language_id, title, description,
  requested_duration_days, policy_accepted_at
)
values (
  '84000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003',
  '83000000-0000-0000-0000-000000000004', '83000000-0000-0000-0000-000000000005',
  '83000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000007',
  'Second money systems notes', 'A second complete set of notes for testing bill creation.', 14, now()
);
insert into public.wanted_duplicate_checks (
  id, wanted_request_id, token_hash, criteria_hash, expires_at, draft_updated_at
)
select
  '86000000-0000-0000-0000-000000000001', id, decode(repeat('2', 64), 'hex'),
  decode(repeat('3', 64), 'hex'), now() + interval '15 minutes', updated_at
from public.wanted_requests where id = '84000000-0000-0000-0000-000000000002';

select is(
  public.record_verified_contribution(
    'toyyibpay', 'money-txn-late', 'money-bill-late', 1000, 'successful', repeat('4', 64)
  ),
  'unknown',
  'a callback that races ahead of its bill intent is reported as unresolved'
);
select is(
  (
    select count(*)::integer from public.provider_events
    where provider_transaction_id = 'money-txn-late' and processed_at is null
  ),
  1,
  'an unresolved reordered callback is retained for reconciliation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
select isnt(
  public.create_contribution_intent(
    '84000000-0000-0000-0000-000000000002', repeat('2', 64), 'toyyibpay',
    'money-bill-late', 1000, now() + interval '30 minutes'
  )::text,
  null,
  'an eligible Commissioner can atomically create a contribution intent'
);
reset role;
select is(
  (select status::text from public.wanted_requests where id = '84000000-0000-0000-0000-000000000002'),
  'awaiting_payment',
  'creating an intent freezes the Wanted publication snapshots'
);
select ok(
  (select consumed_at is not null from public.wanted_duplicate_checks where id = '86000000-0000-0000-0000-000000000001'),
  'creating an intent consumes the one-use duplicate-check token'
);
select is(
  public.record_verified_contribution(
    'toyyibpay', 'money-txn-late', 'money-bill-late', 1000, 'successful', repeat('4', 64)
  ),
  'accepted',
  'retrying the retained callback after bill creation resolves it exactly once'
);
select is(
  (select status::text from public.wanted_requests where id = '84000000-0000-0000-0000-000000000002'),
  'open',
  'a resolved reordered callback activates its Wanted'
);
insert into public.contribution_intents (
  id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, expires_at
)
values (
  '85000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001', 'toyyibpay', 'money-bill-1', 1250, now() + interval '30 minutes'
);

select is(
  public.record_verified_contribution('toyyibpay', 'money-txn-pending', 'money-bill-1', 1250, 'pending', repeat('0', 64)),
  'rejected',
  'pending provider events are acknowledged without crediting money'
);
select is(
  (select status::text from public.contribution_intents where id = '85000000-0000-0000-0000-000000000001'),
  'pending',
  'a pending provider event does not fail the contribution intent'
);
select is(
  public.record_verified_contribution('toyyibpay', 'money-txn-success', 'money-bill-1', 1250, 'successful', repeat('1', 64)),
  'accepted',
  'a verified successful provider event credits the contribution exactly once'
);
select results_eq(
  $$
    select coalesce(sum(debit_sen), 0)::integer, coalesce(sum(credit_sen), 0)::integer
    from public.ledger_entries
    where transaction_id in (
      select id from public.ledger_transactions
      where contribution_id in (
        select id from public.contributions
        where contribution_intent_id = '85000000-0000-0000-0000-000000000001'
      )
    )
  $$,
  $$ values (1250, 1250) $$,
  'the accepted contribution creates a balanced double-entry transaction'
);
select is(
  public.record_verified_contribution('toyyibpay', 'money-txn-success', 'money-bill-1', 1250, 'successful', repeat('1', 64)),
  'duplicate',
  'replaying the same provider transaction is idempotently acknowledged'
);

select * from finish();
rollback;
