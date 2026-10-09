\set ON_ERROR_STOP 1
-- Migration 202610210003: 2 free requests for each finished topic, expiring
-- one month after they are claimed.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000002a1','topic@x.test',now()),
 ('00000000-0000-0000-0000-0000000002a2','rival@x.test',now()),
 ('00000000-0000-0000-0000-0000000002a3','plain@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000002a1','Topic'),('00000000-0000-0000-0000-0000000002a2','Rival'),
 ('00000000-0000-0000-0000-0000000002a3','Plain')
 on conflict do nothing;
insert into public.institutions (id, name) values ('00000000-0000-0000-0000-00000000bbbb', 'UiTM Topic');
insert into public.institution_memberships (user_id, institution_id, verification_state, verified_at, updated_at)
values ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-00000000bbbb', 'verified', now(), now());

do $$
declare
  member constant uuid := '00000000-0000-0000-0000-0000000002a1';
  rival constant uuid := '00000000-0000-0000-0000-0000000002a2';
  plain constant uuid := '00000000-0000-0000-0000-0000000002a3';
  this_month timestamptz := private.duel_month_start(private.duel_month(now()));
  answer jsonb;
  topic jsonb;
  before record;
  after record;
  i integer;
  t0 constant timestamptz := '2026-01-01T00:00:00Z';
begin
  perform set_config('request.jwt.claim.sub', member::text, true);
  answer := public.duel_achievements_this_month();
  assert (answer ->> 'topicCredits')::int = 2, 'two per topic';
  assert jsonb_array_length(answer -> 'topics') = 7, 'seven topics: ' || (answer -> 'topics')::text;
  assert answer -> 'topics' -> 0 ->> 'category' = 'Showdowns', 'in catalogue order';
  assert (answer -> 'items' -> 0 ->> 'number')::int = 1, 'badge numbers';
  select x into topic from jsonb_array_elements(answer -> 'topics') x where x ->> 'category' = 'Streaks';
  assert (topic ->> 'total')::int = 3 and (topic ->> 'done')::int = 0, 'streaks not started';

  begin perform public.claim_duel_topic('Streaks'); raise exception 'claimed an unfinished topic';
  exception when raise_exception then assert sqlerrm = 'duel_topic_incomplete', sqlerrm; end;
  begin perform public.claim_duel_topic('Bounty'); raise exception 'claimed an unknown topic';
  exception when no_data_found then assert sqlerrm = 'duel_topic_not_found', sqlerrm; end;

  -- Ten wins in a row finish Streaks.
  for i in 0..9 loop
    insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls)
    values (member, rival, 400, this_month + make_interval(mins => i), this_month + make_interval(mins => i, secs => 8), 'win', 280, 0);
  end loop;
  select * into before from private.free_request_allowance(member);
  assert public.claim_duel_topic('Streaks') = 'claimed', 'claimed';
  assert public.claim_duel_topic('Streaks') = 'already_claimed', 'once a month';
  select * into after from private.free_request_allowance(member);
  assert after.bonus = before.bonus + 2 and after.remaining = before.remaining + 2, 'two more free requests';
  assert (select expires_at from public.duel_topic_rewards where user_id = member)
    = now() + interval '1 month', 'expires a month after the claim';
  select x into topic from jsonb_array_elements(public.duel_achievements_this_month() -> 'topics') x
  where x ->> 'category' = 'Streaks';
  assert (topic ->> 'claimed')::boolean and topic ->> 'expiresAt' is not null, 'shown as claimed';

  -- Expired and unused, the credits stop counting.
  update public.duel_topic_rewards
    set granted_at = now() - interval '40 days', expires_at = now() - interval '5 days'
    where user_id = member;
  select * into after from private.free_request_allowance(member);
  assert after.bonus = before.bonus and after.remaining = before.remaining, 'lapsed credits are gone';

  -- Not institution verified: the topic can be finished, not claimed.
  perform set_config('request.jwt.claim.sub', plain::text, true);
  for i in 0..9 loop
    insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls)
    values (plain, rival, 400, this_month + make_interval(mins => i), this_month + make_interval(mins => i, secs => 8), 'win', 280, 0);
  end loop;
  begin perform public.claim_duel_topic('Streaks'); raise exception 'unverified claimed';
  exception when insufficient_privilege then assert sqlerrm = 'duel_reward_not_eligible', sqlerrm; end;

  -- The accounting itself: soonest expiry first, only while live.
  assert private.lapsed_topic_credits('{}', '{}', '{}', t0) = 0, 'nothing to lapse';
  assert private.lapsed_topic_credits(
    array[t0, t0], array[t0 + interval '30 days', t0 + interval '30 days'], '{}', t0 + interval '31 days'
  ) = 2, 'both lapse unused';
  assert private.lapsed_topic_credits(
    array[t0, t0], array[t0 + interval '30 days', t0 + interval '30 days'],
    array[t0 + interval '10 days'], t0 + interval '31 days'
  ) = 1, 'one used while live, one lapsed';
  assert private.lapsed_topic_credits(
    array[t0, t0], array[t0 + interval '30 days', t0 + interval '30 days'],
    array[t0 - interval '1 day', t0 + interval '40 days'], t0 + interval '41 days'
  ) = 2, 'posts before the grant or after expiry use the lasting allowance';
  assert private.lapsed_topic_credits(
    array[t0, t0 + interval '5 days'], array[t0 + interval '30 days', t0 + interval '35 days'],
    array[t0 + interval '6 days'], t0 + interval '33 days'
  ) = 0, 'the soonest-expiring credit is used first; the other is still live';
  assert private.lapsed_topic_credits(
    array[t0, t0 + interval '5 days'], array[t0 + interval '30 days', t0 + interval '35 days'],
    array[t0 + interval '6 days'], t0 + interval '36 days'
  ) = 1, 'and lapses later';

  raise notice 'duel topic rewards: all assertions passed';
end;
$$;
rollback;
