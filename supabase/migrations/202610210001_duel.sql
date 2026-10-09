-- Migration: 202610210001_duel.sql
--
-- Request of 2026-10-09: the Duel, a quick-draw minigame
-- (design_handoff_vaultix_duel), played against other members as ghosts.
--
--   * A member's record (kills, deaths, draws) and their reaction times live
--     here, per account, so they follow the member to any device.
--   * The opponents are real members who have played: their ghost shoots at a
--     time drawn from that member's real average reaction, never faster than
--     their real fastest. Only each member's average and fastest are shown to
--     others; the ghost's owner is never told and their record never changes.
--   * The database picks the ghost's time when a round starts and decides the
--     outcome when it finishes, so a browser cannot choose a slow opponent or
--     claim a win the times do not support. The browser still measures the
--     member's own reaction; a value under 100 ms is refused as impossible.
--   * A member can hide their ghost from the opponent list at any time.
--
-- Nothing here touches money, entitlements or moderation.


-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One row per member who has played. Reaction totals include duel shots and
-- practice shots, never a foul.
create table public.duel_records (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  kills integer not null default 0 check (kills >= 0),
  deaths integer not null default 0 check (deaths >= 0),
  draws integer not null default 0 check (draws >= 0),
  reaction_sum_ms bigint not null default 0 check (reaction_sum_ms >= 0),
  reaction_count integer not null default 0 check (reaction_count >= 0),
  best_reaction_ms integer check (best_reaction_ms between 100 and 5000),
  -- Whether other members may duel this member's ghost.
  listed boolean not null default true,
  updated_at timestamptz not null default now()
);

-- One row per duel against a ghost. Opened by start_duel(), closed once by
-- finish_duel(); an unfinished round simply expires.
create table public.duel_rounds (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles (user_id) on delete cascade,
  opponent_id uuid not null references public.profiles (user_id) on delete cascade,
  opponent_ms integer not null check (opponent_ms between 100 and 1000),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('win', 'lose', 'draw')),
  reaction_ms integer check (reaction_ms between 100 and 5000),
  fouls smallint check (fouls between 0 and 2),
  check (challenger_id <> opponent_id),
  check ((finished_at is null) = (outcome is null))
);
create index duel_rounds_challenger_started on public.duel_rounds (challenger_id, started_at desc);
create index duel_rounds_opponent on public.duel_rounds (opponent_id);

-- One row per shot on the practice field.
create table public.duel_practice_shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  level text not null check (level in ('easy', 'normal', 'hard', 'deadeye', 'legend')),
  target_ms integer not null,
  reaction_ms integer check (reaction_ms between 100 and 5000),
  foul boolean not null default false,
  hit boolean not null,
  created_at timestamptz not null default now()
);
create index duel_practice_shots_user_created on public.duel_practice_shots (user_id, created_at desc);

-- Every write goes through the functions below; a member reads only their own rows.
alter table public.duel_records enable row level security;
alter table public.duel_rounds enable row level security;
alter table public.duel_practice_shots enable row level security;
revoke all on public.duel_records, public.duel_rounds, public.duel_practice_shots
  from public, anon, authenticated;
grant select on public.duel_records, public.duel_rounds, public.duel_practice_shots to authenticated;

create policy duel_records_read_own on public.duel_records
  for select to authenticated
  using (user_id = private.current_user_id());
create policy duel_rounds_read_own on public.duel_rounds
  for select to authenticated
  using (challenger_id = private.current_user_id());
create policy duel_practice_shots_read_own on public.duel_practice_shots
  for select to authenticated
  using (user_id = private.current_user_id());


-- ---------------------------------------------------------------------------
-- 2. Rules shared by the functions
-- ---------------------------------------------------------------------------

