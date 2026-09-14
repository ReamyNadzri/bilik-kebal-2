begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'applicant@example.test', '', now(), now(), '{}', '{"display_name":"Applicant"}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sheriff@example.test', '', now(), now(), '{}', '{"display_name":"Sheriff"}', now(), now()),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), now(), '{}', '{"display_name":"Outsider"}', now(), now()),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'expired@example.test', '', now(), now(), '{}', '{"display_name":"Expired Applicant"}', now(), now());

insert into public.institutions (id, slug, name)
values ('31000000-0000-0000-0000-000000000001', 'evidence-test', 'Evidence Test');

insert into public.institution_role_assignments (user_id, institution_id, role)
values ('30000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', 'institution_sheriff');

insert into public.institution_verification_requests (
  id, user_id, institution_id, evidence_object_path, evidence_delete_after, created_at, updated_at
)
values
  ('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001/document.pdf', now() + interval '30 days', now(), now()),
  ('32000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004/expired.pdf', now() - interval '1 minute', now() - interval '31 days', now() - interval '31 days');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$ select public.authorise_identity_evidence_read('32000000-0000-0000-0000-000000000001') $$,
  $$ values ('30000000-0000-0000-0000-000000000001/document.pdf'::text) $$,
  'institution Sheriff receives the server-resolved evidence path'
);

select results_eq(
  $$ select display_name from public.profiles where user_id = '30000000-0000-0000-0000-000000000001' $$,
  $$ values ('Applicant'::text) $$,
  'institution Sheriff can read the pending applicant display name for its queue'
);

reset role;
select is((select count(*) from public.identity_audit_events where event_type = 'institution_verification.evidence_viewed'), 1::bigint, 'evidence access is audited');
set local role authenticated;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.authorise_identity_evidence_read('32000000-0000-0000-0000-000000000001') $$,
  '42501', 'NOT_AUTHORIZED', 'ordinary users cannot read another account evidence'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$ select public.authorise_identity_evidence_read('32000000-0000-0000-0000-000000000002') $$,
  'P0001', 'EVIDENCE_EXPIRED', 'expired evidence cannot receive a signed URL'
);

select throws_ok(
  $$ select public.authorise_identity_evidence_read('32000000-0000-0000-0000-000000000099') $$,
  'P0002', 'REQUEST_NOT_FOUND', 'missing requests do not disclose an object path'
);

select * from finish();
rollback;
