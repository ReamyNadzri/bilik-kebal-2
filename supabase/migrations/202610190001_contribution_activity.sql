-- Migration: 202610190001_contribution_activity.sql
--
-- A confirmed contribution now appears in the Wanted's public activity
-- (report, 2026-10-02: "a backer test has been made but the Bounty activity
-- doesn't show anything"). record_verified_contribution posted the money but
-- never wrote a wanted_public_events row, so a paid Wanted's activity stayed
-- empty.
--
-- The event names no one: activity is visible to every verified member, and
-- who backed a request is not public. It states the amount, which the bounty
-- total already makes public.
--
-- A trigger on contributions rather than a rewrite of
-- record_verified_contribution, so the money path is not touched. Existing
-- contributions are backfilled once, at their own time.

create function private.contribution_public_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  poster uuid;
  earlier boolean;
begin
  select w.commissioner_user_id into poster
  from public.wanted_requests w
  where w.id = new.wanted_request_id;

  earlier := exists (
    select 1 from public.contributions c
    where c.wanted_request_id = new.wanted_request_id and c.id <> new.id
  );

  insert into public.wanted_public_events (wanted_request_id, event_type, summary, occurred_at)
  values (
    new.wanted_request_id,
    case
      when new.contributor_user_id = poster and not earlier then 'wanted_posted_bounty'
      else 'wanted_backed'
    end,
    case
      when new.contributor_user_id = poster and not earlier then
        'Posted with a bounty of RM ' || to_char(new.amount_sen / 100.0, 'FM999990.00')
      when new.contributor_user_id = poster then
        'The poster added RM ' || to_char(new.amount_sen / 100.0, 'FM999990.00')
      else
        'A Backer added RM ' || to_char(new.amount_sen / 100.0, 'FM999990.00')
    end,
    new.created_at
  );
  return new;
end;
$$;
revoke all on function private.contribution_public_event() from public, anon, authenticated;

create trigger contributions_public_event
after insert on public.contributions
for each row execute function private.contribution_public_event();

-- Backfill: one event per contribution that has none yet.
insert into public.wanted_public_events (wanted_request_id, event_type, summary, occurred_at)
select
  c.wanted_request_id,
  case when c.contributor_user_id = w.commissioner_user_id and c.rn = 1
    then 'wanted_posted_bounty' else 'wanted_backed' end,
  case
    when c.contributor_user_id = w.commissioner_user_id and c.rn = 1 then
      'Posted with a bounty of RM ' || to_char(c.amount_sen / 100.0, 'FM999990.00')
    when c.contributor_user_id = w.commissioner_user_id then
      'The poster added RM ' || to_char(c.amount_sen / 100.0, 'FM999990.00')
    else
      'A Backer added RM ' || to_char(c.amount_sen / 100.0, 'FM999990.00')
  end,
  c.created_at
from (
  select x.*, row_number() over (partition by x.wanted_request_id order by x.created_at, x.id) as rn
  from public.contributions x
) c
join public.wanted_requests w on w.id = c.wanted_request_id
where not exists (
  select 1 from public.wanted_public_events e
  where e.wanted_request_id = c.wanted_request_id
    and e.event_type in ('wanted_posted_bounty', 'wanted_backed')
    and e.occurred_at = c.created_at
);
