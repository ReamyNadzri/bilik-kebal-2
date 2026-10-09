-- Migration: 202610210002_duel_achievements.sql
--
-- Request of 2026-10-09: the Duel's top three by K/D on the front page, and 50
-- achievements that reset every month, three of which grant a free request.
--
-- Decisions (user, 2026-10-09):
--   * A reward is +1 free request through the existing allowance; no money.
--   * The leaderboard ranks all-time K/D, from 10 duels up.
--   * Only institution-verified members can claim a reward; anyone who can
--     duel earns the achievements themselves.
--
-- Progress is never stored: it is worked out from this month's own duels and
-- practice shots each time it is read, so the month's reset needs no job. A
-- month runs on Malaysia time. Only claimed rewards are stored, once per
-- member, achievement and month.
--
-- The reaction time behind every shot is measured by the browser, so the
-- rewards are tied to volume and variety (30 wins, 10 different hunters
-- beaten, 25 achievements), never to speed alone, and are capped at three
-- free requests a month.


-- ---------------------------------------------------------------------------
-- 1. The catalogue
-- ---------------------------------------------------------------------------

create table public.duel_achievements (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  sort smallint not null unique,
  category text not null,
  title text not null,
  description text not null,
  -- The monthly figure it counts, from private.duel_month_metrics().
  metric text not null,
  target integer not null check (target > 0),
  grants_free_request boolean not null default false
);

alter table public.duel_achievements enable row level security;
revoke all on public.duel_achievements from public, anon, authenticated;

