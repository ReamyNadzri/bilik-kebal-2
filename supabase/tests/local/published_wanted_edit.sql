\set ON_ERROR_STOP 1
-- Migration 202610200004: the poster corrects a published Wanted's details in its first hour,
-- under the same locks as before; the university, bounty, duration and snapshots never change.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','poster@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','other@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Other') on conflict do nothing;
insert into public.institutions (id, slug, name) values
 ('10000000-0000-0000-0000-0000000000e1','edit-uni-a','Edit University A'),
 ('10000000-0000-0000-0000-0000000000e2','edit-uni-b','Edit University B');
insert into public.campuses (id, institution_id, slug, name, region_open) values
 ('20000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000e1','a-main','A Main',true),
 ('20000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000e1','a-east','A East',true),
 ('20000000-0000-0000-0000-0000000000a3','10000000-0000-0000-0000-0000000000e1','a-closed','A Closed',false),
 ('20000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-0000000000e2','b-main','B Main',true);
insert into public.faculties (id, institution_id, slug, name) values
 ('30000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000e1','a-science','A Science');
insert into public.programmes (id, institution_id, faculty_id, slug, name) values
 ('40000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000e1','30000000-0000-0000-0000-0000000000a1','a-cs','A CS');
insert into public.courses (id, institution_id, programme_id, slug, code, name, active) values
 ('50000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000e1','40000000-0000-0000-0000-0000000000a1','a-mat183','MAT183','MAT183',true),
 ('50000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000e1','40000000-0000-0000-0000-0000000000a1','a-csc510','CSC510','CSC510',true),
 ('50000000-0000-0000-0000-0000000000a3','10000000-0000-0000-0000-0000000000e1','40000000-0000-0000-0000-0000000000a1','a-old100','OLD100','OLD100',false);
insert into public.resource_types (id, slug, name) values ('60000000-0000-0000-0000-0000000000a1','edit-test-notes','Edit Test Notes');
insert into public.languages (id, slug, name) values ('70000000-0000-0000-0000-0000000000a1','edit-test-english','Edit Test English');
insert into public.tags (id, slug, name, active) values
 ('80000000-0000-0000-0000-0000000000a1','edit-test-one','Edit Test One',true),
 ('80000000-0000-0000-0000-0000000000a2','edit-test-two','Edit Test Two',true),
 ('80000000-0000-0000-0000-0000000000a3','edit-test-off','Edit Test Off',false);
-- Claiming a Wanted with a bounty needs payment details (migration 202610180001).
insert into private.member_payment_details (user_id, phone_e164, bank_code, account_holder_name, account_number)
values ('00000000-0000-0000-0000-00000000000b', '+60123456789', 'maybank', 'Other Test', '1234567890');

create function pg_temp.mk(p_title text, p_kind public.wanted_kind, p_published timestamptz) returns uuid language sql as $$
  insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
    faculty_id, programme_id, course_id, resource_type_id, language_id,
    requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
    access_basis_snapshot, policy_accepted_at, published_at, closes_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-0000000000e1','20000000-0000-0000-0000-0000000000a1',
    p_kind, false, p_title, 'A description that is long enough.',
    case when p_kind = 'academic' then '30000000-0000-0000-0000-0000000000a1'::uuid end,
    case when p_kind = 'academic' then '40000000-0000-0000-0000-0000000000a1'::uuid end,
    case when p_kind = 'academic' then '50000000-0000-0000-0000-0000000000a1'::uuid end,
    case when p_kind = 'academic' then '60000000-0000-0000-0000-0000000000a1'::uuid end,
    case when p_kind = 'academic' then '70000000-0000-0000-0000-0000000000a1'::uuid end,
    14, 'open', 14, 1000, '2026-09-13',
    'contributors_only', now(), p_published, p_published + interval '14 days')
  returning public_id $$;
