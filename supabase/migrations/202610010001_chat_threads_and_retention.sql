-- Chat threads for every Wanted, and their 7-day retention.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-25):
-- * Missing items and discussions keep their reply thread ("Sightings and
--   replies"). Academic bounties gain a text-only Q&A thread in which links
--   and contact handles are refused, so no resource changes hands outside a
--   reviewed, paid Claim.
-- * A thread closes when its Wanted leaves open/reviewing (marked found or
--   resolved, auto-closed, fulfilled, expired). Seven days later its messages
--   are deleted. A missing-item or discussion card also vanishes from the
--   Board, Archive and detail page then; a small record stays (title, dates,
--   reply count) because notifications, events and the ledger point at it.
-- * An open free missing item or discussion with no new message for 30 days
--   closes itself; the poster is told in-app and may reopen it within the
--   7 days. Paid requests never auto-close: they keep the existing expiry and
--   refund path, so no bounty is stranded.
-- * Nothing is deleted while it may still be evidence: a paid community
--   request purges only after a Sheriff-approved release or once every
--   contribution has a refund task; an academic Q&A purges only 7 days after
--   the last claim review (the appeal window) with no pending appeal and no
--   appeal pause. Hidden replies are kept for moderation.
-- * The job runs daily through pg_cron where the extension is available.

-- ---------------------------------------------------------------------------
-- 1. Thread state on the Wanted
-- ---------------------------------------------------------------------------

alter table public.wanted_requests
  add column if not exists thread_closed_at timestamptz,
  add column if not exists thread_last_activity_at timestamptz,
  add column if not exists thread_reply_count integer not null default 0
    check (thread_reply_count >= 0),
  add column if not exists thread_auto_closed boolean not null default false,
  add column if not exists thread_purged_at timestamptz,
  add column if not exists vanished_at timestamptz,
  add constraint wanted_requests_vanished_kind_check check (
    vanished_at is null or (kind in ('missing_item', 'discussion') and thread_purged_at is not null)
  );

create index if not exists wanted_requests_thread_purge_due
  on public.wanted_requests (thread_closed_at)
  where thread_purged_at is null and thread_closed_at is not null;
create index if not exists wanted_requests_thread_stale
  on public.wanted_requests (thread_last_activity_at)
  where status = 'open' and kind in ('missing_item', 'discussion');

-- Backfill from what exists today.
update public.wanted_requests w set
  thread_reply_count = r.reply_count,
  thread_last_activity_at = r.last_reply_at
from (
  select wanted_request_id, count(*)::integer as reply_count, max(created_at) as last_reply_at
  from public.wanted_replies
  group by wanted_request_id
) r
where r.wanted_request_id = w.id;

update public.wanted_requests
set thread_last_activity_at = coalesce(thread_last_activity_at, published_at)
where published_at is not null;

update public.wanted_requests
set thread_closed_at = updated_at
where status in ('closed', 'fulfilled', 'expired') and thread_closed_at is null;

-- The thread clock follows the status: leaving open/reviewing closes the
-- thread, returning to it (a rejected release, a reopen) opens it again. One
-- trigger covers every function that changes status, old and new.
create function private.track_wanted_thread_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('closed', 'fulfilled', 'expired') then
      new.thread_closed_at := coalesce(new.thread_closed_at, now());
    elsif new.status in ('open', 'reviewing') then
      new.thread_closed_at := null;
      new.thread_auto_closed := false;
    end if;
  end if;
  if new.status = 'open' and old.status is distinct from 'open' and new.published_at is not null then
    new.thread_last_activity_at := greatest(coalesce(new.thread_last_activity_at, new.published_at), now());
  end if;
  return new;
end;
$$;
revoke all on function private.track_wanted_thread_state() from public, anon, authenticated;

create trigger wanted_thread_state
before update of status on public.wanted_requests
for each row execute function private.track_wanted_thread_state();

-- Every new reply counts as activity.
create function private.touch_wanted_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wanted_requests
  set thread_last_activity_at = new.created_at,
      thread_reply_count = thread_reply_count + 1
  where id = new.wanted_request_id;
  return new;
end;
$$;
revoke all on function private.touch_wanted_thread() from public, anon, authenticated;

create trigger wanted_reply_touch_thread
after insert on public.wanted_replies
for each row execute function private.touch_wanted_thread();

-- ---------------------------------------------------------------------------
-- 2. Replies on every kind, with the academic link rule
-- ---------------------------------------------------------------------------

-- Links, bare domains, messaging handles and email addresses: the ways a
-- resource or a private channel could be handed over outside a Claim.
create function private.text_contains_contact_or_link(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|my|io|me|ly|gl|link|app|co|to|cc|gg|xyz|info|site|page|drive|edu|gov)(\M|/)|t\.me/|wa\.me/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})';
$$;
revoke all on function private.text_contains_contact_or_link(text) from public, anon, authenticated;

