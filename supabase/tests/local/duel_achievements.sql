\set ON_ERROR_STOP 1
-- Migration 202610210002: monthly Duel achievements, the reward claim and the
-- K/D leaderboard.
begin;
insert into auth.users (id, email, email_confirmed_at)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'h' || i || '@x.test', now()
from generate_series(1, 14) i;
insert into public.profiles (user_id, display_name)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'Hunter ' || i
from generate_series(1, 14) i
on conflict do nothing;
-- Hunter 1 is institution verified; hunter 2 is not.
insert into public.institutions (id, name) values ('00000000-0000-0000-0000-00000000aaaa', 'UiTM Test');
insert into public.institution_memberships (user_id, institution_id, verification_state, verified_at, updated_at)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000aaaa', 'verified', now(), now()),
       ('00000000-0000-0000-0000-000000000114', '00000000-0000-0000-0000-00000000aaaa', 'verified', now(), now());

do $$
declare
  star constant uuid := '00000000-0000-0000-0000-000000000101';
  plain constant uuid := '00000000-0000-0000-0000-000000000102';
  answer jsonb;
  item jsonb;
  i integer;
  before_bonus integer;
  this_month timestamptz := private.duel_month_start(private.duel_month(now()));
begin
  -- Hunter 1: 30 wins against hunters 3–12 (three each), in order, then a loss
  -- to hunter 3 and a revenge win; one win after a foul; one close win.
  for i in 0..29 loop
    insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls)
    values (star, ('00000000-0000-0000-0000-0000000001' || lpad((3 + i % 10)::text, 2, '0'))::uuid,
            case when i = 0 then 260 else 400 end,
            this_month + make_interval(mins => i * 10), this_month + make_interval(mins => i * 10, secs => 8),
            'win', case when i = 1 then 380 else 280 end, case when i = 2 then 1 else 0 end);
  end loop;
  insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls) values
    (star, '00000000-0000-0000-0000-000000000103', 250, this_month + interval '6 hours', this_month + interval '6 hours 8 seconds', 'lose', 300, 0),
    (star, '00000000-0000-0000-0000-000000000103', 400, this_month + interval '7 hours', this_month + interval '7 hours 8 seconds', 'win', 190, 0),
    -- Last month's duel never counts.
    (star, '00000000-0000-0000-0000-000000000104', 400, this_month - interval '1 day', this_month - interval '1 day' + interval '8 seconds', 'win', 280, 0);
  insert into public.duel_practice_shots (user_id, level, target_ms, reaction_ms, foul, hit, created_at) values
    (star, 'legend', 210, 190, false, true, this_month + interval '1 day'),
    (star, 'easy', 700, null, true, false, this_month + interval '1 day');
  insert into public.duel_records (user_id, kills, deaths, draws) values (star, 31, 1, 0);

  perform set_config('request.jwt.claim.sub', star::text, true);
  answer := public.duel_achievements_this_month();
  assert jsonb_array_length(answer -> 'items') = 50, 'fifty achievements';
  assert (answer ->> 'rewardEligible')::boolean, 'institution verified';
  assert answer ->> 'month' = to_char(private.duel_month(now()), 'YYYY-MM'), 'this month';

  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'wins_30';
  assert (item ->> 'progress')::int = 30 and (item ->> 'done')::boolean, 'thirty wins, last month left out: ' || item::text;
  assert (item ->> 'grantsFreeRequest')::boolean and not (item ->> 'claimed')::boolean, 'a reward, unclaimed';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'beaten_10';
  assert (item ->> 'progress')::int = 10, 'ten different hunters';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'streak_10';
  assert (item ->> 'done')::boolean, 'thirty in a row';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'revenge_1';
  assert (item ->> 'done')::boolean, 'payback after the loss';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'comeback_1';
  assert (item ->> 'done')::boolean, 'a win after a foul';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'deadeye_1';
  assert (item ->> 'done')::boolean, 'beat a 260 ms ghost';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'close_1';
  assert (item ->> 'done')::boolean, 'won by 20 ms';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'under_200_1';
  assert (item ->> 'progress')::int = 1, 'one shot under 200 counted once: the foul is left out';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'hit_legend';
  assert (item ->> 'done')::boolean, 'legend hit';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'days_3';
  assert (item ->> 'progress')::int = 2, 'two days played';
  select x into item from jsonb_array_elements(answer -> 'items') x where x ->> 'id' = 'hall_of_fame';
  assert (item ->> 'done')::boolean, 'more than 25 others done: ' || item::text;

  -- Claiming: only reward achievements, only when done, once a month.
  begin perform public.claim_duel_achievement('first_blood'); raise exception 'claimed a plain one';
  exception when no_data_found then assert sqlerrm = 'duel_achievement_not_found', sqlerrm; end;
  before_bonus := (select bonus from private.free_request_allowance(star));
  assert public.claim_duel_achievement('wins_30') = 'claimed', 'claimed';
  assert public.claim_duel_achievement('wins_30') = 'already_claimed', 'once a month';
  assert public.claim_duel_achievement('beaten_10') = 'claimed', 'second reward';
  assert (select bonus from private.free_request_allowance(star)) = before_bonus + 2, 'two more free requests';
  select x into item from jsonb_array_elements(public.duel_achievements_this_month() -> 'items') x
  where x ->> 'id' = 'wins_30';
  assert (item ->> 'claimed')::boolean, 'shown as claimed';

  -- Last month's claim does not block this month's.
  update public.duel_achievement_rewards set month = (private.duel_month(now()) - interval '1 month')::date
  where achievement_id = 'wins_30';
  assert public.claim_duel_achievement('wins_30') = 'claimed', 'a new month, a new claim';

  -- Verified, but nothing played this month: nothing to claim.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000114', true);
  begin perform public.claim_duel_achievement('hall_of_fame'); raise exception 'claimed unfinished';
  exception when raise_exception then assert sqlerrm = 'duel_achievement_incomplete', sqlerrm; end;

  -- Not institution verified: achievements yes, rewards no.
  perform set_config('request.jwt.claim.sub', plain::text, true);
  for i in 0..29 loop
    insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls)
    values (plain, star, 400, this_month + make_interval(mins => i), this_month + make_interval(mins => i, secs => 8), 'win', 280, 0);
  end loop;
  assert not (public.duel_achievements_this_month() ->> 'rewardEligible')::boolean, 'not eligible';
  begin perform public.claim_duel_achievement('wins_30'); raise exception 'unverified claimed';
  exception when insufficient_privilege then assert sqlerrm = 'duel_reward_not_eligible', sqlerrm; end;

  -- The leaderboard: 10 duels or more, by K/D, hidden ghosts left out.
  insert into public.duel_records (user_id, kills, deaths, draws, listed) values
    ('00000000-0000-0000-0000-000000000103', 20, 4, 0, true),   -- 5.00
    ('00000000-0000-0000-0000-000000000104', 9, 0, 0, true),    -- under 10 duels
    ('00000000-0000-0000-0000-000000000105', 40, 1, 0, false),  -- hidden
    ('00000000-0000-0000-0000-000000000106', 10, 2, 0, true),   -- 5.00, fewer kills
    ('00000000-0000-0000-0000-000000000107', 8, 4, 0, true);    -- 2.00
  answer := public.duel_leaderboard();
  assert jsonb_array_length(answer) = 3, 'three places';
  assert answer -> 0 ->> 'displayName' = 'Hunter 1', 'first: 31.00';
  assert answer -> 1 ->> 'displayName' = 'Hunter 3', 'second: 5.00 with more kills';
  assert answer -> 2 ->> 'displayName' = 'Hunter 6', 'third';

  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.duel_leaderboard(); raise exception 'anonymous leaderboard';
  exception when insufficient_privilege then null; end;

  raise notice 'duel achievements: all assertions passed';
end;
$$;
rollback;