-- Every detail as published, with some changed.
create function pg_temp.edit(p_public uuid, p_title text, p_campus uuid, p_course uuid,
  p_location text default null, p_tags uuid[] default '{}') returns void language sql as $$
  select public.update_own_published_wanted_details(p_public, p_title, 'A description that is long enough.',
    p_campus, '30000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1', p_course, null,
    '60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a1', p_location, p_tags) $$;
do $$
declare
  academic uuid; claimed uuid; item uuid; talk uuid; w record; rev record;
  poster constant text := '00000000-0000-0000-0000-00000000000a';
  other constant text := '00000000-0000-0000-0000-00000000000b';
  campus_a constant uuid := '20000000-0000-0000-0000-0000000000a1';
  campus_east constant uuid := '20000000-0000-0000-0000-0000000000a2';
  campus_closed constant uuid := '20000000-0000-0000-0000-0000000000a3';
  campus_b constant uuid := '20000000-0000-0000-0000-0000000000b1';
  mat183 constant uuid := '50000000-0000-0000-0000-0000000000a1';
  csc510 constant uuid := '50000000-0000-0000-0000-0000000000a2';
  old100 constant uuid := '50000000-0000-0000-0000-0000000000a3';
  tag_one constant uuid := '80000000-0000-0000-0000-0000000000a1';
  tag_two constant uuid := '80000000-0000-0000-0000-0000000000a2';
  tag_off constant uuid := '80000000-0000-0000-0000-0000000000a3';
  edits constant text := 'public.update_own_published_wanted_details(uuid, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[])';