create or replace function public.post_wanted_reply(target_public_id uuid, reply_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
  new_id uuid;
begin
  select * into target from public.wanted_requests
  where public_id = target_public_id and status = 'open' and vanished_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  if not private.current_user_can_transact_at(target.institution_id) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if target.kind = 'academic' and private.text_contains_contact_or_link(reply_body) then
    raise exception using errcode = '22023', message = 'wanted_reply_link_not_allowed';
  end if;
  insert into public.wanted_replies (wanted_request_id, author_user_id, body)
  values (target.id, auth.uid(), trim(reply_body))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.post_wanted_reply(uuid, text) from public, anon;
grant execute on function public.post_wanted_reply(uuid, text) to authenticated;

drop policy if exists wanted_replies_read on public.wanted_replies;
create policy wanted_replies_read on public.wanted_replies for select to authenticated
using (
  hidden_at is null
  and private.current_user_is_email_verified()
  and exists (
    select 1 from public.wanted_requests w
    where w.id = wanted_replies.wanted_request_id
      and w.vanished_at is null
      and w.status in ('open', 'reviewing', 'expired', 'fulfilled', 'closed')
  )
);

-- The server's read service uses the service role; nothing else writes here
-- directly (post_wanted_reply is security definer).
grant select on public.wanted_replies to authenticated;
grant all on public.wanted_replies to service_role;

-- ---------------------------------------------------------------------------
-- 3. Reopen within the 7 days
-- ---------------------------------------------------------------------------

create function public.reopen_own_community_wanted(target_public_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
begin
  select * into target from public.wanted_requests
  where public_id = target_public_id
    and commissioner_user_id = auth.uid()
    and kind in ('missing_item', 'discussion')
  for update;
  if not found
    or target.status <> 'closed'
    or target.thread_purged_at is not null
    or target.thread_closed_at is null
    or target.thread_closed_at <= now() - interval '7 days'
    or target.closes_at <= now()
  then
    raise exception using errcode = '42501', message = 'wanted_not_reopenable';
  end if;
  update public.wanted_requests set status = 'open', updated_at = now() where id = target.id;
  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'wanted_reopened', 'Reopened by the poster');
end;
$$;
revoke all on function public.reopen_own_community_wanted(uuid) from public, anon;
grant execute on function public.reopen_own_community_wanted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auto-close notification (in-app only, like replies)
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
  'institution_verification_approved', 'institution_verification_rejected',
  'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated',
  'wanted_reply',
  'taxonomy_request_approved', 'taxonomy_request_rejected',
  'community_payout_approved', 'community_payout_rejected', 'community_bounty_awarded',
  'wanted_thread_auto_closed'
));