insert into public.duel_achievements (sort, id, category, title, description, metric, target, grants_free_request) values
  (1,  'first_blood',   'Showdowns',  'First Blood',         'Win a duel.',                                            'wins',              1,  false),
  (2,  'duels_10',      'Showdowns',  'Saddle Up',           'Finish 10 duels.',                                       'duels',             10, false),
  (3,  'duels_25',      'Showdowns',  'Dust Eater',          'Finish 25 duels.',                                       'duels',             25, false),
  (4,  'duels_50',      'Showdowns',  'Tumbleweed',          'Finish 50 duels.',                                       'duels',             50, false),
  (5,  'wins_5',        'Showdowns',  'Gunslinger',          'Win 5 duels.',                                           'wins',              5,  false),
  (6,  'wins_15',       'Showdowns',  'Hired Gun',           'Win 15 duels.',                                          'wins',              15, false),
  (7,  'wins_30',       'Showdowns',  'Legend of the West',  'Win 30 duels.',                                          'wins',              30, true),
  (8,  'draws_1',       'Showdowns',  'Standoff',            'Draw a duel: both shots within 15 ms.',                  'draws',             1,  false),
  (9,  'draws_3',       'Showdowns',  'Mirror Image',        'Draw 3 duels.',                                          'draws',             3,  false),
  (10, 'losses_5',      'Grit',       'Back in the Saddle',  'Lose 5 duels and keep riding.',                          'losses',            5,  false),
  (11, 'faced_3',       'Rivals',     'New in Town',         'Duel 3 different hunters.',                              'opponents_faced',   3,  false),
  (12, 'faced_10',      'Rivals',     'Making the Rounds',   'Duel 10 different hunters.',                             'opponents_faced',   10, false),
  (13, 'beaten_5',      'Rivals',     'Wanted Poster',       'Beat 5 different hunters.',                              'opponents_beaten',  5,  false),
  (14, 'beaten_10',     'Rivals',     'Town Tamer',          'Beat 10 different hunters.',                             'opponents_beaten',  10, true),
  (15, 'revenge_1',     'Rivals',     'Payback',             'Beat a hunter who beat you earlier this month.',         'revenge_wins',      1,  false),
  (16, 'revenge_3',     'Rivals',     'Old Scores',          'Get payback 3 times.',                                   'revenge_wins',      3,  false),
  (17, 'rival_3',       'Rivals',     'Bad Blood',           'Beat the same hunter 3 times.',                          'rivalry',           3,  false),
  (18, 'deadeye_1',     'Rivals',     'Giant Slayer',        'Beat a ghost that fired in under 270 ms.',               'deadeye_wins',      1,  false),
  (19, 'deadeye_5',     'Rivals',     'Deadeye Hunter',      'Beat 5 ghosts that fired in under 270 ms.',              'deadeye_wins',      5,  false),
  (20, 'streak_3',      'Streaks',    'Hot Hand',            'Win 3 duels in a row.',                                  'best_streak',       3,  false),
  (21, 'streak_5',      'Streaks',    'On Fire',             'Win 5 duels in a row.',                                  'best_streak',       5,  false),
  (22, 'streak_10',     'Streaks',    'Untouchable',         'Win 10 duels in a row.',                                 'best_streak',       10, false),
  (23, 'clean_10',      'Grit',       'Steady Hands',        'Win 10 duels without a foul.',                           'clean_wins',        10, false),
  (24, 'comeback_1',    'Grit',       'Second Chance',       'Win a duel after dropping your gun.',                    'comeback_wins',     1,  false),
  (25, 'comeback_3',    'Grit',       'Nerves of Steel',     'Win 3 duels after dropping your gun.',                   'comeback_wins',     3,  false),
  (26, 'dominant_1',    'Grit',       'Too Slow, Partner',   'Win by 100 ms or more.',                                 'dominant_wins',     1,  false),
  (27, 'dominant_10',   'Grit',       'Outclassed',          'Win by 100 ms or more, 10 times.',                       'dominant_wins',     10, false),
  (28, 'close_1',       'Grit',       'Photo Finish',        'Win by 30 ms or less.',                                  'close_wins',        1,  false),
  (29, 'close_5',       'Grit',       'Hair Trigger',        'Win by 30 ms or less, 5 times.',                         'close_wins',        5,  false),
  (30, 'under_300_10',  'Speed',      'Quick Draw',          'Fire 10 clean shots under 300 ms, in duels or practice.', 'shots_under_300',  10, false),
  (31, 'under_250_1',   'Speed',      'Quicker',             'Fire a clean shot under 250 ms.',                        'shots_under_250',   1,  false),
  (32, 'under_250_10',  'Speed',      'Lightning',           'Fire 10 clean shots under 250 ms.',                      'shots_under_250',   10, false),
  (33, 'under_220_1',   'Speed',      'Faster Than Thought', 'Fire a clean shot under 220 ms.',                        'shots_under_220',   1,  false),
  (34, 'under_200_1',   'Speed',      'Blink',               'Fire a clean shot under 200 ms.',                        'shots_under_200',   1,  false),
  (35, 'under_200_5',   'Speed',      'Ghost Hand',          'Fire 5 clean shots under 200 ms.',                       'shots_under_200',   5,  false),
  (36, 'practice_10',   'Practice',   'Target Practice',     'Take 10 practice shots.',                                'practice_shots',    10, false),
  (37, 'practice_50',   'Practice',   'Range Regular',       'Take 50 practice shots.',                                'practice_shots',    50, false),
  (38, 'hits_25',       'Practice',   'Marksman',            'Hit 25 practice targets.',                               'practice_hits',     25, false),
  (39, 'hit_easy',      'Practice',   'Easy Does It',        'Hit the Easy target.',                                   'hits_easy',         1,  false),
  (40, 'hit_normal',    'Practice',   'By the Book',         'Hit the Normal target.',                                 'hits_normal',       1,  false),
  (41, 'hit_hard',      'Practice',   'Hard Nosed',          'Hit the Hard target.',                                   'hits_hard',         1,  false),
  (42, 'hit_deadeye',   'Practice',   'Bullseye',            'Hit the Deadeye target.',                                'hits_deadeye',      1,  false),
  (43, 'hit_legend',    'Practice',   'Living Legend',       'Hit the Legend target.',                                 'hits_legend',       1,  false),
  (44, 'all_levels',    'Practice',   'Full Range',          'Hit every practice level.',                              'levels_hit',        5,  false),
  (45, 'legend_5',      'Practice',   'Legend Five',         'Hit the Legend target 5 times.',                         'hits_legend',       5,  false),
  (46, 'days_3',        'Dedication', 'Regular',             'Play on 3 different days.',                              'active_days',       3,  false),
  (47, 'days_7',        'Dedication', 'Frontier Life',       'Play on 7 different days.',                              'active_days',       7,  false),
  (48, 'days_15',       'Dedication', 'Lifer',               'Play on 15 different days.',                             'active_days',       15, false),
  (49, 'night_owl',     'Dedication', 'Midnight Draw',       'Finish a duel between midnight and 5 am, Malaysia time.', 'night_duels',      1,  false),
  (50, 'hall_of_fame',  'Dedication', 'Hall of Fame',        'Complete 25 other achievements this month.',             'achievements',      25, true);