begin
  academic := pg_temp.mk('Past year papers for MAT183', 'academic', now() - interval '10 minutes');
  claimed := pg_temp.mk('Lab manual for CHM138 please', 'academic', now() - interval '5 minutes');
  item := pg_temp.mk('Missing blue water bottle', 'missing_item', now() - interval '5 minutes');
  talk := pg_temp.mk('Which elective is lighter?', 'discussion', now() - interval '5 minutes');

  -- Who may call it.
  assert not has_function_privilege('anon', edits, 'execute'), 'anon cannot edit';
  assert has_function_privilege('authenticated', edits, 'execute'), 'members can call it';

  -- Someone else's Wanted is not found.
  perform set_config('request.jwt.claim.sub', other, true);
  begin perform pg_temp.edit(academic, 'Someone else''s new title', campus_a, mat183);
    raise exception 'non-poster edited';
  exception when no_data_found then assert sqlerrm = 'wanted_not_found', sqlerrm; end;

  -- The poster moves course and campus inside the hour; the previous details are kept.
  perform set_config('request.jwt.claim.sub', poster, true);
  perform pg_temp.edit(academic, '  Past year papers for CSC510 ', campus_east, csc510, null, array[tag_one]);
  select * into w from public.wanted_requests where public_id = academic;
  assert w.title = 'Past year papers for CSC510', 'title trimmed: ' || w.title;
  assert w.course_id = csc510 and w.campus_id = campus_east, 'course and campus changed';
  assert w.institution_id = '10000000-0000-0000-0000-0000000000e1', 'university unchanged';
  assert w.duration_days_snapshot = 14 and w.fee_rate_basis_points_snapshot = 1000
    and w.policy_version_snapshot = '2026-09-13' and not w.is_free and w.kind = 'academic', 'snapshots unchanged';
  assert (select array_agg(tag_id) = array[tag_one] from public.wanted_request_tags where wanted_request_id = w.id), 'tags set';
  select * into rev from public.wanted_request_revisions where wanted_request_id = w.id;
  assert (select count(*) = 1 from public.wanted_request_revisions where wanted_request_id = w.id), 'one revision';
  assert rev.previous_title = 'Past year papers for MAT183', 'previous title kept';
  assert rev.previous_details ->> 'course_id' = mat183::text
    and rev.previous_details ->> 'campus_id' = campus_a::text
    and rev.previous_details -> 'tag_ids' = '[]'::jsonb, 'previous details kept: ' || rev.previous_details::text;
  assert (select count(*) = 1 from public.wanted_public_events
          where wanted_request_id = w.id and event_type = 'wanted_edited' and summary = 'Edited by the poster'), 'one event';

  -- Saving the same details again records nothing.
  perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_east, csc510, null, array[tag_one]);
  assert (select count(*) = 1 from public.wanted_request_revisions where wanted_request_id = w.id), 'no-op not recorded';

  -- New values must be open and active in the Wanted's own university.
  begin perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_b, csc510);
    raise exception 'campus from another university accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;
  begin perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_closed, csc510);
    raise exception 'closed campus accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;
  begin perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_east, old100);
    raise exception 'inactive course accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;
  begin perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_east, csc510, null, array[tag_one, tag_off]);
    raise exception 'inactive tag accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;
  begin perform pg_temp.edit(academic, 'Past year papers for CSC510', campus_east, null);
    raise exception 'academic without a course accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;
  begin perform pg_temp.edit(academic, 'Short', campus_east, csc510);
    raise exception 'short title accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'wanted_change_invalid', sqlerrm; end;

  -- A value left as published may stay after it is switched off.
  update public.tags set active = false where id = tag_one;
  perform pg_temp.edit(academic, 'Past year papers for CSC510 (any year)', campus_east, csc510, null, array[tag_one]);
  assert (select title = 'Past year papers for CSC510 (any year)' from public.wanted_requests where public_id = academic), 'kept inactive tag';

  -- The title-only edit still works and keeps every other detail.
  perform public.update_own_published_wanted(academic, 'Past year papers for CSC510 v2', 'Ten chars!');
  select * into w from public.wanted_requests where public_id = academic;
  assert w.title = 'Past year papers for CSC510 v2' and w.description = 'Ten chars!' and w.course_id = csc510
    and w.campus_id = campus_east, 'legacy edit keeps details';
  assert (select count(*) = 1 from public.wanted_request_tags where wanted_request_id = w.id), 'legacy edit keeps tags';

  -- A missing item: campus and last seen change; academic arguments are ignored.
  perform public.update_own_published_wanted_details(item, 'Missing blue water bottle', 'A description that is long enough.',
    campus_east, null, null, null, null, null, null, '  Library level 2 ', array[tag_two]);
  select * into w from public.wanted_requests where public_id = item;
  assert w.campus_id = campus_east and w.last_seen_location = 'Library level 2' and w.course_id is null, 'missing item edited';
  begin perform public.update_own_published_wanted_details(item, 'Missing blue water bottle', 'A description that is long enough.',
      campus_east, null, null, null, null, null, null, 'L', '{}');
    raise exception 'one-letter location accepted';
  exception when invalid_parameter_value then null; end;

  -- A discussion keeps no location.
  perform public.update_own_published_wanted_details(talk, 'Which elective is lighter this sem?', 'A description that is long enough.',
    campus_east, null, null, null, null, null, null, 'Ignored', '{}');
  select * into w from public.wanted_requests where public_id = talk;
  assert w.campus_id = campus_east and w.last_seen_location is null, 'discussion edited';

  -- A claim locks it.
  insert into public.claims (wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
  select w2.id, other::uuid, w2.institution_id, 'a.pdf', 'application/pdf', 10, decode(repeat('aa', 32), 'hex'), 'k/edit-one', now()
  from public.wanted_requests w2 where w2.public_id = claimed;
  begin perform pg_temp.edit(claimed, 'Lab manual for CHM138 please (any)', campus_a, mat183);
    raise exception 'edited after a claim';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_change_locked:claim_submitted', sqlerrm; end;

  -- The hour locks it.
  update public.wanted_requests set published_at = now() - interval '61 minutes' where public_id = talk;
  begin perform public.update_own_published_wanted_details(talk, 'Which elective is lighter now?', 'A description that is long enough.',
      campus_a, null, null, null, null, null, null, null, '{}');
    raise exception 'edited after the hour';
  exception when insufficient_privilege then assert sqlerrm = 'wanted_change_locked:window_closed', sqlerrm; end;

  raise notice 'ALL PUBLISHED WANTED EDIT ASSERTIONS PASSED';
end $$;
rollback;