create or replace function private.enqueue_notification_email()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('wanted_reply', 'wanted_thread_auto_closed') then
    return new;
  end if;
  insert into private.notification_email_outbox(notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The retention job
-- ---------------------------------------------------------------------------

-- Free, open missing items and discussions with no activity for 30 days.
-- Idempotent: a closed row no longer matches, and each close notifies once,
-- keyed by the public event it records.
create function private.close_stale_community_threads(batch_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed_count integer := 0;
  row_ record;
  event_id uuid;
begin
  for row_ in
    select id, public_id, commissioner_user_id from public.wanted_requests
    where kind in ('missing_item', 'discussion')
      and is_free
      and status = 'open'
      and not coalesce(is_paused, false)
      and coalesce(thread_last_activity_at, published_at) <= now() - interval '30 days'
    order by coalesce(thread_last_activity_at, published_at)
    limit batch_limit
    for update skip locked
  loop
    update public.wanted_requests
    set status = 'closed', thread_auto_closed = true, updated_at = now()
    where id = row_.id;
    insert into public.wanted_public_events (wanted_request_id, event_type, summary)
    values (row_.id, 'wanted_auto_closed', 'Closed after 30 days without a new message')
    returning id into event_id;
    perform public.enqueue_notification(
      event_id, row_.commissioner_user_id, 'wanted_thread_auto_closed', row_.public_id
    );
    closed_count := closed_count + 1;
  end loop;
  return closed_count;
end;
$$;
revoke all on function private.close_stale_community_threads(integer) from public, anon, authenticated;

-- Whether a closed thread may be deleted now. Money and moderation first.
create function private.wanted_thread_purgeable(target public.wanted_requests)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target.thread_purged_at is null
    and target.thread_closed_at is not null
    and target.status in ('closed', 'fulfilled', 'expired')
    and not coalesce(target.is_paused, false)
    and target.thread_closed_at <= now() - interval '7 days'
    -- Never while a bounty release waits for a Sheriff.
    and not exists (
      select 1 from public.community_payout_requests p
      where p.wanted_request_id = target.id and p.status = 'pending'
    )
    -- A paid community bounty must be settled: released, or fully refunded.
    and (
      target.kind = 'academic'
      or target.is_free
      or not exists (select 1 from public.contributions c where c.wanted_request_id = target.id)
      or exists (
        select 1 from public.community_payout_requests p
        where p.wanted_request_id = target.id and p.status = 'approved'
      )
      or not exists (
        select 1 from public.contributions c
        where c.wanted_request_id = target.id
          and not exists (select 1 from public.refund_tasks r where r.contribution_id = c.id)
      )
    )
    -- Academic: no pending appeal, and the 7-day appeal window after the
    -- latest claim review has passed.
    and (
      target.kind <> 'academic'
      or (
        not exists (
          select 1 from public.claim_appeals a
          join public.claims c on c.id = a.claim_id
          where c.wanted_request_id = target.id and a.status = 'pending'
        )
        and coalesce((
          select max(r.created_at) from public.claim_reviews r
          join public.claims c on c.id = r.claim_id
          where c.wanted_request_id = target.id
        ), '-infinity'::timestamptz) <= now() - interval '7 days'
      )
    );
$$;
revoke all on function private.wanted_thread_purgeable(public.wanted_requests) from public, anon, authenticated;

-- Deletes the messages of threads closed for 7 days and hides community
-- cards. Idempotent: a purged row is skipped on the next run.
create function private.purge_closed_wanted_threads(batch_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged_count integer := 0;
  target public.wanted_requests%rowtype;
begin
  for target in
    select * from public.wanted_requests
    where thread_purged_at is null
      and thread_closed_at is not null
      and thread_closed_at <= now() - interval '7 days'
    order by thread_closed_at
    limit batch_limit
    for update skip locked
  loop
    continue when not private.wanted_thread_purgeable(target);
    delete from public.wanted_replies
    where wanted_request_id = target.id and hidden_at is null;
    update public.wanted_requests set
      thread_purged_at = now(),
      vanished_at = case when kind in ('missing_item', 'discussion') then now() end
    where id = target.id;
    insert into public.wanted_public_events (wanted_request_id, event_type, summary)
    values (
      target.id,
      'thread_purged',
      case when target.kind = 'academic'
        then 'Questions cleared 7 days after the bounty closed'
        else 'Removed from the Board 7 days after it closed'
      end
    );
    purged_count := purged_count + 1;
  end loop;
  return purged_count;
end;
$$;
revoke all on function private.purge_closed_wanted_threads(integer) from public, anon, authenticated;

create function private.run_wanted_thread_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed_count integer;
  purged_count integer;
begin
  closed_count := private.close_stale_community_threads();
  purged_count := private.purge_closed_wanted_threads();
  return jsonb_build_object('closed', closed_count, 'purged', purged_count);
end;
$$;
revoke all on function private.run_wanted_thread_retention() from public, anon, authenticated;

-- Daily at 03:17 UTC (11:17 in Malaysia). Skipped where pg_cron is absent,
-- such as the stubbed local Postgres used to check the migration chain.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $cron$
      select cron.schedule(
        'wanted-thread-retention',
        '17 3 * * *',
        'select private.run_wanted_thread_retention()'
      )
    $cron$;
  else
    raise notice 'pg_cron is not available; wanted-thread-retention was not scheduled';
  end if;
end;
$$;
