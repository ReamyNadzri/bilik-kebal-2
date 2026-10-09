\set ON_ERROR_STOP 1
-- Migration 202610210004: online Duel rooms.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000003a1','host@x.test',now()),
 ('00000000-0000-0000-0000-0000000003a2','guest@x.test',now()),
 ('00000000-0000-0000-0000-0000000003a3','third@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000003a1','Host'),('00000000-0000-0000-0000-0000000003a2','Guest'),
 ('00000000-0000-0000-0000-0000000003a3','Third')
 on conflict do nothing;

do $$
declare
  host constant text := '00000000-0000-0000-0000-0000000003a1';
  guest constant text := '00000000-0000-0000-0000-0000000003a2';
  third constant text := '00000000-0000-0000-0000-0000000003a3';
  view jsonb;
  room uuid;
  room_code text;
  round_no integer;
begin
  -- The host opens a room; others see it listed, the host does not.
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.open_duel_room();
  room := (view ->> 'roomId')::uuid;
  room_code := view ->> 'code';
  assert room_code ~ '^[A-HJ-NP-Z2-9]{6}$', 'a readable code: ' || room_code;
  assert view ->> 'status' = 'open' and view -> 'opponent' = 'null'::jsonb, 'waiting';
  assert public.list_open_duel_rooms() = '[]'::jsonb, 'not your own room';
  perform set_config('request.jwt.claim.sub', guest, true);
  assert public.list_open_duel_rooms() -> 0 ->> 'code' = room_code, 'listed for others';

  -- Joining starts the duel 6 s later; nobody else can join, or read it.
  view := public.join_duel_room(lower(room_code));
  assert view ->> 'status' = 'playing' and view ->> 'role' = 'guest', 'joined';
  assert view -> 'opponent' ->> 'displayName' = 'Host', 'sees the host';
  assert (view -> 'round' ->> 'number')::int = 1, 'round one';
  assert (view -> 'round' ->> 'startsAt')::timestamptz = now() + interval '6 seconds', 'six second lead';
  assert (view -> 'round' ->> 'signalAt')::timestamptz between now() + interval '8.8 seconds'
    and now() + interval '15.3 seconds', 'signal 2.8–9.3 s after the start';
  assert (view ->> 'serverNow')::bigint > 0, 'server clock sent';
  perform set_config('request.jwt.claim.sub', third, true);
  begin perform public.join_duel_room(room_code); raise exception 'a third member joined';
  exception when raise_exception then assert sqlerrm = 'duel_room_unavailable', sqlerrm; end;
  begin perform public.duel_room_state(room); raise exception 'a stranger read the room';
  exception when no_data_found then assert sqlerrm = 'duel_room_not_found', sqlerrm; end;
  assert public.list_open_duel_rooms() = '[]'::jsonb, 'no longer open';

  -- A first foul restarts the round for both, 2.5 s later.
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.submit_duel_room_shot(room, 1, null, true);
  assert (view -> 'round' ->> 'number')::int = 2 and view -> 'round' ->> 'lastFoul' = 'you', 'restarted';
  assert (view -> 'round' ->> 'yourFouls')::int = 1, 'one foul';
  perform set_config('request.jwt.claim.sub', guest, true);
  view := public.duel_room_state(room);
  assert view -> 'round' ->> 'lastFoul' = 'them' and (view -> 'round' ->> 'theirFouls')::int = 1, 'guest sees it';
  -- A shot for the old round changes nothing.
  view := public.submit_duel_room_shot(room, 1, 250, false);
  assert not (view -> 'round' ->> 'youShot')::boolean, 'stale shot ignored';

  -- Both shoot: the guest's time stays hidden from the host until it is decided.
  update public.duel_rooms set signal_at = now() - interval '1 second' where id = room;
  view := public.submit_duel_room_shot(room, 2, 300, false);
  assert (view -> 'round' ->> 'youShot')::boolean and view -> 'result' = 'null'::jsonb, 'waiting on the host';
  begin perform public.submit_duel_room_shot(room, 2, 50, false); raise exception 'superhuman';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.duel_room_state(room);
  assert (view -> 'round' ->> 'theyShot')::boolean and not (view -> 'round' ? 'theirMs'), 'no peeking';
  view := public.submit_duel_room_shot(room, 2, 250, false);
  assert view ->> 'status' = 'finished', 'decided';
  assert view -> 'result' ->> 'outcome' = 'win' and view -> 'result' ->> 'reason' = 'shots', 'faster wins';
  assert (view -> 'result' ->> 'themMs')::int = 300 and (view -> 'result' ->> 'yourFouls')::int = 1, 'times shown';
  assert (view -> 'result' ->> 'kills')::int = 1, 'a kill';
  assert (select count(*) from public.duel_rounds where kind = 'live') = 2, 'one row each';
  assert (select deaths from public.duel_records where user_id = guest::uuid) = 1, 'the guest has a death';
  assert (select opponent_ms from public.duel_rounds where challenger_id = host::uuid and kind = 'live') = 300,
    'history keeps their time';
  -- Shooting again after the result changes nothing.
  view := public.submit_duel_room_shot(room, 2, 120, false);
  assert (select kills from public.duel_records where user_id = host::uuid) = 1, 'counted once';

  -- A rematch needs both.
  view := public.rematch_duel_room(room);
  assert view ->> 'status' = 'finished' and (view -> 'rematch' ->> 'you')::boolean, 'host asked';
  perform set_config('request.jwt.claim.sub', guest, true);
  view := public.rematch_duel_room(room);
  assert view ->> 'status' = 'playing' and (view ->> 'duelNo')::int = 2, 'second duel';
  assert (view -> 'round' ->> 'yourFouls')::int = 0 and view -> 'result' = 'null'::jsonb, 'fresh';
  round_no := (view -> 'round' ->> 'number')::int;

  -- Two fouls lose.
  perform public.submit_duel_room_shot(room, round_no, null, true);
  view := public.submit_duel_room_shot(room, round_no + 1, null, true);
  assert view -> 'result' ->> 'outcome' = 'lose' and view -> 'result' ->> 'reason' = 'fouls', 'fouled out';

  -- Out of time: one shot beats none.
  perform public.rematch_duel_room(room);
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.rematch_duel_room(room);
  round_no := (view -> 'round' ->> 'number')::int;
  update public.duel_rooms set signal_at = now() - interval '1 second' where id = room;
  perform public.submit_duel_room_shot(room, round_no, 400, false);
  update public.duel_rooms set signal_at = now() - interval '5 seconds' where id = room;
  view := public.duel_room_state(room);
  assert view -> 'result' ->> 'outcome' = 'win' and view -> 'result' ->> 'themMs' is null, 'the only shot wins';

  -- Gone for 15 s after SHOOT!: the one who left loses.
  perform public.rematch_duel_room(room);
  perform set_config('request.jwt.claim.sub', guest, true);
  perform public.rematch_duel_room(room);
  update public.duel_rooms
    set signal_at = now() - interval '1 second', guest_seen_at = now() - interval '20 seconds'
    where id = room;
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.duel_room_state(room);
  assert view -> 'result' ->> 'outcome' = 'win' and view -> 'result' ->> 'reason' = 'left', 'they left';

  -- Before SHOOT!, leaving just closes the room; after it, leaving loses.
  perform public.rematch_duel_room(room);
  perform set_config('request.jwt.claim.sub', guest, true);
  perform public.rematch_duel_room(room);
  perform public.leave_duel_room(room);
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.duel_room_state(room);
  assert view ->> 'status' = 'closed' and view -> 'result' = 'null'::jsonb, 'closed, no result';

  view := public.open_duel_room();
  room := (view ->> 'roomId')::uuid;
  perform set_config('request.jwt.claim.sub', guest, true);
  perform public.join_duel_room(view ->> 'code');
  update public.duel_rooms set signal_at = now() - interval '1 second' where id = room;
  perform public.leave_duel_room(room);
  perform set_config('request.jwt.claim.sub', host, true);
  view := public.duel_room_state(room);
  assert view ->> 'status' = 'closed' and view -> 'result' ->> 'outcome' = 'win', 'leaving after SHOOT! loses';

  -- Opening again closes the host's earlier open room.
  view := public.open_duel_room();
  perform public.open_duel_room();
  assert (select count(*) from public.duel_rooms where host_id = host::uuid and status = 'open') = 1, 'one open room';

  raise notice 'duel rooms: all assertions passed';
end;
$$;
rollback;
