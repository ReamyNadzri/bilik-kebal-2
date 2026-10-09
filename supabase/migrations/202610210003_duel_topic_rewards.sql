-- Migration: 202610210003_duel_topic_rewards.sql
--
-- Request of 2026-10-10: the 50 Duel achievements are grouped in 7 topics
-- (Showdowns, Grit, Rivals, Streaks, Speed, Practice, Dedication). Completing
-- every achievement of a topic in a month gives 2 free requests that expire
-- one month after they are claimed. This replaces the three single
-- achievements that gave one lasting free request each.
--
--   * A topic reward is claimed once per member, topic and month, by an
--     institution-verified member who is not restricted.
--   * Free requests from reward codes, and any already claimed from single
--     achievements, keep lasting.
--   * Each free Wanted uses the soonest-expiring topic credit that was live
--     when it was posted, then the lasting allowance. A topic credit that
--     expires unused stops counting.
--
-- Up to 14 free requests a month per member. Every topic, Speed included,
-- rests on reactions the browser measures, so a scripted member can reach
-- them; institution verification is the brake.


-- ---------------------------------------------------------------------------
-- 1. Topic rewards replace the single-achievement rewards
-- ---------------------------------------------------------------------------

update public.duel_achievements set grants_free_request = false where grants_free_request;

create table public.duel_topic_rewards (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  category text not null,
  month date not null check (month = date_trunc('month', month)::date),
  credits integer not null default 2 check (credits > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, category, month),
  check (expires_at > granted_at)
);
create index duel_topic_rewards_user_expires on public.duel_topic_rewards (user_id, expires_at);

alter table public.duel_topic_rewards enable row level security;
revoke all on public.duel_topic_rewards from public, anon, authenticated;
grant select on public.duel_topic_rewards to authenticated;
create policy duel_topic_rewards_read_own on public.duel_topic_rewards
  for select to authenticated
  using (user_id = private.current_user_id());


-- ---------------------------------------------------------------------------
-- 2. The month's read: badge numbers and topics
-- ---------------------------------------------------------------------------

-- Each topic this month: how many achievements it has, how many are done.
create function private.duel_topic_progress(member_id uuid, month date)
returns table (category text, first_sort smallint, total integer, done integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.category, min(g.sort), count(*)::integer, count(*) filter (where g.done)::integer
  from private.duel_month_progress(member_id, month) g
  group by g.category;
$$;
revoke all on function private.duel_topic_progress(uuid, date) from public;

create or replace function public.duel_achievements_this_month()
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
    'topicCredits', 2,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'number', g.sort,
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
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', t.category,
        'total', t.total,
        'done', t.done,
        'claimed', r.user_id is not null,
        'expiresAt', r.expires_at
      ) order by t.first_sort)
      from private.duel_topic_progress(actor_id, this_month) t
      left join public.duel_topic_rewards r
        on r.user_id = actor_id and r.category = t.category and r.month = this_month
    ), '[]'::jsonb)
  );
end;
$$;

-- Claims this month's 2 free requests for a finished topic; they expire one
-- month after this claim. Returns 'claimed' or 'already_claimed'. Refusals:
-- duel_auth_required, EMAIL_NOT_VERIFIED, duel_topic_not_found,
-- duel_reward_not_eligible, duel_topic_incomplete.
create function public.claim_duel_topic(topic text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.duel_actor();
  this_month date := private.duel_month(now());
  progress record;
  inserted text;
begin
  select * into progress
  from private.duel_topic_progress(actor_id, this_month) t
  where t.category = claim_duel_topic.topic;
  if not found then
    raise exception using errcode = 'P0002', message = 'duel_topic_not_found';
  end if;
  if not private.duel_reward_eligible(actor_id) then
    raise exception using errcode = '42501', message = 'duel_reward_not_eligible';
  end if;
  if progress.done < progress.total then
    raise exception using errcode = 'P0001', message = 'duel_topic_incomplete';
  end if;

  insert into public.duel_topic_rewards (user_id, category, month, credits, expires_at)
  values (actor_id, claim_duel_topic.topic, this_month, 2, now() + interval '1 month')
  on conflict do nothing
  returning public.duel_topic_rewards.category into inserted;

  return case when inserted is null then 'already_claimed' else 'claimed' end;
end;
$$;
revoke all on function public.claim_duel_topic(text) from public, anon;
grant execute on function public.claim_duel_topic(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. The free-request allowance, with expiring topic credits
-- ---------------------------------------------------------------------------

-- How many topic credits lapsed unused by `at`. Credits are given soonest
-- expiry first; each post takes the first credit that was live when it was
-- posted and is still free. Pure, so it is tested without Wanted rows.
create function private.lapsed_topic_credits(
  grants timestamptz[],
  expiries timestamptz[],
  posts timestamptz[],
  at timestamptz
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  units integer := coalesce(array_length(expiries, 1), 0);
  taken boolean[] := array_fill(false, array[greatest(units, 1)]);
  posted timestamptz;
  lapsed integer := 0;
begin
  foreach posted in array coalesce(posts, '{}'::timestamptz[]) loop
    for i in 1 .. units loop
      if not taken[i] and grants[i] <= posted and posted < expiries[i] then
        taken[i] := true;
        exit;
      end if;
    end loop;
  end loop;
  for i in 1 .. units loop
    if not taken[i] and expiries[i] <= at then
      lapsed := lapsed + 1;
    end if;
  end loop;
  return lapsed;
end;
$$;
revoke all on function private.lapsed_topic_credits(timestamptz[], timestamptz[], timestamptz[], timestamptz) from public;

-- As in 202610210002, now with topic credits that expire. `bonus` counts the
-- lasting free requests and every topic credit that is either still live or
-- was used, so base + bonus - used = remaining still holds.
create or replace function private.free_request_allowance(target_user_id uuid)
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  with units as (
    select t.granted_at, t.expires_at
    from public.duel_topic_rewards t
    cross join lateral generate_series(1, t.credits)
    where t.user_id = target_user_id
  ),
  posts as (
    select coalesce(w.published_at, w.created_at) as posted_at
    from public.wanted_requests w
    where w.commissioner_user_id = target_user_id and w.is_free and w.status <> 'draft'
  ),
  totals as (
    select
      3 as base,
      coalesce((
        select sum(r.credits)::integer from public.reward_code_redemptions r
        where r.user_id = target_user_id and r.kind = 'free_requests'
      ), 0)
      + (
        select count(*)::integer from public.duel_achievement_rewards d
        where d.user_id = target_user_id
      )
      + (select count(*)::integer from units)
      - private.lapsed_topic_credits(
          (select array_agg(u.granted_at order by u.expires_at, u.granted_at) from units u),
          (select array_agg(u.expires_at order by u.expires_at, u.granted_at) from units u),
          (select array_agg(p.posted_at order by p.posted_at) from posts p),
          now()
        ) as bonus,
      (select count(*)::integer from posts) as used
  )
  select base, bonus, used, greatest(base + bonus - used, 0) from totals;
$$;