-- The practice targets, as in src/contracts/duel.ts. Null for an unknown level.
create function private.duel_practice_target(level text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case level
    when 'easy' then 700
    when 'normal' then 480
    when 'hard' then 350
    when 'deadeye' then 270
    when 'legend' then 210
  end;
$$;
revoke all on function private.duel_practice_target(text) from public;

-- The signed-in member with a profile, or an error.
create function private.duel_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
begin
  if actor_id is null or not exists (select 1 from public.profiles p where p.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'duel_auth_required';
  end if;
  if not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;
  return actor_id;
end;
$$;
revoke all on function private.duel_actor() from public;

-- Adds one clean reaction to a member's totals.
create function private.duel_add_reaction(member_id uuid, reaction integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.duel_records as r (user_id, reaction_sum_ms, reaction_count, best_reaction_ms)
  values (member_id, reaction, 1, reaction)
  on conflict (user_id) do update
    set reaction_sum_ms = r.reaction_sum_ms + excluded.reaction_sum_ms,
        reaction_count = r.reaction_count + 1,
        best_reaction_ms = least(coalesce(r.best_reaction_ms, excluded.best_reaction_ms), excluded.best_reaction_ms),
        updated_at = now();
$$;
revoke all on function private.duel_add_reaction(uuid, integer) from public;

-- Whether a member's ghost may be challenged: listed, enough shots to have a
-- real average, and not restricted.
create function private.duel_ghost_available(member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.duel_records r
    where r.user_id = member_id
      and r.listed
      and r.reaction_count >= 5
      and r.best_reaction_ms is not null
  )
  and not exists (
    select 1
    from public.account_restrictions x
    where x.user_id = member_id
      and x.lifted_at is null
      and (x.expires_at is null or x.expires_at > now())
  );
$$;
revoke all on function private.duel_ghost_available(uuid) from public;


-- ---------------------------------------------------------------------------
-- 3. Reads
-- ---------------------------------------------------------------------------

-- The caller's own record: totals, the last six duels and practice per level.
create function public.duel_record()
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
      select jsonb_agg(h.item order by h.finished_at desc)
      from (
        select d.finished_at, jsonb_build_object(
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
        order by d.finished_at desc
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
revoke all on function public.duel_record() from public, anon;
grant execute on function public.duel_record() to authenticated;

-- The ghosts the caller may challenge, fastest first, with the caller's own
-- wins, losses and draws against each.
create function public.list_duel_opponents()
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
    select jsonb_agg(o.item order by o.average_ms, o.public_id)
    from (
      select
        p.public_id,
        round(r.reaction_sum_ms::numeric / r.reaction_count)::integer as average_ms,
        jsonb_build_object(
          'publicId', p.public_id,
          'displayName', p.display_name,
          'avatarObjectKey', p.avatar_object_key,
          'avatarPreset', p.avatar_preset,
          'externalAvatarUrl', p.external_avatar_url,
          'institutionName', (
            select i.name
            from public.institution_memberships m
            join public.institutions i on i.id = m.institution_id
            where m.user_id = p.user_id
              and m.verification_state = 'verified'
            order by m.verified_at desc
            limit 1
          ),
          'averageMs', round(r.reaction_sum_ms::numeric / r.reaction_count)::integer,
          'bestMs', r.best_reaction_ms,
          'wins', (select count(*) from public.duel_rounds d
                   where d.challenger_id = actor_id and d.opponent_id = p.user_id and d.outcome = 'win'),
          'losses', (select count(*) from public.duel_rounds d
                     where d.challenger_id = actor_id and d.opponent_id = p.user_id and d.outcome = 'lose'),
          'draws', (select count(*) from public.duel_rounds d
                    where d.challenger_id = actor_id and d.opponent_id = p.user_id and d.outcome = 'draw')
        ) as item
      from public.duel_records r
      join public.profiles p on p.user_id = r.user_id
      where r.user_id <> actor_id
        and private.duel_ghost_available(r.user_id)
      order by r.reaction_sum_ms::numeric / r.reaction_count, p.public_id
      limit 40
    ) o
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.list_duel_opponents() from public, anon;
grant execute on function public.list_duel_opponents() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Playing
-- ---------------------------------------------------------------------------

-- Opens a round against a member's ghost and draws the ghost's reaction:
-- around their average, spread by how far their fastest is below it, never
-- faster than their fastest, between 160 and 1000 ms.
-- Refusals: duel_auth_required, EMAIL_NOT_VERIFIED, duel_opponent_unavailable,
-- duel_too_soon (another round started under 3 seconds ago).
create function public.start_duel(opponent_public_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  opponent uuid;
  rec public.duel_records;
  average numeric;
  spread numeric;
  floor_ms numeric;
  ghost_ms integer;
  round_id uuid;
begin
  select p.user_id into opponent from public.profiles p where p.public_id = opponent_public_id;
  if opponent is null or opponent = actor_id or not private.duel_ghost_available(opponent) then
    raise exception using errcode = 'P0002', message = 'duel_opponent_unavailable';
  end if;
  if exists (
    select 1 from public.duel_rounds d
    where d.challenger_id = actor_id and d.started_at > now() - interval '3 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'duel_too_soon';
  end if;

  select * into rec from public.duel_records r where r.user_id = opponent;
  average := rec.reaction_sum_ms::numeric / rec.reaction_count;
  spread := least(90, greatest(20, (average - rec.best_reaction_ms) / 2));
  floor_ms := greatest(rec.best_reaction_ms, 160);
  ghost_ms := round(least(1000, greatest(
    floor_ms,
    average + (random() + random() + random() - 1.5) * 1.4 * spread
  )))::integer;

  insert into public.duel_rounds (challenger_id, opponent_id, opponent_ms)
  values (actor_id, opponent, ghost_ms)
  returning id into round_id;

  return jsonb_build_object('roundId', round_id, 'opponentMs', ghost_ms);
end;
$$;
revoke all on function public.start_duel(uuid) from public, anon;
grant execute on function public.start_duel(uuid) to authenticated;

-- Closes a round with the caller's reaction (null for no shot) and fouls, and
-- decides it: two fouls or no shot lose; within 15 ms of the ghost is a draw;
-- faster wins. Closing a closed round answers the same result again.
-- Refusals: duel_auth_required, EMAIL_NOT_VERIFIED, duel_round_not_found,
-- duel_round_expired (over 3 minutes old), duel_round_too_fast (closed under
-- 3 seconds after it opened), duel_reaction_invalid.
create function public.finish_duel(round_id uuid, reaction_ms integer, fouls integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  rnd public.duel_rounds;
  decided text;
  counted integer;
  rec public.duel_records;
begin
  select * into rnd from public.duel_rounds d
  where d.id = round_id and d.challenger_id = actor_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'duel_round_not_found';
  end if;

  if rnd.finished_at is null then
    if rnd.started_at < now() - interval '3 minutes' then
      raise exception using errcode = 'P0001', message = 'duel_round_expired';
    end if;
    if rnd.started_at > now() - interval '3 seconds' then
      raise exception using errcode = 'P0001', message = 'duel_round_too_fast';
    end if;
    if fouls is null or fouls not between 0 and 2
      or (reaction_ms is not null and reaction_ms not between 100 and 5000) then
      raise exception using errcode = '22023', message = 'duel_reaction_invalid';
    end if;

    counted := case when fouls >= 2 then null else reaction_ms end;
    decided := case
      when counted is null then 'lose'
      when counted < rnd.opponent_ms - 15 then 'win'
      when counted <= rnd.opponent_ms + 15 then 'draw'
      else 'lose'
    end;

    update public.duel_rounds d
      set finished_at = now(), outcome = decided, reaction_ms = counted, fouls = finish_duel.fouls
      where d.id = rnd.id
      returning * into rnd;

    insert into public.duel_records as r (user_id, kills, deaths, draws)
    values (
      actor_id,
      (decided = 'win')::integer,
      (decided = 'lose')::integer,
      (decided = 'draw')::integer
    )
    on conflict (user_id) do update
      set kills = r.kills + excluded.kills,
          deaths = r.deaths + excluded.deaths,
          draws = r.draws + excluded.draws,
          updated_at = now();
    if counted is not null then
      perform private.duel_add_reaction(actor_id, counted);
    end if;
  end if;

  select * into rec from public.duel_records r where r.user_id = actor_id;
  return jsonb_build_object(
    'outcome', rnd.outcome,
    'youMs', rnd.reaction_ms,
    'themMs', rnd.opponent_ms,
    'fouls', rnd.fouls,
    'kills', rec.kills,
    'deaths', rec.deaths,
    'draws', rec.draws
  );
end;
$$;
revoke all on function public.finish_duel(uuid, integer, integer) from public, anon;
grant execute on function public.finish_duel(uuid, integer, integer) to authenticated;

-- Records one practice shot. A hit beats the level's target; a foul never hits.
-- Refusals: duel_auth_required, EMAIL_NOT_VERIFIED, duel_reaction_invalid,
-- duel_too_soon (another practice shot under 2 seconds ago).
create function public.record_duel_practice(level text, reaction_ms integer, foul boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  target integer := private.duel_practice_target(level);
  counted integer;
  scored boolean;
begin
  if target is null or foul is null
    or (reaction_ms is not null and reaction_ms not between 100 and 5000) then
    raise exception using errcode = '22023', message = 'duel_reaction_invalid';
  end if;
  if exists (
    select 1 from public.duel_practice_shots s
    where s.user_id = actor_id and s.created_at > now() - interval '2 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'duel_too_soon';
  end if;

  counted := case when foul then null else reaction_ms end;
  scored := counted is not null and counted < target;
  insert into public.duel_practice_shots (user_id, level, target_ms, reaction_ms, foul, hit)
  values (actor_id, level, target, counted, foul, scored);
  if counted is not null then
    perform private.duel_add_reaction(actor_id, counted);
  end if;

  return jsonb_build_object('hit', scored, 'targetMs', target, 'youMs', counted);
end;
$$;
revoke all on function public.record_duel_practice(text, integer, boolean) from public, anon;
grant execute on function public.record_duel_practice(text, integer, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. The member's own choices
-- ---------------------------------------------------------------------------

-- Shows or hides the caller's ghost in other members' opponent lists.
create function public.set_duel_listing(listed boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
begin
  if listed is null then
    raise exception using errcode = '22023', message = 'duel_listing_invalid';
  end if;
  insert into public.duel_records as r (user_id, listed)
  values (actor_id, set_duel_listing.listed)
  on conflict (user_id) do update set listed = excluded.listed, updated_at = now();
  return set_duel_listing.listed;
end;
$$;
revoke all on function public.set_duel_listing(boolean) from public, anon;
grant execute on function public.set_duel_listing(boolean) to authenticated;

-- Wipes the caller's own record: their duels, practice shots and totals. Duels
-- other members fought against this member's ghost stay in their records.
-- The listing choice is kept.
create function public.reset_duel_record()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
begin
  delete from public.duel_rounds d where d.challenger_id = actor_id;
  delete from public.duel_practice_shots s where s.user_id = actor_id;
  update public.duel_records r
    set kills = 0, deaths = 0, draws = 0, reaction_sum_ms = 0, reaction_count = 0,
        best_reaction_ms = null, updated_at = now()
    where r.user_id = actor_id;
end;
$$;
revoke all on function public.reset_duel_record() from public, anon;
grant execute on function public.reset_duel_record() to authenticated;
