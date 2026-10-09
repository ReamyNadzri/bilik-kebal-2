\set ON_ERROR_STOP 1
-- Migration 202610210001: the Duel against members' ghosts, practice shots,
-- the member's own record and their listing choice.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000d1','fast@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d2','slow@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d3','new@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d4','unverified@x.test',null);
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000d1','Fast'),('00000000-0000-0000-0000-0000000000d2','Slow'),
 ('00000000-0000-0000-0000-0000000000d3','New'),('00000000-0000-0000-0000-0000000000d4','Unverified')
 on conflict do nothing;
do $$
declare
  fast constant text := '00000000-0000-0000-0000-0000000000d1';
  slow constant text := '00000000-0000-0000-0000-0000000000d2';
  newcomer constant text := '00000000-0000-0000-0000-0000000000d3';
  unverified constant text := '00000000-0000-0000-0000-0000000000d4';
  fast_public uuid := (select public_id from public.profiles where user_id = fast::uuid);
  slow_public uuid := (select public_id from public.profiles where user_id = slow::uuid);
  round_id uuid;
  ghost_ms integer;
  answer jsonb;
  again jsonb;
  i integer;
begin
  -- Signed out, or with an unverified email: nothing is read or written.
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.duel_record(); raise exception 'anonymous read';
  exception when insufficient_privilege then assert sqlerrm = 'duel_auth_required', sqlerrm; end;
  perform set_config('request.jwt.claim.sub', unverified, true);
  begin perform public.record_duel_practice('easy', 300, false); raise exception 'unverified wrote';
  exception when insufficient_privilege then assert sqlerrm = 'EMAIL_NOT_VERIFIED', sqlerrm; end;

  -- A new member has an empty record.
  perform set_config('request.jwt.claim.sub', fast, true);
  answer := public.duel_record();
  assert (answer ->> 'kills')::int = 0 and answer ->> 'averageMs' is null, 'empty record';
  assert answer -> 'history' = '[]'::jsonb and answer -> 'practice' = '{}'::jsonb, 'no history';
  assert (answer ->> 'listed')::boolean, 'listed by default';

  -- Practice: validated, throttled, and every clean shot feeds the average.
  begin perform public.record_duel_practice('impossible', 300, false); raise exception 'bad level';
  exception when invalid_parameter_value then assert sqlerrm = 'duel_reaction_invalid', sqlerrm; end;
  begin perform public.record_duel_practice('easy', 99, false); raise exception 'superhuman';
  exception when invalid_parameter_value then null; end;
  answer := public.record_duel_practice('hard', 300, false);
  assert (answer ->> 'hit')::boolean and (answer ->> 'targetMs')::int = 350, 'a hit under 350';
  begin perform public.record_duel_practice('hard', 300, false); raise exception 'spammed';
  exception when raise_exception then assert sqlerrm = 'duel_too_soon', sqlerrm; end;
  update public.duel_practice_shots set created_at = created_at - interval '1 minute';
  answer := public.record_duel_practice('hard', 360, false);
  assert not (answer ->> 'hit')::boolean, 'too slow is a miss';
  update public.duel_practice_shots set created_at = created_at - interval '1 minute';
  answer := public.record_duel_practice('hard', 200, true);
  assert not (answer ->> 'hit')::boolean and answer ->> 'youMs' is null, 'a foul never hits';
  answer := public.duel_record() -> 'practice' -> 'hard';
  assert (answer ->> 'tries')::int = 3 and (answer ->> 'hits')::int = 1, 'three tries, one hit';
  assert (answer ->> 'bestMs')::int = 300 and (answer ->> 'averageMs')::int = 330, 'fouls excluded';

  -- With two clean shots the ghost is not listed yet: five are needed.
  for i in 1..3 loop
    update public.duel_practice_shots set created_at = created_at - interval '1 minute';
    perform public.record_duel_practice('normal', 250 + i * 10, false);
  end loop;
  answer := public.duel_record();
  assert (answer ->> 'shots')::int = 5 and (answer ->> 'bestMs')::int = 260, 'five clean shots';
  assert (answer ->> 'averageMs')::int = 294, 'average of 300 360 260 270 280';

  -- Another member sees the ghost, never their own.
  assert public.list_duel_opponents() = '[]'::jsonb, 'no ghosts for the only player';
  perform set_config('request.jwt.claim.sub', slow, true);
  answer := public.list_duel_opponents();
  assert jsonb_array_length(answer) = 1, 'one ghost';
  assert (answer -> 0 ->> 'publicId')::uuid = fast_public, 'the fast member';
  assert (answer -> 0 ->> 'averageMs')::int = 294 and (answer -> 0 ->> 'bestMs')::int = 260, 'their real numbers';
  assert (answer -> 0 ->> 'wins')::int = 0, 'not faced yet';

  -- A round: the database draws the ghost's time, never under their fastest.
  begin perform public.start_duel(slow_public); raise exception 'challenged own unlisted self';
  exception when no_data_found then assert sqlerrm = 'duel_opponent_unavailable', sqlerrm; end;
  answer := public.start_duel(fast_public);
  round_id := (answer ->> 'roundId')::uuid;
  ghost_ms := (answer ->> 'opponentMs')::int;
  assert ghost_ms between 260 and 1000, 'at or above their fastest: ' || ghost_ms;
  begin perform public.start_duel(fast_public); raise exception 'second round at once';
  exception when raise_exception then assert sqlerrm = 'duel_too_soon', sqlerrm; end;

  -- Closed too quickly to be a real duel; then decided by the database.
  begin perform public.finish_duel(round_id, 200, 0); raise exception 'scripted finish';
  exception when raise_exception then assert sqlerrm = 'duel_round_too_fast', sqlerrm; end;
  update public.duel_rounds set started_at = now() - interval '10 seconds' where id = round_id;
  begin perform public.finish_duel(round_id, 50, 0); raise exception 'superhuman duel';
  exception when invalid_parameter_value then null; end;
  answer := public.finish_duel(round_id, ghost_ms - 16, 0);
  assert answer ->> 'outcome' = 'win', 'faster by more than 15 ms wins';
  assert (answer ->> 'kills')::int = 1 and (answer ->> 'deaths')::int = 0, 'a kill';

  -- Finishing again answers the same result and counts nothing twice.
  again := public.finish_duel(round_id, 999, 2);
  assert again = answer, 'idempotent';
  assert (select kills from public.duel_records where user_id = slow::uuid) = 1, 'counted once';

  -- Only the challenger can close their round.
  perform set_config('request.jwt.claim.sub', newcomer, true);
  begin perform public.finish_duel(round_id, 300, 0); raise exception 'closed another member''s round';
  exception when no_data_found then assert sqlerrm = 'duel_round_not_found', sqlerrm; end;

  -- A draw within 15 ms, a loss when slower, two fouls, and no shot at all.
  perform set_config('request.jwt.claim.sub', slow, true);
  update public.duel_rounds set started_at = started_at - interval '1 minute';
  round_id := (public.start_duel(fast_public) ->> 'roundId')::uuid;
  ghost_ms := (select opponent_ms from public.duel_rounds where id = round_id);
  update public.duel_rounds set started_at = now() - interval '10 seconds' where id = round_id;
  assert public.finish_duel(round_id, ghost_ms + 15, 0) ->> 'outcome' = 'draw', 'draw at +15';

  update public.duel_rounds set started_at = started_at - interval '1 minute';
  round_id := (public.start_duel(fast_public) ->> 'roundId')::uuid;
  ghost_ms := (select opponent_ms from public.duel_rounds where id = round_id);
  update public.duel_rounds set started_at = now() - interval '10 seconds' where id = round_id;
  assert public.finish_duel(round_id, ghost_ms + 16, 1) ->> 'outcome' = 'lose', 'slower loses';

  update public.duel_rounds set started_at = started_at - interval '1 minute';
  round_id := (public.start_duel(fast_public) ->> 'roundId')::uuid;
  update public.duel_rounds set started_at = now() - interval '10 seconds' where id = round_id;
  answer := public.finish_duel(round_id, 120, 2);
  assert answer ->> 'outcome' = 'lose' and answer ->> 'youMs' is null, 'two fouls lose, time ignored';

  update public.duel_rounds set started_at = started_at - interval '1 minute';
  round_id := (public.start_duel(fast_public) ->> 'roundId')::uuid;
  update public.duel_rounds set started_at = now() - interval '10 seconds' where id = round_id;
  assert public.finish_duel(round_id, null, 0) ->> 'outcome' = 'lose', 'no shot loses';

  -- An old round cannot be closed.
  update public.duel_rounds set started_at = started_at - interval '1 minute';
  round_id := (public.start_duel(fast_public) ->> 'roundId')::uuid;
  update public.duel_rounds set started_at = now() - interval '4 minutes' where id = round_id;
  begin perform public.finish_duel(round_id, 300, 0); raise exception 'expired round closed';
  exception when raise_exception then assert sqlerrm = 'duel_round_expired', sqlerrm; end;

  -- The challenger's record and history; the ghost's owner is untouched.
  answer := public.duel_record();
  assert (answer ->> 'kills')::int = 1 and (answer ->> 'deaths')::int = 3
    and (answer ->> 'draws')::int = 1, 'one win, three losses, one draw';
  assert jsonb_array_length(answer -> 'history') = 5, 'finished duels only';
  assert answer -> 'history' -> 0 ->> 'opponentName' = 'Fast', 'named opponent';
  assert answer -> 'history' -> 0 ->> 'outcome' = 'lose', 'newest first';
  assert (public.list_duel_opponents() -> 0 ->> 'losses')::int = 3, 'record against the ghost';
  assert (select kills + deaths + draws from public.duel_records where user_id = fast::uuid) = 0,
    'the ghost''s owner keeps their record';

  -- A member reads only their own rows.
  assert (select count(*) from public.duel_rounds) >= 6, 'definer sees all';

  -- Hiding the ghost takes it off every list and refuses new rounds.
  perform set_config('request.jwt.claim.sub', fast, true);
  assert public.set_duel_listing(false) = false, 'hidden';
  assert not (public.duel_record() ->> 'listed')::boolean, 'record says hidden';
  perform set_config('request.jwt.claim.sub', slow, true);
  assert public.list_duel_opponents() = '[]'::jsonb, 'hidden ghost not listed';
  update public.duel_rounds set started_at = started_at - interval '1 minute';
  begin perform public.start_duel(fast_public); raise exception 'challenged a hidden ghost';
  exception when no_data_found then null; end;

  -- Reset wipes only the caller's own duels and totals.
  perform public.reset_duel_record();
  answer := public.duel_record();
  assert (answer ->> 'kills')::int = 0 and (answer ->> 'deaths')::int = 0, 'reset';
  assert answer -> 'history' = '[]'::jsonb, 'history gone';
  assert (select count(*) from public.duel_practice_shots where user_id = fast::uuid) = 6,
    'another member''s practice stays';

  raise notice 'duel: all assertions passed';
end;
$$;

-- RLS: a member selecting the tables directly sees only their own rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
do $$
begin
  assert (select count(*) from public.duel_practice_shots) = 0, 'not another member''s shots';
  assert (select count(*) from public.duel_records) = 1, 'own record only';
  begin
    insert into public.duel_records (user_id, kills) values ('00000000-0000-0000-0000-0000000000d2', 99);
    raise exception 'wrote a record directly';
  exception when insufficient_privilege then null; end;
  raise notice 'duel rls: all assertions passed';
end;
$$;
reset role;
rollback;
