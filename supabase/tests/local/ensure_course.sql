\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000c1','member@x.test',now()),
 ('00000000-0000-0000-0000-0000000000c2','pending@x.test',now()),
 ('00000000-0000-0000-0000-0000000000c3','restricted@x.test',now()),
 ('00000000-0000-0000-0000-0000000000c4','elsewhere@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000c1','Member'),('00000000-0000-0000-0000-0000000000c2','Pending'),
 ('00000000-0000-0000-0000-0000000000c3','Restricted'),('00000000-0000-0000-0000-0000000000c4','Elsewhere')
 on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.institutions (id, slug, name) values
 ('10000000-0000-0000-0000-0000000000c1','uitm-courses','UiTM'),
 ('10000000-0000-0000-0000-0000000000c2','other-courses','Other');
insert into public.institution_memberships (user_id, institution_id, verification_state, verification_method, verified_at) values
 ('00000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000c3','10000000-0000-0000-0000-0000000000c1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000c4','10000000-0000-0000-0000-0000000000c2','verified','domain',now());
insert into public.institution_memberships (user_id, institution_id, verification_state) values
 ('00000000-0000-0000-0000-0000000000c2','10000000-0000-0000-0000-0000000000c1','pending');
insert into public.account_restrictions (user_id, reason_code, restricted_by) values
 ('00000000-0000-0000-0000-0000000000c3','spam','00000000-0000-0000-0000-0000000000c1');
insert into public.faculties (id, institution_id, slug, name) values
 ('20000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','fskm-c','Fakulti Sains Komputer');
insert into public.programmes (id, institution_id, faculty_id, slug, name) values
 ('30000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','20000000-0000-0000-0000-0000000000c1','cs230-c','CS230'),
 ('30000000-0000-0000-0000-0000000000c2','10000000-0000-0000-0000-0000000000c1','20000000-0000-0000-0000-0000000000c1','cs240-c','CS240');
insert into public.programmes (id, institution_id, faculty_id, slug, name, active) values
 ('30000000-0000-0000-0000-0000000000c3','10000000-0000-0000-0000-0000000000c1','20000000-0000-0000-0000-0000000000c1','old-c','Old',false);
insert into public.campuses (id, institution_id, slug, name, region_open) values
 ('50000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','kt-c','UiTM Kuala Terengganu',true);
insert into public.resource_types (id, slug, name) values ('60000000-0000-0000-0000-0000000000c1','notes-c','Notes');
insert into public.languages (id, slug, name) values ('70000000-0000-0000-0000-0000000000c1','ms-c','Malay');
insert into public.courses (id, institution_id, programme_id, slug, code, name, active) values
 ('40000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','30000000-0000-0000-0000-0000000000c1','csc510-c','CSC510','Database Systems',true),
 ('40000000-0000-0000-0000-0000000000c2','10000000-0000-0000-0000-0000000000c1','30000000-0000-0000-0000-0000000000c1','old999-c','OLD999','Withdrawn',false);
do $$
declare
  first_id uuid;
  again_id uuid;
begin
  assert not has_function_privilege('anon', 'public.ensure_course(uuid, text)', 'execute'), 'anon may call';
  assert has_function_privilege('authenticated', 'public.ensure_course(uuid, text)', 'execute'), 'authenticated may not call';

  -- signed out, pending, restricted and another institution's member are refused
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC231'); raise exception 'signed out filed'; exception when insufficient_privilege then assert sqlerrm = 'wanted_actor_not_eligible'; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC231'); raise exception 'pending filed'; exception when insufficient_privilege then assert sqlerrm = 'wanted_actor_not_eligible'; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC231'); raise exception 'restricted filed'; exception when insufficient_privilege then assert sqlerrm = 'wanted_actor_not_eligible'; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC231'); raise exception 'outsider filed'; exception when insufficient_privilege then assert sqlerrm = 'wanted_actor_not_eligible'; end;
  assert not exists (select 1 from public.courses where code = 'ELC231'), 'refused caller filed a course';

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
  -- capitals and digits only, starting with a letter, 3 to 12 long; never converted
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'elc231'); raise exception 'lower case'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC 231'); raise exception 'space'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', '231ELC'); raise exception 'digit first'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'EL'); raise exception 'too short'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ABCDEFGHIJKLM'); raise exception 'too long'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', null); raise exception 'null'; exception when invalid_parameter_value then assert sqlerrm = 'course_code_invalid'; end;
  -- an inactive or unknown programme is refused
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c3', 'ELC231'); raise exception 'inactive programme'; exception when invalid_parameter_value then assert sqlerrm = 'wanted_taxonomy_invalid'; end;
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000ff', 'ELC231'); raise exception 'unknown programme'; exception when invalid_parameter_value then assert sqlerrm = 'wanted_taxonomy_invalid'; end;

  -- a new code is filed once, under the programme it was first posted from, named by its code
  first_id := public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'ELC231');
  assert (select programme_id = '30000000-0000-0000-0000-0000000000c1' and name = 'ELC231' and active
          from public.courses where id = first_id), 'new course filing';
  -- the same code from another programme reuses it
  again_id := public.ensure_course('30000000-0000-0000-0000-0000000000c2', 'ELC231');
  assert again_id = first_id, 'second course for one code';
  assert (select count(*) from public.courses where code = 'ELC231') = 1, 'duplicate code rows';
  -- an existing listed course is reused, whichever programme it is under
  assert public.ensure_course('30000000-0000-0000-0000-0000000000c2', 'CSC510') = '40000000-0000-0000-0000-0000000000c1', 'listed course not reused';
  -- a withdrawn course is not revived
  begin perform public.ensure_course('30000000-0000-0000-0000-0000000000c1', 'OLD999'); raise exception 'withdrawn revived'; exception when invalid_parameter_value then assert sqlerrm = 'course_inactive'; end;
  assert not (select active from public.courses where code = 'OLD999'), 'withdrawn reactivated';

  -- a course filed under another programme now passes the draft hierarchy check
  assert private.wanted_taxonomy_is_valid(
    '10000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1',
    '20000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c2',
    '40000000-0000-0000-0000-0000000000c1', null, '60000000-0000-0000-0000-0000000000c1',
    '70000000-0000-0000-0000-0000000000c1', '{}'
  ), 'course under another programme refused';
  -- but a withdrawn course, and another institution's programme, still fail
  assert not private.wanted_taxonomy_is_valid(
    '10000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1',
    '20000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c2',
    '40000000-0000-0000-0000-0000000000c2', null, '60000000-0000-0000-0000-0000000000c1',
    '70000000-0000-0000-0000-0000000000c1', '{}'
  ), 'withdrawn course accepted';
  assert not private.wanted_taxonomy_is_valid(
    '10000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c1',
    '20000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000c2',
    '40000000-0000-0000-0000-0000000000c1', null, '60000000-0000-0000-0000-0000000000c1',
    '70000000-0000-0000-0000-0000000000c1', '{}'
  ), 'cross-institution accepted';
  raise notice 'ALL ENSURE COURSE ASSERTIONS PASSED';
end $$;
rollback;
