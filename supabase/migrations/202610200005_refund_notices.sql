-- Migration: 202610200005_refund_notices.sql
--
-- Request (user, 2026-10-03): when a Wanted someone backed is withdrawn or
-- removed it vanished from "Wanteds you backed" without a word. The Backer is
-- now told their refund is queued, the Owner and every Platform Sheriff are
-- told the refund queue has work, and the Backer's own list keeps the closed
-- Wanted with its refund state.
--
-- Every refund path inserts into public.refund_tasks: withdrawal
-- (withdraw_own_wanted), the late-payment trigger
-- (contributions_refund_if_withdrawn), the Owner's removal
-- (owner_remove_wanted, one insert per contribution in a loop) and expiry
-- (expire_wanted_and_generate_refunds). One statement-level trigger on that
-- table covers them all.
--
-- One notice per refund episode, not per contribution: a Backer is told when
-- they go from no outstanding refund on a Wanted to one, and staff are told
-- when a Wanted goes from no outstanding refund to one. Rows inserted by the
-- same statement do not count as "already outstanding". So the Owner's
-- per-row removal loop notifies once, a second contribution by the same Backer
-- does not notify twice, and a payment confirmed after every earlier refund
-- was recorded notifies again. The event id comes from the smallest new task
-- id in the group (the Backer's is that id, staff's an md5 of it), so
-- enqueue_notification's (event_id, recipient) key makes a replay a no-op.
--
-- Notices carry the Wanted's public id only. Both kinds are in-app only:
-- context/project-overview.md defers payment-related email (refunds included)
-- until the payment gateway is live, so the email outbox skips them.
--
-- Nothing here changes who records a refund, refund amounts, fees or the
-- ledger. NOT yet applied to any database.

-- ---------------------------------------------------------------------------
-- 1. The two kinds, appended to the current list
-- ---------------------------------------------------------------------------

do $$
declare
  current_def text;
