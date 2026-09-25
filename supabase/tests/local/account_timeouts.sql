\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
 ('00000000-0000-0000-0000-00000000000a','owner@x.test',now(),now()), ('00000000-0000-0000-0000-00000000000b','member@x.test',now(),now()), ('00000000-0000-0000-0000-00000000000c','sheriff@x.test',now(),now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Owner'),('00000000-0000-0000-0000-00000000000b','Member'),('00000000-0000-0000-0000-00000000000c','Sheriff') on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values ('00000000-0000-0000-0000-00000000000a','owner'),('00000000-0000-0000-0000-00000000000c','platform_sheriff');
do $$
declare o uuid := '00000000-0000-0000-0000-00000000000a'; m uuid := '00000000-0000-0000-0000-00000000000b'; sh uuid := '00000000-0000-0000-0000-00000000000c';
begin
  perform set_config('request.jwt.claim.sub', sh::text, true);
  begin perform public.restrict_account(m, 'spam'); raise exception 'sheriff made permanent';
  exception when insufficient_privilege then null; end;
  begin perform public.timeout_account(o, 1, 'spam'); raise exception 'timed out owner';
  exception when insufficient_privilege then null; end;
  begin perform public.timeout_account(m, 5, 'spam'); raise exception 'bad duration';
  exception when invalid_parameter_value then null; end;
  perform public.timeout_account(m, 24, 'spam');
  assert (select expires_at > now() + interval '23 hours' from public.account_restrictions where user_id = m and lifted_at is null), 'timeout';
  begin perform public.timeout_account(m, 1, 'spam'); raise exception 'double';
  exception when unique_violation then null; end;
  -- member cannot time out anyone
  perform set_config('request.jwt.claim.sub', m::text, true);
  begin perform public.timeout_account(sh, 1, 'spam'); raise exception 'member timed out';
  exception when insufficient_privilege then null; end;
  -- expiry lifts
  update public.account_restrictions set restricted_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where user_id = m and lifted_at is null;
  assert private.lift_expired_timeouts() = 1, 'lifted';
  assert private.lift_expired_timeouts() = 0, 'idempotent';
  assert not exists (select 1 from public.account_restrictions where user_id = m and lifted_at is null), 'no active';
  -- owner permanent; sheriff cannot lift it
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform public.restrict_account(m, 'fraud');
  perform set_config('request.jwt.claim.sub', sh::text, true);
  begin perform public.lift_account_restriction(m); raise exception 'sheriff lifted permanent';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform public.lift_account_restriction(m);
  -- stale sign-in blocks
  update auth.users set last_sign_in_at = now() - interval '1 hour' where id = sh;
  perform set_config('request.jwt.claim.sub', sh::text, true);
  begin perform public.timeout_account(m, 1, 'spam'); raise exception 'no step-up';
  exception when insufficient_privilege then assert sqlerrm = 'RECENT_AUTH_REQUIRED', sqlerrm; end;
  assert (select count(*) from public.identity_audit_events where event_type like 'account.%') = 4, (select string_agg(event_type, ',') from public.identity_audit_events);
  raise notice 'ALL TIMEOUT ASSERTIONS PASSED';
end $$;
rollback;
