\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
 ('00000000-0000-0000-0000-00000000000a','owner@x.test',now(),now()), ('00000000-0000-0000-0000-00000000000b','member@x.test',now(),now()),
 ('00000000-0000-0000-0000-00000000000c','sheriff@x.test',now(),now()), ('00000000-0000-0000-0000-00000000000d','isheriff@x.test',now(),now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Owner'),('00000000-0000-0000-0000-00000000000b','Member One'),('00000000-0000-0000-0000-00000000000c','Plat Sheriff'),('00000000-0000-0000-0000-00000000000d','Inst Sheriff') on conflict do nothing;
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-000000000001','uitm','UiTM'),('10000000-0000-0000-0000-000000000002','other','Other');
insert into public.platform_role_assignments (user_id, role) values ('00000000-0000-0000-0000-00000000000a','owner'),('00000000-0000-0000-0000-00000000000c','platform_sheriff');
insert into public.institution_role_assignments (user_id, institution_id, role) values ('00000000-0000-0000-0000-00000000000d','10000000-0000-0000-0000-000000000002','institution_sheriff');
do $$
declare o uuid := '00000000-0000-0000-0000-00000000000a'; m uuid := '00000000-0000-0000-0000-00000000000b'; sh uuid := '00000000-0000-0000-0000-00000000000c'; ish uuid := '00000000-0000-0000-0000-00000000000d';
  mp uuid; res jsonb; b uuid;
begin
  select public_id into mp from public.profiles where user_id = m;
  -- member has no console
  perform set_config('request.jwt.claim.sub', m::text, true);
  begin perform public.console_search_members(); raise exception 'member searched'; exception when insufficient_privilege then null; end;
  -- platform sheriff sees emails
  perform set_config('request.jwt.claim.sub', sh::text, true);
  res := public.console_search_members('member@');
  assert jsonb_array_length(res) = 1 and res->0->>'email' = 'member@x.test', res::text;
  perform public.console_rename_member(mp, 'Renamed', 'offensive_name');
  begin perform public.console_set_sheriff(mp, null, true); raise exception 'sheriff appointed'; exception when insufficient_privilege then null; end;
  begin perform public.create_badge('Deputy'); raise exception 'sheriff badge'; exception when insufficient_privilege then null; end;
  -- institution sheriff: only own institution, no email
  perform set_config('request.jwt.claim.sub', ish::text, true);
  assert jsonb_array_length(public.console_search_members()) = 0, 'isheriff scope before membership';
  insert into public.institution_memberships (user_id, institution_id, verification_state) values (m, '10000000-0000-0000-0000-000000000002', 'pending');
  res := public.console_search_members();
  assert jsonb_array_length(res) = 1 and res->0->'email' = 'null'::jsonb, res::text;
  begin perform public.console_rename_member(mp, 'x', 'r'); raise exception 'isheriff renamed'; exception when insufficient_privilege then null; end;
  -- owner: verify, appoint, badge
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform public.console_set_institution_verification(mp, '10000000-0000-0000-0000-000000000002', true, 'manual_check');
  assert (select verification_state = 'verified' from public.institution_memberships where user_id = m), 'verified';
  perform public.console_set_sheriff(mp, null, true);
  assert exists (select 1 from public.platform_role_assignments where user_id = m and role = 'platform_sheriff'), 'appointed';
  b := public.create_badge('Deputy', 'Helps out', '11111111-1111-1111-1111-111111111111.png');
  perform public.set_member_badge(mp, b);
  perform public.set_member_badge(mp, b);
  assert (select count(*) = 1 from public.badge_awards where user_id = m and revoked_at is null), 'one badge';
  perform public.retire_badge(b);
  assert not exists (select 1 from public.badge_awards where user_id = m and revoked_at is null), 'retired removes';
  perform public.console_timeout_member(mp, 1, 'spam');
  res := public.console_search_members('Renamed');
  assert res->0->'restriction'->>'expiresAt' is not null, res::text;
  -- sheriff cannot rename owner
  perform set_config('request.jwt.claim.sub', sh::text, true);
  begin perform public.console_rename_member((select public_id from public.profiles where user_id = o), 'x', 'r'); raise exception 'renamed owner'; exception when insufficient_privilege then null; end;
  -- step-up
  update auth.users set last_sign_in_at = now() - interval '1 hour' where id = sh;
  begin perform public.console_rename_member(mp, 'y', 'r'); raise exception 'no step-up'; exception when insufficient_privilege then assert sqlerrm = 'RECENT_AUTH_REQUIRED'; end;
  assert (select count(*) from public.identity_audit_events) >= 7, 'audited';
  raise notice 'ALL CONSOLE ASSERTIONS PASSED';
end $$;
rollback;
