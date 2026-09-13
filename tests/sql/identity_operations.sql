begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'institution_email_domains', 'institution email allowlist exists');
select has_table('public', 'identity_audit_events', 'identity audit event table exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@uitm.example', '', now(), now(), '{}', '{"display_name":"Student"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manual-a@example.test', '', now(), now(), '{}', '{"display_name":"Manual A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sheriff-a@example.test', '', now(), now(), '{}', '{"display_name":"Sheriff A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manual-b@example.test', '', now(), now(), '{}', '{"display_name":"Manual B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform@example.test', '', now(), now() - interval '1 hour', '{}', '{"display_name":"Platform Sheriff"}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now(), '{}', '{"display_name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), now(), '{}', '{"display_name":"Outsider"}', now(), now());

insert into public.institutions (id, slug, name)
values
  ('10000000-0000-0000-0000-000000000001', 'institution-a', 'Institution A'),
  ('10000000-0000-0000-0000-000000000002', 'institution-b', 'Institution B');

insert into public.institution_email_domains (domain, institution_id)
values ('uitm.example', '10000000-0000-0000-0000-000000000001');

insert into public.institution_memberships (
  user_id, institution_id, verification_state, verification_method, verified_at
)
values (
  '00000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'verified',
  'manual',
  now()
);

insert into public.institution_role_assignments (user_id, institution_id, role)
values (
  '00000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'institution_sheriff'
);

insert into public.platform_role_assignments (user_id, role)
values
  ('00000000-0000-0000-0000-000000000005', 'platform_sheriff'),
  ('00000000-0000-0000-0000-000000000006', 'owner');

insert into public.institution_verification_requests (
  id, user_id, institution_id, evidence_object_path, evidence_delete_after
)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002/document.pdf', now() + interval '30 days'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004/document.pdf', now() + interval '30 days');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select public.verify_own_institution_by_domain() $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'approved email domain verifies the caller institution'
);
select results_eq(
  $$
    select verification_state::text, verification_method::text
    from public.institution_memberships
  $$,
  $$ values ('verified'::text, 'domain'::text) $$,
  'domain verification persists independently from email verification'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select throws_ok(
  $$ select public.verify_own_institution_by_domain() $$,
  'P0001',
  'EMAIL_DOMAIN_NOT_APPROVED',
  'unapproved email domain cannot auto-verify an institution'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$
    select public.review_institution_verification_request(
      '20000000-0000-0000-0000-000000000001',
      'approved',
      'evidence_confirmed'
    )
  $$,
  $$ values ('updated'::text) $$,
  'Institution Sheriff can approve a request in the assigned institution'
);
select throws_ok(
  $$
    select public.review_institution_verification_request(
      '20000000-0000-0000-0000-000000000002',
      'rejected',
      'evidence_unclear'
    )
  $$,
  '42501',
  'NOT_AUTHORIZED',
  'Institution Sheriff cannot review another institution request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$
    select public.review_institution_verification_request(
      '20000000-0000-0000-0000-000000000002',
      'rejected',
      'evidence_unclear'
    )
  $$,
  '42501',
  'RECENT_AUTH_REQUIRED',
  'stale Platform Sheriff authentication cannot decide a request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);
select results_eq(
  $$
    select public.review_institution_verification_request(
      '20000000-0000-0000-0000-000000000002',
      'rejected',
      'evidence_unclear'
    )
  $$,
  $$ values ('updated'::text) $$,
  'recently authenticated Owner can decide any institution request'
);
select results_eq(
  $$
    select state::text
    from public.institution_verification_requests
    where id = '20000000-0000-0000-0000-000000000002'
  $$,
  $$ values ('rejected'::text) $$,
  'manual review persists its final state'
);
select ok(
  (
    select evidence_delete_after >= reviewed_at + interval '30 days'
    from public.institution_verification_requests
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  'manual decision extends evidence retention to 30 days after review'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
reset role;
update auth.users
set last_sign_in_at = now()
where id = '00000000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

select ok(
  public.restrict_account(
    '00000000-0000-0000-0000-000000000001',
    'high_risk_report'
  ) is not null,
  'recent Platform Sheriff can restrict an account'
);
select is(
  (
    select count(*)
    from public.account_restrictions
    where user_id = '00000000-0000-0000-0000-000000000001'
      and lifted_at is null
  ),
  1::bigint,
  'restriction operation creates one active restriction'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$
    select public.restrict_account(
      '00000000-0000-0000-0000-000000000007',
      'high_risk_report'
    )
  $$,
  '42501',
  'NOT_AUTHORIZED',
  'Institution Sheriff cannot issue a platform account restriction'
);

reset role;
select is((select count(*) from public.identity_audit_events), 4::bigint, 'identity operations append audit events');

select * from finish();

rollback;
