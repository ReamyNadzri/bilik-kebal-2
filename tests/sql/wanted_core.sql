begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_table('public', 'campuses', 'campus taxonomy exists');
select has_table('public', 'faculties', 'faculty taxonomy exists');
select has_table('public', 'programmes', 'programme taxonomy exists');
select has_table('public', 'courses', 'course taxonomy exists');
select has_table('public', 'academic_sessions', 'academic session taxonomy exists');
select has_table('public', 'resource_types', 'resource type taxonomy exists');
select has_table('public', 'languages', 'language taxonomy exists');
select has_table('public', 'tags', 'tag taxonomy exists');
select has_table('public', 'wanted_requests', 'Wanted requests exist');
select has_table('public', 'wanted_duplicate_checks', 'duplicate-check records exist');

select results_eq(
  $$
    select count(*)::integer
    from pg_class
    where oid in (
      'public.campuses'::regclass,
      'public.faculties'::regclass,
      'public.programmes'::regclass,
      'public.courses'::regclass,
      'public.academic_sessions'::regclass,
      'public.resource_types'::regclass,
      'public.languages'::regclass,
      'public.tags'::regclass,
      'public.wanted_requests'::regclass,
      'public.wanted_request_tags'::regclass,
      'public.wanted_duplicate_checks'::regclass,
      'public.wanted_public_events'::regclass
    ) and relrowsecurity
  $$,
  array[12],
  'RLS is enabled on every Wanted-core table'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'browser@example.test', '', now(), '{}', '{"display_name":"Browser"}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verified@example.test', '', now(), '{}', '{"display_name":"Verified"}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), '{}', '{"display_name":"Other"}', now(), now()),
  ('71000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unconfirmed@example.test', '', null, '{}', '{"display_name":"Unconfirmed"}', now(), now()),
  ('71000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'restricted@example.test', '', now(), '{}', '{"display_name":"Restricted"}', now(), now()),
  ('71000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-wanted@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now());

insert into public.institutions (id, slug, name)
values
  ('72000000-0000-0000-0000-000000000001', 'wanted-a', 'Wanted Institution A'),
  ('72000000-0000-0000-0000-000000000002', 'wanted-b', 'Wanted Institution B');

insert into public.institution_memberships (
  user_id, institution_id, verification_state, verification_method, verified_at
)
values
  ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'verified', 'manual', now()),
  ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', 'verified', 'manual', now()),
  ('71000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001', 'verified', 'manual', now());

insert into public.platform_role_assignments (user_id, role)
values ('71000000-0000-0000-0000-000000000006', 'owner');

insert into public.account_restrictions (user_id, reason_code, restricted_by)
values ('71000000-0000-0000-0000-000000000005', 'test_restriction', '71000000-0000-0000-0000-000000000006');

insert into public.campuses (id, institution_id, slug, name)
values ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'main', 'Main Campus');
insert into public.faculties (id, institution_id, slug, name)
values ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'computing', 'Computing');
insert into public.programmes (id, institution_id, faculty_id, slug, name)
values ('73000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'computer-science', 'Computer Science');
insert into public.courses (id, institution_id, programme_id, slug, code, name)
values ('73000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'database-systems', 'CSC510', 'Database Systems');
insert into public.academic_sessions (id, institution_id, slug, name)
values ('73000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001', '2026-s1', 'Semester 1, 2026');
insert into public.resource_types (id, slug, name)
values ('73000000-0000-0000-0000-000000000006', 'lecture-notes', 'Lecture notes');
insert into public.languages (id, slug, name)
values ('73000000-0000-0000-0000-000000000007', 'english', 'English');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$ select count(*) from public.campuses $$,
  '42501',
  'permission denied for table campuses',
  'anonymous users have no taxonomy table privilege'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.campuses), 0::bigint, 'email-unverified users cannot browse taxonomy');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.campuses), 1::bigint, 'email-verified users can browse active taxonomy');
select throws_ok(
  $$
    insert into public.wanted_requests (
      commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id,
      academic_session_id, resource_type_id, language_id, title, description,
      requested_duration_days, policy_accepted_at
    ) values (
      '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000005', '73000000-0000-0000-0000-000000000006',
      '73000000-0000-0000-0000-000000000007', 'Complete database notes',
      'Notes covering the complete database course.', 7, now()
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "wanted_requests"',
  'email-only users cannot create drafts'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$
    insert into public.wanted_requests (
      id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id,
      academic_session_id, resource_type_id, language_id, title, description,
      requested_duration_days, policy_accepted_at
    ) values (
      '74000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002',
      '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003',
      '73000000-0000-0000-0000-000000000004', '73000000-0000-0000-0000-000000000005',
      '73000000-0000-0000-0000-000000000006', '73000000-0000-0000-0000-000000000007',
      'Complete database notes', 'Notes covering the complete database course.', 7, now()
    )
  $$,
  'institution-verified users can create their own draft'
);
select is((select count(*) from public.wanted_requests), 1::bigint, 'a Commissioner reads their own draft');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.wanted_requests), 0::bigint, 'another verified user cannot read a private draft');
select throws_ok(
  $$ update public.wanted_requests set title = 'Spoofed title text' where id = '74000000-0000-0000-0000-000000000001' $$,
  '42501',
  'permission denied for table wanted_requests',
  'browser roles cannot directly update lifecycle records'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$
    insert into public.wanted_requests (
      commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id,
      academic_session_id, resource_type_id, language_id, title, description,
      requested_duration_days, policy_accepted_at
    ) values (
      '71000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000005', '73000000-0000-0000-0000-000000000006',
      '73000000-0000-0000-0000-000000000007', 'Restricted database notes',
      'Notes covering the complete database course.', 7, now()
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "wanted_requests"',
  'restricted institution members cannot create drafts'
);

reset role;
select throws_ok(
  $$
    insert into public.wanted_requests (
      commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id,
      academic_session_id, resource_type_id, language_id, title, description,
      requested_duration_days, policy_accepted_at
    ) values (
      '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000005', '73000000-0000-0000-0000-000000000006',
      '73000000-0000-0000-0000-000000000007', 'Invalid duration notes',
      'Notes covering the complete database course.', 10, now()
    )
  $$,
  '23514',
  null,
  'database rejects unsupported duration snapshots'
);

select throws_ok(
  $$ update public.wanted_requests set status = 'awaiting_payment' where id = '74000000-0000-0000-0000-000000000001' $$,
  '23514',
  null,
  'database rejects publication state without complete snapshots'
);

select * from finish();

rollback;
