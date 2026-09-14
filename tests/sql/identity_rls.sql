begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'institution_memberships', 'institution memberships table exists');
select has_table('public', 'institution_verification_requests', 'institution verification requests table exists');
select has_table('public', 'platform_role_assignments', 'platform role assignments table exists');
select has_table('public', 'institution_role_assignments', 'institution role assignments table exists');
select has_table('public', 'account_restrictions', 'account restrictions table exists');

select results_eq(
  $$
    select count(*)::integer
    from pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.institution_memberships'::regclass,
      'public.institution_verification_requests'::regclass,
      'public.platform_role_assignments'::regclass,
      'public.institution_role_assignments'::regclass,
      'public.account_restrictions'::regclass
    ) and relrowsecurity
  $$,
  array[6],
  'RLS is enabled on every identity table'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'email-only@example.test', '', now(), '{}', '{"display_name":"Email Only"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-a@example.test', '', now(), '{}', '{"display_name":"Student A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sheriff-a@example.test', '', now(), '{}', '{"display_name":"Sheriff A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-b@example.test', '', now(), '{}', '{"display_name":"Student B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform-sheriff@example.test', '', now(), '{}', '{"display_name":"Platform Sheriff"}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unconfirmed@example.test', '', null, '{}', '{"display_name":"Unconfirmed"}', now(), now());

insert into public.institutions (id, slug, name)
values
  ('10000000-0000-0000-0000-000000000001', 'institution-a', 'Institution A'),
  ('10000000-0000-0000-0000-000000000002', 'institution-b', 'Institution B');

insert into public.institution_memberships (
  user_id, institution_id, verification_state, verification_method, verified_at
)
values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'verified', 'manual', now()),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'verified', 'domain', now()),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'verified', 'domain', now());

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

insert into public.account_restrictions (id, user_id, reason_code, restricted_by)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'test_restriction',
  '00000000-0000-0000-0000-000000000005'
);

insert into storage.objects (id, bucket_id, name, owner)
values
  (
    '40000000-0000-0000-0000-000000000001',
    'identity-evidence',
    '00000000-0000-0000-0000-000000000002/document.pdf',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'identity-evidence',
    '00000000-0000-0000-0000-000000000004/document.pdf',
    '00000000-0000-0000-0000-000000000004'
  );

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is((select count(*) from public.profiles), 0::bigint, 'anonymous users cannot read profiles');
select is((select count(*) from public.institutions), 0::bigint, 'anonymous users cannot browse institution metadata');
select is((select count(*) from storage.objects), 0::bigint, 'anonymous users cannot read private verification evidence');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);

select is((select count(*) from public.institutions), 0::bigint, 'email-unverified users cannot browse institution metadata');
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'identity-evidence',
      '00000000-0000-0000-0000-000000000007/document.pdf',
      '00000000-0000-0000-0000-000000000007'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'email-unverified users cannot upload verification evidence'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select display_name from public.profiles $$,
  $$ values ('Email Only'::text) $$,
  'email-verified users can read only their own profile'
);
select is(
  (
    select count(*)
    from public.institutions
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )
  ),
  2::bigint,
  'email-verified users can browse the institution fixtures'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'identity-evidence',
      '00000000-0000-0000-0000-000000000001/document.pdf',
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'email-verified users can upload evidence only to their private prefix'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values (
      'identity-evidence',
      '00000000-0000-0000-0000-000000000004/spoof.pdf',
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'email-verified users cannot upload evidence under another account prefix'
);
select is((select count(*) from storage.objects), 1::bigint, 'users can read only their own evidence');
select lives_ok(
  $$
    insert into public.institution_verification_requests (
      user_id, institution_id, evidence_object_path, evidence_delete_after
    ) values (
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001/document.pdf',
      now() + interval '30 days'
    )
  $$,
  'email-verified users can submit their own verification request'
);
select throws_ok(
  $$
    insert into public.institution_verification_requests (
      user_id, institution_id, evidence_object_path, evidence_delete_after
    ) values (
      '00000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000004/document.pdf',
      now() + interval '30 days'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "institution_verification_requests"',
  'email-verified users cannot submit requests for another account'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$ select verification_state::text from public.institution_memberships $$,
  $$ values ('verified'::text) $$,
  'institution-verified users can read their own membership'
);
select is((select count(*) from public.account_restrictions), 1::bigint, 'restricted users can read their own restriction state');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select results_eq(
  $$ select distinct institution_id from public.institution_memberships $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'Institution Sheriff reads memberships only for the assigned institution'
);
select results_eq(
  $$ select distinct institution_id from public.institution_verification_requests $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'Institution Sheriff reads requests only for the assigned institution'
);
select is((select count(*) from storage.objects), 2::bigint, 'Institution Sheriff reads evidence only for the assigned institution');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

select is(
  (
    select count(*)
    from public.institution_memberships
    where user_id in (
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004'
    )
  ),
  3::bigint,
  'Platform Sheriff reads the membership fixtures across institutions'
);
select is((select count(*) from public.institution_verification_requests), 3::bigint, 'Platform Sheriff reads verification requests across institutions');
select is((select count(*) from storage.objects), 3::bigint, 'Platform Sheriff reads verification evidence across institutions');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);

select is(
  (
    select count(*)
    from public.profiles
    where user_id in (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000006',
      '00000000-0000-0000-0000-000000000007'
    )
  ),
  7::bigint,
  'Owner reads every profile fixture'
);
select is((select count(*) from public.account_restrictions), 1::bigint, 'Owner reads every account restriction');
select is((select count(*) from storage.objects), 3::bigint, 'Owner reads every verification evidence object');

select * from finish();

rollback;
