\set ON_ERROR_STOP 1
-- Migration 202610200007: accepting the Terms (18+), and privacy requests that
-- only the Owner reads and answers.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000a1','member@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a2','other@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a3','sheriff@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a4','owner@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000a1','Member'),('00000000-0000-0000-0000-0000000000a2','Other'),
 ('00000000-0000-0000-0000-0000000000a3','Sheriff'),('00000000-0000-0000-0000-0000000000a4','Owner')
 on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values
 ('00000000-0000-0000-0000-0000000000a3','platform_sheriff'),
 ('00000000-0000-0000-0000-0000000000a4','owner');
do $$
declare
  member constant text := '00000000-0000-0000-0000-0000000000a1';
  other constant text := '00000000-0000-0000-0000-0000000000a2';
  sheriff constant text := '00000000-0000-0000-0000-0000000000a3';
  owner_id constant text := '00000000-0000-0000-0000-0000000000a4';
  current_version text := (select version from public.terms_versions order by effective_at desc limit 1);
  request_id uuid;
begin
  assert current_version = '2026-10-03', 'the first version is published';

  -- Nobody signed in: nothing is recorded.
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.accept_terms(current_version, true); raise exception 'anonymous accepted';
  exception when insufficient_privilege then null; end;

  -- A member has accepted nothing yet; the account read says so.
  perform set_config('request.jwt.claim.sub', member, true);
  assert public.current_account() ->> 'terms_accepted_version' is null, 'no acceptance yet';

  -- 18+ must be confirmed, and only the current version can be accepted.
  begin perform public.accept_terms(current_version, false); raise exception 'minor accepted';
  exception when invalid_parameter_value then
    assert sqlerrm = 'terms_adult_required', sqlerrm;
  end;
  begin perform public.accept_terms(current_version, null); raise exception 'null adult accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.accept_terms('2026-09-01', true); raise exception 'stale version accepted';
  exception when invalid_parameter_value then
    assert sqlerrm = 'terms_version_stale', sqlerrm;
  end;
  assert (select count(*) = 0 from public.terms_acceptances), 'refusals record nothing';

  -- Accepting twice records once.
  assert public.accept_terms(current_version, true) = 'accepted', 'accepted';
  assert public.accept_terms(current_version, true) = 'already_accepted', 'idempotent';
  assert (select count(*) = 1 from public.terms_acceptances where user_id = member::uuid), 'one row';
  assert public.current_account() ->> 'terms_accepted_version' = current_version, 'account read names it';

  -- A newer version makes the old acceptance stale until it is accepted too.
  insert into public.terms_versions (version, effective_at) values ('2026-12-01', now() + interval '1 minute');
  begin perform public.accept_terms(current_version, true); raise exception 'old version accepted';
  exception when invalid_parameter_value then null; end;
  assert public.current_account() ->> 'terms_accepted_version' = current_version, 'still the old one';
  assert public.accept_terms('2026-12-01', true) = 'accepted', 'new version accepted';
  assert public.current_account() ->> 'terms_accepted_version' = '2026-12-01', 'latest by effective date';

  -- Privacy requests: any signed-in member, checked input, at most 3 waiting.
  begin perform public.submit_privacy_request('everything', 'Please send my data.'); raise exception 'bad kind';
  exception when invalid_parameter_value then null; end;
  begin perform public.submit_privacy_request('access', '   short   '); raise exception 'short details';
  exception when invalid_parameter_value then null; end;
  request_id := public.submit_privacy_request('access', '  Please send me a copy of my data.  ');
  assert (select details = 'Please send me a copy of my data.' from public.privacy_requests where id = request_id), 'trimmed';
  perform public.submit_privacy_request('correction', 'My display name is spelled wrongly.');
  perform public.submit_privacy_request('deletion', 'Delete the bio I wrote last year.');
  begin perform public.submit_privacy_request('other', 'A fourth request while three wait.'); raise exception 'fourth';
  exception when raise_exception then
    assert sqlerrm = 'privacy_request_limit', sqlerrm;
  end;

  -- Only the Owner reads the queue and answers; a Platform Sheriff does not.
  perform set_config('request.jwt.claim.sub', sheriff, true);
  begin perform public.list_privacy_requests(); raise exception 'sheriff read the queue';
  exception when insufficient_privilege then null; end;
  begin perform public.answer_privacy_request(request_id, 'Done.'); raise exception 'sheriff answered';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', member, true);
  begin perform public.list_privacy_requests(); raise exception 'member read the queue';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub', owner_id, true);
  assert (select count(*) = 3 from public.list_privacy_requests()), 'owner sees the open three';
  assert (select member_display_name = 'member' from public.list_privacy_requests() where id = request_id), 'names the member';
  begin perform public.answer_privacy_request(request_id, '   '); raise exception 'empty answer';
  exception when invalid_parameter_value then null; end;
  perform public.answer_privacy_request(request_id, 'Your data is attached to this answer below.');
  begin perform public.answer_privacy_request(request_id, 'Again.'); raise exception 'answered twice';
  exception when no_data_found then
    assert sqlerrm = 'privacy_request_not_open', sqlerrm;
  end;
  assert (select count(*) = 2 from public.list_privacy_requests()), 'answered leaves the open queue';
  assert (select count(*) = 1 from public.list_privacy_requests('answered')), 'and is listed as answered';

  -- Answering frees a slot.
  perform set_config('request.jwt.claim.sub', member, true);
  perform public.submit_privacy_request('other', 'A new question after the answer.');
end $$;

-- Row-level security: a member reads only their own acceptances and requests.
grant usage on schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
do $$ begin
  assert (select count(*) = 0 from public.terms_acceptances), 'other member sees no acceptance';
  assert (select count(*) = 0 from public.privacy_requests), 'other member sees no request';
  assert (select count(*) >= 1 from public.terms_versions), 'versions are public';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$ begin
  assert (select count(*) = 2 from public.terms_acceptances), 'member sees their two acceptances';
  assert (select count(*) = 4 from public.privacy_requests), 'member sees their requests';
  assert (select answer is not null from public.privacy_requests where kind = 'access'), 'and the answer';
end $$;
-- Never written directly: no insert, update or delete for members.
do $$ begin
  begin
    insert into public.terms_acceptances (user_id, terms_version, confirmed_adult)
    values ('00000000-0000-0000-0000-0000000000a1', '2026-10-03', true);
    raise exception 'direct insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.privacy_requests set status = 'answered', answer = 'self', answered_at = now();
    raise exception 'direct update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.terms_acceptances;
    raise exception 'direct delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
do $$ begin
  assert (select count(*) = 4 from public.privacy_requests), 'the Owner reads every request';
  assert (select count(*) = 0 from public.terms_acceptances), 'but not other members'' acceptances';
end $$;
reset role;
do $$ begin raise notice 'terms_and_privacy: ok'; end $$;
rollback;
