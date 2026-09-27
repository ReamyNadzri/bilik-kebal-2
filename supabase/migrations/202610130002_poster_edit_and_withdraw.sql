-- Migration: 202610130002_poster_edit_and_withdraw.sql
-- The poster may correct or withdraw their Wanted in the first hour after it
-- is published, until someone has acted on it.
--
-- Rules (context/project-overview.md, "Changing a published Wanted"):
--   * The window is one hour from published_at. For a paid Wanted that is the
--     moment its first contribution was confirmed.
--   * The window closes early once a claim exists (any claim not withdrawn by
--     its Hunter) or, on a missing item or discussion, once someone other
--     than the poster has replied.
--   * Only the title and description can change. Bounty, duration, course,
--     campus and every snapshot stay as published. The previous text is kept
--     in wanted_request_revisions.
--   * Withdrawing hides the Wanted and queues one manual refund task for every
--     contribution. Nothing is deleted and no ledger entry is written here:
--     the Owner records each refund, which posts the compensating entries
--     (record_owner_refund_completion).
--   * A contribution confirmed after withdrawal (a late provider callback) is
--     queued for refund by trigger, so no money is left in escrow.
--   * A claim cannot be started on a Wanted that is no longer open, closing
--     the race between "no claims yet" and a Hunter starting an upload.

-- ---------------------------------------------------------------------------
-- 1. Lifecycle: withdrawn is a published state
-- ---------------------------------------------------------------------------

alter table public.wanted_requests
  add column if not exists withdrawn_at timestamptz;

alter table public.wanted_requests
  drop constraint if exists wanted_requests_lifecycle_check;

alter table public.wanted_requests
  add constraint wanted_requests_lifecycle_check check (
    (
      status = 'draft'
      and duration_days_snapshot is null
      and fee_rate_basis_points_snapshot is null
      and policy_version_snapshot is null
      and access_basis_snapshot is null
      and published_at is null
      and closes_at is null
    )
    or (
      status = 'awaiting_payment'
      and duration_days_snapshot is not null
      and fee_rate_basis_points_snapshot is not null
      and policy_version_snapshot is not null
      and access_basis_snapshot is not null
      and published_at is null
      and closes_at is null
    )
    or (
      status in ('open', 'reviewing', 'expired', 'fulfilled', 'closed', 'withdrawn')
      and duration_days_snapshot is not null
      and fee_rate_basis_points_snapshot is not null
      and policy_version_snapshot is not null
      and access_basis_snapshot is not null
      and published_at is not null
      and closes_at > published_at
    )
  ),
  add constraint wanted_requests_withdrawn_at_check check (
    (status = 'withdrawn') = (withdrawn_at is not null)
  );

-- ---------------------------------------------------------------------------
-- 2. Revisions: the text a Wanted had before each poster edit
-- ---------------------------------------------------------------------------

create table public.wanted_request_revisions (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  previous_title text not null,
  previous_description text not null,
  revised_by uuid not null references public.profiles (user_id) on delete restrict,
  revised_at timestamptz not null default now()
);

create index wanted_request_revisions_by_wanted
  on public.wanted_request_revisions (wanted_request_id, revised_at desc);

-- No policies: written and read only through security-definer functions.
alter table public.wanted_request_revisions enable row level security;
revoke all on public.wanted_request_revisions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Why a Wanted can no longer be changed by its poster, or null
-- ---------------------------------------------------------------------------

create function private.wanted_poster_change_refusal(target public.wanted_requests)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target.status <> 'open' or target.published_at is null then 'not_open'
    when target.published_at + interval '1 hour' <= now() then 'window_closed'
    when exists (
      select 1 from public.claims c
      where c.wanted_request_id = target.id and c.status <> 'withdrawn'
    ) then 'claim_submitted'
    when exists (
      select 1 from public.wanted_replies r
      where r.wanted_request_id = target.id and r.author_user_id <> target.commissioner_user_id
    ) then 'reply_received'
    else null
  end;
$$;

revoke all on function private.wanted_poster_change_refusal(public.wanted_requests) from public, anon, authenticated;

