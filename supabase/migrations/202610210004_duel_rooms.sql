-- Migration: 202610210004_duel_rooms.sql
--
-- Request of 2026-10-10: online Duels. A member opens a room; it is listed in
-- the Duel lobby and has a link. When another member joins, the duel starts.
--
-- Decisions (user, 2026-10-10):
--   * Online duels count for both members: K/D, history, the leaderboard and
--     the monthly achievements.
--   * One retry after a foul, as against ghosts: a first foul restarts the
--     round for both with a new signal; a second foul by the same member
--     loses the duel.
--   * Open rooms are listed for any member with a verified email, and can be
--     joined by link or code.
--
-- The database owns every moment: when the standoff starts, when SHOOT!
-- shows, and who won. Each browser maps those moments onto its own clock from
-- the server time sent with every read, and measures its member's reaction
-- from the SHOOT! it showed, so a clock offset never makes a duel unfair.
-- Leaving a duel after SHOOT! loses it; leaving before closes the room.


-- ---------------------------------------------------------------------------
-- 1. Online results live beside ghost results
-- ---------------------------------------------------------------------------

alter table public.duel_rounds alter column opponent_ms drop not null;
alter table public.duel_rounds drop constraint duel_rounds_opponent_ms_check;
alter table public.duel_rounds add constraint duel_rounds_opponent_ms_check
  check (opponent_ms between 100 and 5000);
alter table public.duel_rounds add column kind text not null default 'ghost'
  check (kind in ('ghost', 'live'));


-- The member's history, as in 202610210001, with a steady order for duels
-- that finished in the same instant (both sides of an online duel do).
create or replace function public.duel_record()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  rec public.duel_records;
begin
  select * into rec from public.duel_records r where r.user_id = actor_id;

  return jsonb_build_object(
    'kills', coalesce(rec.kills, 0),
    'deaths', coalesce(rec.deaths, 0),
    'draws', coalesce(rec.draws, 0),
    'bestMs', rec.best_reaction_ms,
    'averageMs', case when coalesce(rec.reaction_count, 0) > 0
      then round(rec.reaction_sum_ms::numeric / rec.reaction_count)::integer end,
    'shots', coalesce(rec.reaction_count, 0),
    'listed', coalesce(rec.listed, true),
    'history', coalesce((
      select jsonb_agg(h.item order by h.finished_at desc, h.started_at desc, h.id desc)
      from (
        select d.finished_at, d.started_at, d.id, jsonb_build_object(
          'opponentName', p.display_name,
          'opponentPublicId', p.public_id,
          'outcome', d.outcome,
          'youMs', d.reaction_ms,
          'themMs', d.opponent_ms,
          'fouls', d.fouls,
          'at', d.finished_at
        ) as item
        from public.duel_rounds d
        join public.profiles p on p.user_id = d.opponent_id
        where d.challenger_id = actor_id
          and d.finished_at is not null
        order by d.finished_at desc, d.started_at desc, d.id desc
        limit 6
      ) h
    ), '[]'::jsonb),
    'practice', coalesce((
      select jsonb_object_agg(s.level, jsonb_build_object(
        'tries', s.tries,
        'hits', s.hits,
        'bestMs', s.best_ms,
        'averageMs', s.average_ms
      ))
      from (
        select
          ps.level,
          count(*)::integer as tries,
          count(*) filter (where ps.hit)::integer as hits,
          min(ps.reaction_ms) filter (where not ps.foul) as best_ms,
          round(avg(ps.reaction_ms) filter (where not ps.foul))::integer as average_ms
        from public.duel_practice_shots ps
        where ps.user_id = actor_id
        group by ps.level
      ) s
    ), '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Rooms
-- ---------------------------------------------------------------------------

create table public.duel_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references public.profiles (user_id) on delete cascade,
  guest_id uuid references public.profiles (user_id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'playing', 'finished', 'closed')),
  -- A duel is one fight to a result; a round restarts it after a foul.
  duel_no integer not null default 0,
  round_no integer not null default 0,
  starts_at timestamptz,
  signal_at timestamptz,
  host_fouls smallint not null default 0 check (host_fouls between 0 and 2),
  guest_fouls smallint not null default 0 check (guest_fouls between 0 and 2),
  host_shot boolean not null default false,
  guest_shot boolean not null default false,
  host_reaction integer check (host_reaction between 100 and 5000),
  guest_reaction integer check (guest_reaction between 100 and 5000),
  last_foul text check (last_foul in ('host', 'guest')),
  outcome text check (outcome in ('host', 'guest', 'draw')),
  outcome_reason text check (outcome_reason in ('shots', 'fouls', 'left', 'no_shots')),
  host_rematch boolean not null default false,
  guest_rematch boolean not null default false,
  host_seen_at timestamptz not null default now(),
  guest_seen_at timestamptz,
  created_at timestamptz not null default now(),
  check (guest_id is null or guest_id <> host_id)
);
create index duel_rooms_open on public.duel_rooms (status, host_seen_at desc);
create unique index duel_rooms_one_open_per_host on public.duel_rooms (host_id) where status = 'open';