begin
  select pg_get_constraintdef(oid) into current_def
  from pg_constraint
  where conname = 'notifications_kind_check' and conrelid = 'public.notifications'::regclass;
  if current_def is null then
    raise exception 'notifications_kind_check not found';
  end if;
  if position('wanted_refund_queued' in current_def) = 0 then
    if position('''wanted_reply_hidden''::text' in current_def) = 0 then
      raise exception 'unexpected notifications_kind_check: %', current_def;
    end if;
    alter table public.notifications drop constraint notifications_kind_check;
    execute 'alter table public.notifications add constraint notifications_kind_check '
      || replace(current_def, '''wanted_reply_hidden''::text',
                 '''wanted_reply_hidden''::text, ''wanted_refund_queued''::text, ''refund_queue_pending''::text');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Notify on every refund task insert
-- ---------------------------------------------------------------------------

create function private.publish_refund_notices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  recipient uuid;
begin
  -- The Backer: one notice per (Wanted, Backer) with no refund already outstanding.
  for item in
    select n.wanted_request_id, n.contributor_user_id, w.public_id,
           (array_agg(n.id order by n.id))[1] as event_id
    from new_refund_tasks n
    join public.wanted_requests w on w.id = n.wanted_request_id
    where not exists (
      select 1 from public.refund_tasks r
      where r.wanted_request_id = n.wanted_request_id
        and r.contributor_user_id = n.contributor_user_id
        and r.status <> 'completed'
        and r.id not in (select id from new_refund_tasks)
    )
    group by n.wanted_request_id, n.contributor_user_id, w.public_id
  loop
    perform public.enqueue_notification(
      item.event_id, item.contributor_user_id, 'wanted_refund_queued', item.public_id
    );
  end loop;

  -- Staff: one notice per Wanted with no refund already outstanding. The event
  -- id is derived from the smallest task id, never equal to it: a staff member
  -- who also backed the Wanted would otherwise get both kinds under one
  -- (event_id, recipient) and enqueue_notification would refuse the second.
  for item in
    select n.wanted_request_id, w.public_id,
           md5('refund_queue_pending:' || (array_agg(n.id order by n.id))[1]::text)::uuid as event_id
    from new_refund_tasks n
    join public.wanted_requests w on w.id = n.wanted_request_id
    where not exists (
      select 1 from public.refund_tasks r
      where r.wanted_request_id = n.wanted_request_id
        and r.status <> 'completed'
        and r.id not in (select id from new_refund_tasks)
    )
    group by n.wanted_request_id, w.public_id
  loop
    for recipient in
      select distinct a.user_id from public.platform_role_assignments a
      where a.role in ('owner', 'platform_sheriff')
    loop
      perform public.enqueue_notification(
        item.event_id, recipient, 'refund_queue_pending', item.public_id
      );
    end loop;
  end loop;

  return null;
end;
$$;
revoke all on function private.publish_refund_notices() from public, anon, authenticated;

create trigger refund_tasks_publish_notices
after insert on public.refund_tasks
referencing new table as new_refund_tasks
for each statement execute function private.publish_refund_notices();

-- ---------------------------------------------------------------------------
-- 3. The Backer's own list, closed Wanteds included
-- ---------------------------------------------------------------------------

-- One row per Wanted the caller contributed to and did not post, most recently
-- backed first. Read past RLS so a withdrawn or removed Wanted stays listed;
-- only the caller's own contributions and refund tasks are read, and nothing
-- about other Backers or the removal reason is returned. "removed" is the
-- Owner's removal (a withdrawn Wanted with a removal reason); "withdrawn" the
-- poster's own.
--   refund_state: 'none'     no refund task
--                 'pending'  at least one task not yet completed
--                 'refunded' every task completed
--   refund_sen:   contribution + fee over the caller's refund tasks
create function public.list_own_backed_wanted()
returns table (
  public_id uuid,
  title text,
  kind text,
  status text,
  withdrawn boolean,
  removed boolean,
  backed_at timestamptz,
  contributed_sen bigint,
  refund_sen bigint,
  refund_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := private.current_user_id();
begin
  if caller is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  return query
  with mine as (
    select c.wanted_request_id,
           max(c.created_at) as backed_at,
           sum(c.amount_sen)::bigint as contributed_sen
    from public.contributions c
    where c.contributor_user_id = caller
    group by c.wanted_request_id
  ), refunds as (
    select r.wanted_request_id,
           sum(r.amount_sen + r.fee_sen)::bigint as refund_sen,
           bool_or(r.status <> 'completed') as outstanding
    from public.refund_tasks r
    where r.contributor_user_id = caller
    group by r.wanted_request_id
  )
  select w.public_id,
         w.title,
         w.kind::text,
         w.status::text,
         w.status = 'withdrawn' and w.removal_reason is null,
         w.status = 'withdrawn' and w.removal_reason is not null,
         m.backed_at,
         m.contributed_sen,
         coalesce(f.refund_sen, 0)::bigint,
         case
           when f.wanted_request_id is null then 'none'
           when f.outstanding then 'pending'
           else 'refunded'
         end
  from mine m
  join public.wanted_requests w on w.id = m.wanted_request_id
  left join refunds f on f.wanted_request_id = m.wanted_request_id
  where w.commissioner_user_id <> caller
  order by m.backed_at desc, w.public_id;
end;
$$;
revoke all on function public.list_own_backed_wanted() from public, anon;
grant execute on function public.list_own_backed_wanted() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. In-app only: refund email waits for the payment gateway
-- ---------------------------------------------------------------------------

-- Latest definition: 202609290001 (wanted_reply skipped). Same body, two more
-- kinds skipped.
create or replace function private.enqueue_notification_email()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('wanted_reply', 'wanted_refund_queued', 'refund_queue_pending') then
    return new;
  end if;
  insert into private.notification_email_outbox(notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_notification_email() from public, anon, authenticated;