-- Claimed rewards: one per member, achievement and month, never edited.
create table public.duel_achievement_rewards (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  achievement_id text not null references public.duel_achievements (id),
  month date not null check (month = date_trunc('month', month)::date),
  granted_at timestamptz not null default now(),
  primary key (user_id, achievement_id, month)
);

alter table public.duel_achievement_rewards enable row level security;
revoke all on public.duel_achievement_rewards from public, anon, authenticated;
grant select on public.duel_achievement_rewards to authenticated;
create policy duel_achievement_rewards_read_own on public.duel_achievement_rewards
  for select to authenticated
  using (user_id = private.current_user_id());


-- ---------------------------------------------------------------------------
-- 2. The month and its figures
-- ---------------------------------------------------------------------------

-- The first day of the month on Malaysia time.
create function private.duel_month(at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', at at time zone 'Asia/Kuala_Lumpur')::date;
$$;
revoke all on function private.duel_month(timestamptz) from public;

-- When a Malaysia-time month (given by its first day) begins.
create function private.duel_month_start(month date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select month::timestamp at time zone 'Asia/Kuala_Lumpur';
$$;
revoke all on function private.duel_month_start(date) from public;

-- Every figure an achievement counts, for one member and one month.
create function private.duel_month_metrics(member_id uuid, month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select private.duel_month_start(month) as since,
           private.duel_month_start((month + interval '1 month')::date) as until
  ),
  d as (
    select r.id, r.opponent_id, r.outcome, r.reaction_ms, r.opponent_ms, r.fouls, r.finished_at,
           r.finished_at at time zone 'Asia/Kuala_Lumpur' as local_at
    from public.duel_rounds r, bounds b
    where r.challenger_id = member_id
      and r.finished_at >= b.since and r.finished_at < b.until
  ),
  p as (
    select s.level, s.reaction_ms, s.foul, s.hit,
           s.created_at at time zone 'Asia/Kuala_Lumpur' as local_at
    from public.duel_practice_shots s, bounds b
    where s.user_id = member_id
      and s.created_at >= b.since and s.created_at < b.until
  ),
  shots as (
    select d.reaction_ms from d where d.reaction_ms is not null
    union all
    select p.reaction_ms from p where p.reaction_ms is not null and not p.foul
  ),
  ordered as (
    select d.outcome,
           row_number() over (order by d.finished_at, d.id) as rn,
           row_number() over (partition by d.outcome = 'win' order by d.finished_at, d.id) as rk
    from d
  ),
  wins as (
    select * from d where d.outcome = 'win'
  )
  select jsonb_build_object(
    'duels', (select count(*) from d),
    'wins', (select count(*) from wins),
    'draws', (select count(*) from d where d.outcome = 'draw'),
    'losses', (select count(*) from d where d.outcome = 'lose'),
    'opponents_faced', (select count(distinct d.opponent_id) from d),
    'opponents_beaten', (select count(distinct w.opponent_id) from wins w),
    'revenge_wins', (
      select count(*) from wins w
      where exists (
        select 1 from d l
        where l.outcome = 'lose' and l.opponent_id = w.opponent_id and l.finished_at < w.finished_at
      )
    ),
    'rivalry', (
      select coalesce(max(c), 0) from (select count(*) as c from wins w group by w.opponent_id) x
    ),
    'deadeye_wins', (select count(*) from wins w where w.opponent_ms < 270),
    'best_streak', (
      select coalesce(max(c), 0)
      from (select count(*) as c from ordered o where o.outcome = 'win' group by o.rn - o.rk) x
    ),
    'clean_wins', (select count(*) from wins w where w.fouls = 0),
    'comeback_wins', (select count(*) from wins w where w.fouls = 1),
    'dominant_wins', (select count(*) from wins w where w.opponent_ms - w.reaction_ms >= 100),
    'close_wins', (select count(*) from wins w where w.opponent_ms - w.reaction_ms <= 30),
    'shots_under_300', (select count(*) from shots s where s.reaction_ms < 300),
    'shots_under_250', (select count(*) from shots s where s.reaction_ms < 250),
    'shots_under_220', (select count(*) from shots s where s.reaction_ms < 220),
    'shots_under_200', (select count(*) from shots s where s.reaction_ms < 200),
    'practice_shots', (select count(*) from p),
    'practice_hits', (select count(*) from p where p.hit),
    'hits_easy', (select count(*) from p where p.hit and p.level = 'easy'),
    'hits_normal', (select count(*) from p where p.hit and p.level = 'normal'),
    'hits_hard', (select count(*) from p where p.hit and p.level = 'hard'),
    'hits_deadeye', (select count(*) from p where p.hit and p.level = 'deadeye'),
    'hits_legend', (select count(*) from p where p.hit and p.level = 'legend'),
    'levels_hit', (select count(distinct p.level) from p where p.hit),
    'active_days', (
      select count(*) from (
        select d.local_at::date from d union select p.local_at::date from p
      ) x
    ),
    'night_duels', (select count(*) from d where extract(hour from d.local_at) < 5)
  );
$$;
revoke all on function private.duel_month_metrics(uuid, date) from public;

-- The member's achievements for a month: figure, target and whether done.
-- "Hall of Fame" counts the others, so it is worked out last.
create function private.duel_month_progress(member_id uuid, month date)
returns table (
  id text,
  sort smallint,
  category text,
  title text,
  description text,
  target integer,
  progress integer,
  done boolean,
  grants_free_request boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  figures jsonb := private.duel_month_metrics(member_id, month);
  completed integer;
begin
  select count(*) into completed
  from public.duel_achievements a
  where a.metric <> 'achievements'
    and coalesce((figures ->> a.metric)::integer, 0) >= a.target;
  figures := figures || jsonb_build_object('achievements', completed);

  return query
  select a.id, a.sort, a.category, a.title, a.description, a.target,
         least(coalesce((figures ->> a.metric)::integer, 0), a.target),
         coalesce((figures ->> a.metric)::integer, 0) >= a.target,
         a.grants_free_request
  from public.duel_achievements a
  order by a.sort;
end;
$$;
revoke all on function private.duel_month_progress(uuid, date) from public;

-- Whether a member may claim rewards: institution verified and not restricted.
create function private.duel_reward_eligible(member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.institution_memberships m
    where m.user_id = member_id and m.verification_state = 'verified'
  )
  and not exists (
    select 1 from public.account_restrictions x
    where x.user_id = member_id
      and x.lifted_at is null
      and (x.expires_at is null or x.expires_at > now())
  );
$$;
revoke all on function private.duel_reward_eligible(uuid) from public;


-- ---------------------------------------------------------------------------
-- 3. Reads and the one write
-- ---------------------------------------------------------------------------

-- The caller's achievements this month.
create function public.duel_achievements_this_month()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  this_month date := private.duel_month(now());
begin
  return jsonb_build_object(
    'month', to_char(this_month, 'YYYY-MM'),
    'resetsAt', private.duel_month_start((this_month + interval '1 month')::date),
    'rewardEligible', private.duel_reward_eligible(actor_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'category', g.category,
        'title', g.title,
        'description', g.description,
        'target', g.target,
        'progress', g.progress,
        'done', g.done,
        'grantsFreeRequest', g.grants_free_request,
        'claimed', exists (
          select 1 from public.duel_achievement_rewards r
          where r.user_id = actor_id and r.achievement_id = g.id and r.month = this_month
        )
      ) order by g.sort)
      from private.duel_month_progress(actor_id, this_month) g
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.duel_achievements_this_month() from public, anon;
grant execute on function public.duel_achievements_this_month() to authenticated;

-- Claims this month's free request for a finished reward achievement.
-- Returns 'claimed' or 'already_claimed'. Refusals: duel_auth_required,
-- EMAIL_NOT_VERIFIED, duel_achievement_not_found (unknown, or grants nothing),
-- duel_reward_not_eligible, duel_achievement_incomplete.
create function public.claim_duel_achievement(achievement_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  this_month date := private.duel_month(now());
  finished boolean;
  inserted text;
begin
  if not exists (
    select 1 from public.duel_achievements a
    where a.id = claim_duel_achievement.achievement_id and a.grants_free_request
  ) then
    raise exception using errcode = 'P0002', message = 'duel_achievement_not_found';
  end if;
  if not private.duel_reward_eligible(actor_id) then
    raise exception using errcode = '42501', message = 'duel_reward_not_eligible';
  end if;
  select g.done into finished
  from private.duel_month_progress(actor_id, this_month) g
  where g.id = claim_duel_achievement.achievement_id;
  if not coalesce(finished, false) then
    raise exception using errcode = 'P0001', message = 'duel_achievement_incomplete';
  end if;

  insert into public.duel_achievement_rewards (user_id, achievement_id, month)
  values (actor_id, claim_duel_achievement.achievement_id, this_month)
  on conflict do nothing
  returning public.duel_achievement_rewards.achievement_id into inserted;

  return case when inserted is null then 'already_claimed' else 'claimed' end;
end;
$$;
revoke all on function public.claim_duel_achievement(text) from public, anon;
grant execute on function public.claim_duel_achievement(text) to authenticated;

-- The top three hunters by all-time K/D, from 10 duels up. Hidden ghosts and
-- restricted members are left out. Ties go to more kills, then more duels.
create function public.duel_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;
  return coalesce((
    select jsonb_agg(t.item order by t.place)
    from (
      select
        row_number() over (
          order by r.kills::numeric / greatest(r.deaths, 1) desc, r.kills desc,
                   r.kills + r.deaths + r.draws desc, p.public_id
        ) as place,
        jsonb_build_object(
          'publicId', p.public_id,
          'displayName', p.display_name,
          'avatarObjectKey', p.avatar_object_key,
          'avatarPreset', p.avatar_preset,
          'externalAvatarUrl', p.external_avatar_url,
          'kills', r.kills,
          'deaths', r.deaths,
          'draws', r.draws
        ) as item
      from public.duel_records r
      join public.profiles p on p.user_id = r.user_id
      where r.listed
        and r.kills + r.deaths + r.draws >= 10
        and not exists (
          select 1 from public.account_restrictions x
          where x.user_id = r.user_id
            and x.lifted_at is null
            and (x.expires_at is null or x.expires_at > now())
        )
      order by place
      limit 3
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.duel_leaderboard() from public, anon;
grant execute on function public.duel_leaderboard() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. A claimed reward is one more free request
-- ---------------------------------------------------------------------------

-- As in 202610190003, with claimed Duel rewards added to the bonus.
create or replace function private.free_request_allowance(target_user_id uuid)
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select
      3 as base,
      coalesce((
        select sum(r.credits)::integer from public.reward_code_redemptions r
        where r.user_id = target_user_id and r.kind = 'free_requests'
      ), 0)
      + (
        select count(*)::integer from public.duel_achievement_rewards d
        where d.user_id = target_user_id
      ) as bonus,
      (
        select count(*)::integer from public.wanted_requests w
        where w.commissioner_user_id = target_user_id and w.is_free and w.status <> 'draft'
      ) as used
  )
  select base, bonus, used, greatest(base + bonus - used, 0) from totals;
$$;