-- The poster's own view of the window. Returns no row to anyone else, so it
-- reveals nothing about claims or replies on other people's Wanteds.
create function public.my_wanted_change_window(target_public_id uuid)
returns table (editable_until timestamptz, locked_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
begin
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = auth.uid();
  if not found or target.published_at is null then
    return;
  end if;
  return query select
    target.published_at + interval '1 hour',
    private.wanted_poster_change_refusal(target);
end;
$$;

revoke all on function public.my_wanted_change_window(uuid) from public, anon;
grant execute on function public.my_wanted_change_window(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Edit the title and description
-- ---------------------------------------------------------------------------

create function public.update_own_published_wanted(
  target_public_id uuid,
  new_title text,
  new_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
  refusal text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  refusal := private.wanted_poster_change_refusal(target);
  if refusal is not null then
    raise exception using errcode = '42501', message = 'wanted_change_locked:' || refusal;
  end if;
  if new_title is null or new_description is null
    or char_length(trim(new_title)) not between 8 and 120
    or char_length(trim(new_description)) not between 20 and 2000
  then
    raise exception using errcode = '22023', message = 'wanted_change_invalid';
  end if;
  if trim(new_title) = target.title and trim(new_description) = target.description then
    return;
  end if;

  insert into public.wanted_request_revisions (
    wanted_request_id, previous_title, previous_description, revised_by
  )
  values (target.id, target.title, target.description, auth.uid());

  update public.wanted_requests
  set title = trim(new_title), description = trim(new_description), updated_at = now()
  where id = target.id;

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'wanted_edited', 'Edited by the poster');
end;
$$;

revoke all on function public.update_own_published_wanted(uuid, text, text) from public, anon;
grant execute on function public.update_own_published_wanted(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Withdraw, queueing a refund for every contribution
-- ---------------------------------------------------------------------------

create function public.withdraw_own_wanted(target_public_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
  refusal text;
  refunds_queued integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  -- The row lock orders this against claim creation (section 6) and against
  -- a concurrent edit; the refusal below is evaluated after it is held.
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  refusal := private.wanted_poster_change_refusal(target);
  if refusal is not null then
    raise exception using errcode = '42501', message = 'wanted_change_locked:' || refusal;
  end if;

  update public.wanted_requests
  set status = 'withdrawn', withdrawn_at = now(), updated_at = now()
  where id = target.id;

  insert into public.refund_tasks (
    wanted_request_id, contribution_id, contributor_user_id, amount_sen, status
  )
  select c.wanted_request_id, c.id, c.contributor_user_id, c.amount_sen, 'pending'
  from public.contributions c
  where c.wanted_request_id = target.id
  on conflict (contribution_id) do nothing;
  get diagnostics refunds_queued = row_count;

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'wanted_withdrawn', 'Withdrawn by the poster');

  return refunds_queued;
end;
$$;

revoke all on function public.withdraw_own_wanted(uuid) from public, anon;
grant execute on function public.withdraw_own_wanted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Guards around a withdrawn Wanted
-- ---------------------------------------------------------------------------

-- A contribution confirmed after withdrawal is refunded like the rest.
create function private.refund_contribution_to_withdrawn_wanted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.wanted_requests w
    where w.id = new.wanted_request_id and w.status = 'withdrawn'
  ) then
    insert into public.refund_tasks (
      wanted_request_id, contribution_id, contributor_user_id, amount_sen, status
    )
    values (new.wanted_request_id, new.id, new.contributor_user_id, new.amount_sen, 'pending')
    on conflict (contribution_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.refund_contribution_to_withdrawn_wanted() from public, anon, authenticated;

create trigger contributions_refund_if_withdrawn
after insert on public.contributions
for each row execute function private.refund_contribution_to_withdrawn_wanted();

-- A claim needs its Wanted open or in review. The share lock waits for a
-- withdrawal in progress, then sees its result.
create function private.require_claimable_wanted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.wanted_status;
begin
  select w.status into current_status
  from public.wanted_requests w
  where w.id = new.wanted_request_id
  for share;
  if current_status is null or current_status not in ('open', 'reviewing') then
    raise exception using errcode = 'P0001', message = 'wanted request is not open';
  end if;
  return new;
end;
$$;

revoke all on function private.require_claimable_wanted() from public, anon, authenticated;

create trigger claims_require_claimable_wanted
before insert on public.claims
for each row execute function private.require_claimable_wanted();