alter table public.duel_rooms enable row level security;
revoke all on public.duel_rooms from public, anon, authenticated;
grant select on public.duel_rooms to authenticated;
create policy duel_rooms_read_own on public.duel_rooms
  for select to authenticated
  using (host_id = private.current_user_id() or guest_id = private.current_user_id());


-- ---------------------------------------------------------------------------
-- 3. Rules
-- ---------------------------------------------------------------------------

-- A fresh round: the standoff starts after `lead`, SHOOT! 2.8 to 9.3 s later.
create function private.duel_room_new_round(room_id uuid, lead interval)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.duel_rooms r
  set round_no = r.round_no + 1,
      starts_at = now() + lead,
      signal_at = now() + lead + make_interval(secs => 2.8 + random() * 6.5),
      host_shot = false,
      guest_shot = false,
      host_reaction = null,
      guest_reaction = null
  where r.id = room_id;
$$;
revoke all on function private.duel_room_new_round(uuid, interval) from public;

-- Records one member's side of a finished online duel.
create function private.duel_room_record(
  member_id uuid,
  opponent_id uuid,
  result text,
  reaction integer,
  opponent_reaction integer,
  fouls integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.duel_records as r (user_id, kills, deaths, draws)
  values (member_id, (result = 'win')::integer, (result = 'lose')::integer, (result = 'draw')::integer)
  on conflict (user_id) do update
    set kills = r.kills + excluded.kills,
        deaths = r.deaths + excluded.deaths,
        draws = r.draws + excluded.draws,
        updated_at = now();
  if reaction is not null then
    perform private.duel_add_reaction(member_id, reaction);
  end if;
  insert into public.duel_rounds
    (challenger_id, opponent_id, opponent_ms, started_at, finished_at, outcome, reaction_ms, fouls, kind)
  values
    (member_id, opponent_id, opponent_reaction, now(), now(), result, reaction, least(fouls, 2), 'live');
end;
$$;
revoke all on function private.duel_room_record(uuid, uuid, text, integer, integer, integer) from public;

-- Ends the room's duel with `winner` ('host', 'guest' or 'draw') and records it for both.
create function private.duel_room_finish(room_id uuid, winner text, reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room public.duel_rooms;
begin
  update public.duel_rooms r
  set status = 'finished', outcome = winner, outcome_reason = reason,
      host_rematch = false, guest_rematch = false
  where r.id = room_id and r.outcome is null
  returning * into room;
  if room.id is null then
    return;
  end if;
  perform private.duel_room_record(
    room.host_id, room.guest_id,
    case winner when 'host' then 'win' when 'guest' then 'lose' else 'draw' end,
    room.host_reaction, room.guest_reaction, room.host_fouls
  );
  perform private.duel_room_record(
    room.guest_id, room.host_id,
    case winner when 'guest' then 'win' when 'host' then 'lose' else 'draw' end,
    room.guest_reaction, room.host_reaction, room.guest_fouls
  );
end;
$$;
revoke all on function private.duel_room_finish(uuid, text, text) from public;

-- Decides a round from both shots: faster wins, within 15 ms is a draw, one
-- shot beats none, and no shots at all is a draw.
create function private.duel_room_decide_shots(room_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room public.duel_rooms;
begin
  select * into room from public.duel_rooms r where r.id = room_id;
  perform private.duel_room_finish(
    room_id,
    case
      when room.host_reaction is null and room.guest_reaction is null then 'draw'
      when room.guest_reaction is null then 'host'
      when room.host_reaction is null then 'guest'
      when abs(room.host_reaction - room.guest_reaction) <= 15 then 'draw'
      when room.host_reaction < room.guest_reaction then 'host'
      else 'guest'
    end,
    case when room.host_reaction is null and room.guest_reaction is null then 'no_shots' else 'shots' end
  );
end;
$$;
revoke all on function private.duel_room_decide_shots(uuid) from public;

-- Moves a playing room on by the clock: a round whose shots are all in, or
-- whose time ran out (4 s after SHOOT!), is decided; a member gone for 15 s
-- loses a live round, or closes the room before SHOOT!.
create function private.duel_room_advance(room_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room public.duel_rooms;
  host_gone boolean;
  guest_gone boolean;
begin
  select * into room from public.duel_rooms r where r.id = room_id for update;
  if room.status = 'open' and room.host_seen_at < now() - interval '30 seconds' then
    update public.duel_rooms r set status = 'closed' where r.id = room_id;
    return;
  end if;
  if room.status <> 'playing' or room.outcome is not null then
    return;
  end if;
  host_gone := room.host_seen_at < now() - interval '15 seconds';
  guest_gone := coalesce(room.guest_seen_at, room.created_at) < now() - interval '15 seconds';
  if host_gone or guest_gone then
    if room.signal_at <= now() and not (host_gone and guest_gone) then
      perform private.duel_room_finish(room_id, case when host_gone then 'guest' else 'host' end, 'left');
    else
      update public.duel_rooms r set status = 'closed' where r.id = room_id;
    end if;
    return;
  end if;
  if (room.host_shot and room.guest_shot) or now() > room.signal_at + interval '4 seconds' then
    perform private.duel_room_decide_shots(room_id);
  end if;
end;
$$;
revoke all on function private.duel_room_advance(uuid) from public;

-- The room as one member sees it. The other member's reaction is shown only
-- once the duel is decided.
create function private.duel_room_view(room_id uuid, member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  room public.duel_rooms;
  me text;
  other_id uuid;
  other jsonb;
  rec public.duel_records;
begin
  select * into room from public.duel_rooms r where r.id = room_id;
  me := case when room.host_id = member_id then 'host' else 'guest' end;
  other_id := case me when 'host' then room.guest_id else room.host_id end;
  if other_id is not null then
    select jsonb_build_object(
      'publicId', p.public_id,
      'displayName', p.display_name,
      'avatarObjectKey', p.avatar_object_key,
      'avatarPreset', p.avatar_preset,
      'externalAvatarUrl', p.external_avatar_url,
      'averageMs', case when coalesce(d.reaction_count, 0) > 0
        then round(d.reaction_sum_ms::numeric / d.reaction_count)::integer end
    ) into other
    from public.profiles p
    left join public.duel_records d on d.user_id = p.user_id
    where p.user_id = other_id;
  end if;
  select * into rec from public.duel_records r where r.user_id = member_id;

  return jsonb_build_object(
    'roomId', room.id,
    'code', room.code,
    'status', room.status,
    'role', me,
    'opponent', other,
    'duelNo', room.duel_no,
    'round', case when room.round_no = 0 then null else jsonb_build_object(
      'number', room.round_no,
      'startsAt', room.starts_at,
      'signalAt', room.signal_at,
      'yourFouls', case me when 'host' then room.host_fouls else room.guest_fouls end,
      'theirFouls', case me when 'host' then room.guest_fouls else room.host_fouls end,
      'youShot', case me when 'host' then room.host_shot else room.guest_shot end,
      'theyShot', case me when 'host' then room.guest_shot else room.host_shot end,
      'lastFoul', case when room.last_foul is null then null
        when room.last_foul = me then 'you' else 'them' end
    ) end,
    'result', case when room.outcome is null then null else jsonb_build_object(
      'outcome', case when room.outcome = 'draw' then 'draw'
        when room.outcome = me then 'win' else 'lose' end,
      'reason', room.outcome_reason,
      'youMs', case me when 'host' then room.host_reaction else room.guest_reaction end,
      'themMs', case me when 'host' then room.guest_reaction else room.host_reaction end,
      'yourFouls', case me when 'host' then room.host_fouls else room.guest_fouls end,
      'theirFouls', case me when 'host' then room.guest_fouls else room.host_fouls end,
      'kills', coalesce(rec.kills, 0),
      'deaths', coalesce(rec.deaths, 0),
      'draws', coalesce(rec.draws, 0)
    ) end,
    'rematch', jsonb_build_object(
      'you', case me when 'host' then room.host_rematch else room.guest_rematch end,
      'them', case me when 'host' then room.guest_rematch else room.host_rematch end
    ),
    'serverNow', floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );
end;
$$;
revoke all on function private.duel_room_view(uuid, uuid) from public;

-- The caller's room, or an error when they are not in it.
create function private.duel_room_for(room_id uuid, member_id uuid)
returns public.duel_rooms
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  room public.duel_rooms;
begin
  select * into room from public.duel_rooms r
  where r.id = room_id and (r.host_id = member_id or r.guest_id = member_id);
  if room.id is null then
    raise exception using errcode = 'P0002', message = 'duel_room_not_found';
  end if;
  return room;
end;
$$;
revoke all on function private.duel_room_for(uuid, uuid) from public;


-- ---------------------------------------------------------------------------
-- 4. Opening, finding and joining
-- ---------------------------------------------------------------------------

-- Opens a room for the caller, closing any room they still had open.
create function public.open_duel_room()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  room_id uuid;
begin
  update public.duel_rooms r set status = 'closed'
  where r.host_id = actor_id and r.status = 'open';
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.duel_rooms r where r.code = new_code);
  end loop;
  insert into public.duel_rooms (code, host_id) values (new_code, actor_id) returning id into room_id;
  return private.duel_room_view(room_id, actor_id);
end;
$$;
revoke all on function public.open_duel_room() from public, anon;
grant execute on function public.open_duel_room() to authenticated;

-- Rooms waiting for a challenger, newest first; never the caller's own.
create function public.list_open_duel_rooms()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
begin
  return coalesce((
    select jsonb_agg(x.item order by x.created_at desc)
    from (
      select r.created_at, jsonb_build_object(
        'code', r.code,
        'openedAt', r.created_at,
        'host', jsonb_build_object(
          'publicId', p.public_id,
          'displayName', p.display_name,
          'avatarObjectKey', p.avatar_object_key,
          'avatarPreset', p.avatar_preset,
          'externalAvatarUrl', p.external_avatar_url,
          'averageMs', case when coalesce(d.reaction_count, 0) > 0
            then round(d.reaction_sum_ms::numeric / d.reaction_count)::integer end
        )
      ) as item
      from public.duel_rooms r
      join public.profiles p on p.user_id = r.host_id
      left join public.duel_records d on d.user_id = r.host_id
      where r.status = 'open'
        and r.host_id <> actor_id
        and r.host_seen_at > now() - interval '30 seconds'
        and not exists (
          select 1 from public.account_restrictions x
          where x.user_id = r.host_id and x.lifted_at is null
            and (x.expires_at is null or x.expires_at > now())
        )
      order by r.created_at desc
      limit 20
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_open_duel_rooms() from public, anon;
grant execute on function public.list_open_duel_rooms() to authenticated;

-- Joins an open room by its code; the duel starts 6 s later. A host using
-- their own code is shown their room.
-- Refusals: duel_room_not_found, duel_room_unavailable (already taken or gone).
create function public.join_duel_room(room_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  room public.duel_rooms;
begin
  select * into room from public.duel_rooms r where r.code = upper(trim(room_code)) for update;
  if room.id is null then
    raise exception using errcode = 'P0002', message = 'duel_room_not_found';
  end if;
  if room.host_id = actor_id or room.guest_id = actor_id then
    return private.duel_room_view(room.id, actor_id);
  end if;
  if room.status <> 'open' or room.host_seen_at < now() - interval '30 seconds' then
    raise exception using errcode = 'P0001', message = 'duel_room_unavailable';
  end if;
  update public.duel_rooms r
  set guest_id = actor_id, guest_seen_at = now(), status = 'playing', duel_no = 1,
      host_fouls = 0, guest_fouls = 0, last_foul = null
  where r.id = room.id;
  perform private.duel_room_new_round(room.id, interval '6 seconds');
  return private.duel_room_view(room.id, actor_id);
end;
$$;
revoke all on function public.join_duel_room(text) from public, anon;
grant execute on function public.join_duel_room(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Playing
-- ---------------------------------------------------------------------------

-- The room now, as the caller sees it. Reading it keeps the caller present.
create function public.duel_room_state(room_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  room public.duel_rooms := private.duel_room_for(room_id, actor_id);
begin
  update public.duel_rooms r
  set host_seen_at = case when r.host_id = actor_id then now() else r.host_seen_at end,
      guest_seen_at = case when r.guest_id = actor_id then now() else r.guest_seen_at end
  where r.id = room.id;
  perform private.duel_room_advance(room.id);
  return private.duel_room_view(room.id, actor_id);
end;
$$;
revoke all on function public.duel_room_state(uuid) from public, anon;
grant execute on function public.duel_room_state(uuid) to authenticated;

-- The caller's shot in round `round_number`: a reaction in ms after their
-- SHOOT!, or a foul. A first foul restarts the round for both; a second loses.
-- A shot for an old round, or a second shot, changes nothing.
-- Refusals: duel_room_not_found, duel_reaction_invalid.
create function public.submit_duel_room_shot(
  room_id uuid,
  round_number integer,
  reaction_ms integer,
  foul boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  room public.duel_rooms := private.duel_room_for(room_id, actor_id);
  me text;
  fouls integer;
begin
  if foul is null or (not foul and (reaction_ms is null or reaction_ms not between 100 and 5000)) then
    raise exception using errcode = '22023', message = 'duel_reaction_invalid';
  end if;
  select * into room from public.duel_rooms r where r.id = room.id for update;
  me := case when room.host_id = actor_id then 'host' else 'guest' end;

  if room.status = 'playing' and room.outcome is null and room.round_no = round_number
     and not (case me when 'host' then room.host_shot else room.guest_shot end) then
    if foul then
      fouls := (case me when 'host' then room.host_fouls else room.guest_fouls end) + 1;
      update public.duel_rooms r
      set host_fouls = case when me = 'host' then fouls else r.host_fouls end,
          guest_fouls = case when me = 'guest' then fouls else r.guest_fouls end,
          last_foul = me
      where r.id = room.id;
      if fouls >= 2 then
        update public.duel_rooms r
        set host_reaction = case when me = 'host' then null else r.host_reaction end,
            guest_reaction = case when me = 'guest' then null else r.guest_reaction end
        where r.id = room.id;
        perform private.duel_room_finish(room.id, case me when 'host' then 'guest' else 'host' end, 'fouls');
      else
        perform private.duel_room_new_round(room.id, interval '2.5 seconds');
      end if;
    else
      update public.duel_rooms r
      set host_shot = case when me = 'host' then true else r.host_shot end,
          guest_shot = case when me = 'guest' then true else r.guest_shot end,
          host_reaction = case when me = 'host' then submit_duel_room_shot.reaction_ms else r.host_reaction end,
          guest_reaction = case when me = 'guest' then submit_duel_room_shot.reaction_ms else r.guest_reaction end
      where r.id = room.id;
      perform private.duel_room_advance(room.id);
    end if;
  end if;
  return private.duel_room_view(room.id, actor_id);
end;
$$;
revoke all on function public.submit_duel_room_shot(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.submit_duel_room_shot(uuid, integer, integer, boolean) to authenticated;

-- Asks for a rematch; when both have asked, the next duel starts 4 s later.
create function public.rematch_duel_room(room_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  room public.duel_rooms := private.duel_room_for(room_id, actor_id);
begin
  select * into room from public.duel_rooms r where r.id = room.id for update;
  if room.status = 'finished' then
    update public.duel_rooms r
    set host_rematch = case when r.host_id = actor_id then true else r.host_rematch end,
        guest_rematch = case when r.guest_id = actor_id then true else r.guest_rematch end
    where r.id = room.id
    returning * into room;
    if room.host_rematch and room.guest_rematch then
      update public.duel_rooms r
      set status = 'playing', duel_no = r.duel_no + 1, outcome = null, outcome_reason = null,
          host_fouls = 0, guest_fouls = 0, last_foul = null,
          host_rematch = false, guest_rematch = false
      where r.id = room.id;
      perform private.duel_room_new_round(room.id, interval '4 seconds');
    end if;
  end if;
  return private.duel_room_view(room.id, actor_id);
end;
$$;
revoke all on function public.rematch_duel_room(uuid) from public, anon;
grant execute on function public.rematch_duel_room(uuid) to authenticated;

-- Leaves the room. After SHOOT! of an undecided duel, leaving loses it.
create function public.leave_duel_room(room_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  room public.duel_rooms := private.duel_room_for(room_id, actor_id);
begin
  select * into room from public.duel_rooms r where r.id = room.id for update;
  if room.status = 'playing' and room.outcome is null and room.signal_at <= now() then
    perform private.duel_room_finish(
      room.id, case when room.host_id = actor_id then 'guest' else 'host' end, 'left'
    );
  end if;
  update public.duel_rooms r set status = 'closed' where r.id = room.id;
end;
$$;
revoke all on function public.leave_duel_room(uuid) from public, anon;
grant execute on function public.leave_duel_room(uuid) to authenticated;
