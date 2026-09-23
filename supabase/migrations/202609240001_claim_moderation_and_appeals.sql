-- Migration: 202609240001_claim_moderation_and_appeals.sql
-- Description: Claim reports, high-risk restrictions, Sheriff moderation evidence, 7-day appeals with reviewer segregation, and bounty pause.

-- 1. Extend claim_status enum for appeals and restrictions
alter type public.claim_status add value if not exists 'restricted';
alter type public.claim_status add value if not exists 'appeal_pending';

-- 2. Add restriction and pause fields
alter table public.claims
  add column if not exists is_restricted boolean not null default false,
  add column if not exists restriction_reason text check (restriction_reason is null or char_length(restriction_reason) <= 500);

alter table public.wanted_requests
  add column if not exists is_paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists total_paused_duration interval not null default '0 seconds'::interval;

-- 3. Create claim report category and status types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_report_category') then
    create type public.claim_report_category as enum (
      'restricted_material',
      'rights_issue',
      'wrong_file',
      'personal_data',
      'malware',
      'fraud',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_report_status') then
    create type public.claim_report_status as enum (
      'pending',
      'investigating',
      'resolved',
      'dismissed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_appeal_status') then
    create type public.claim_appeal_status as enum (
      'pending',
      'upheld',
      'overturned',
      'dismissed'
    );
  end if;
end $$;

-- 4. Create claim_reports table
create table if not exists public.claim_reports (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete restrict,
  reporter_user_id uuid not null references public.profiles (user_id) on delete restrict,
  category public.claim_report_category not null,
  description text not null check (char_length(description) between 10 and 2000),
  is_high_risk boolean not null default false,
  status public.claim_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.profiles (user_id) on delete restrict,
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes) <= 2000)
);

create index if not exists claim_reports_claim on public.claim_reports (claim_id, created_at desc);
create index if not exists claim_reports_status on public.claim_reports (status, created_at desc);

-- 5. Create claim_appeals table
create table if not exists public.claim_appeals (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete restrict,
  original_review_id uuid not null references public.claim_reviews (id) on delete restrict,
  appellant_user_id uuid not null references public.profiles (user_id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.claim_appeal_status not null default 'pending',
  appeal_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  reviewer_user_id uuid references public.profiles (user_id) on delete restrict,
  decision public.claim_appeal_status check (decision in ('upheld', 'overturned', 'dismissed')),
  decision_reason_code text check (decision_reason_code is null or decision_reason_code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  decision_notes text check (decision_notes is null or char_length(decision_notes) <= 2000),
  check (created_at <= appeal_deadline)
);

create index if not exists claim_appeals_status on public.claim_appeals (status, created_at desc);
create index if not exists claim_appeals_appellant on public.claim_appeals (appellant_user_id);

-- 6. Enable RLS
alter table public.claim_reports enable row level security;
alter table public.claim_appeals enable row level security;

-- Policies for claim_reports
create policy claim_reports_read_own on public.claim_reports for select to authenticated
using (reporter_user_id = auth.uid());

create policy claim_reports_read_authorised_reviewers on public.claim_reports for select to authenticated
using (
  exists (
    select 1 from public.claims c
    where c.id = claim_id
      and (
        private.current_user_has_platform_role('owner')
        or private.current_user_has_platform_role('platform_sheriff')
        or private.current_user_is_institution_sheriff(c.institution_id)
      )
  )
);

-- Policies for claim_appeals
create policy claim_appeals_read_own on public.claim_appeals for select to authenticated
using (appellant_user_id = auth.uid());

create policy claim_appeals_read_authorised_reviewers on public.claim_appeals for select to authenticated
using (
  exists (
    select 1 from public.claims c
    where c.id = claim_id
      and (
        private.current_user_has_platform_role('owner')
        or private.current_user_has_platform_role('platform_sheriff')
        or private.current_user_is_institution_sheriff(c.institution_id)
      )
  )
);

-- 7. Secure Functions

-- 7.1 Submit Claim Report (with immediate high-risk restriction)
create or replace function public.submit_claim_report(
  target_claim_id uuid,
  target_category public.claim_report_category,
  target_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_claim public.claims%rowtype;
  v_report_id uuid;
  v_is_high_risk boolean := false;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_claim
  from public.claims
  where id = target_claim_id;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if target_category in ('personal_data', 'malware', 'fraud') then
    v_is_high_risk := true;
  end if;

  insert into public.claim_reports (
    claim_id,
    reporter_user_id,
    category,
    description,
    is_high_risk,
    status
  )
  values (
    target_claim_id,
    actor_id,
    target_category,
    target_description,
    v_is_high_risk,
    'pending'
  )
  returning id into v_report_id;

  if v_is_high_risk then
    update public.claims
    set is_restricted = true,
        restriction_reason = 'High-risk report under investigation: ' || target_category::text,
        status = 'restricted',
        updated_at = now()
    where id = target_claim_id;
  end if;

  return v_report_id;
end;
$$;

-- 7.2 Submit Claim Appeal (7-day window & Wanted pause)
create or replace function public.submit_claim_appeal(
  target_claim_id uuid,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_claim public.claims%rowtype;
  v_latest_review public.claim_reviews%rowtype;
  v_appeal_id uuid;
  v_deadline timestamptz;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_claim
  from public.claims
  where id = target_claim_id;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if v_claim.hunter_user_id <> actor_id then
    raise exception 'only claim owner can appeal' using errcode = '42501';
  end if;

  if v_claim.status not in ('rejected', 'restricted') then
    raise exception 'only rejected or restricted claims can be appealed' using errcode = 'P0001';
  end if;

  -- Find latest review for this claim
  select * into v_latest_review
  from public.claim_reviews
  where claim_id = target_claim_id
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'no prior review record found for claim' using errcode = 'P0002';
  end if;

  v_deadline := v_latest_review.created_at + interval '7 days';
  if now() > v_deadline then
    raise exception 'appeal window has expired (7 days)' using errcode = 'P0001';
  end if;

  -- Check single appeal constraint
  if exists (select 1 from public.claim_appeals where claim_id = target_claim_id) then
    raise exception 'an appeal has already been submitted for this claim' using errcode = '23505';
  end if;

  insert into public.claim_appeals (
    claim_id,
    original_review_id,
    appellant_user_id,
    reason,
    status,
    appeal_deadline
  )
  values (
    target_claim_id,
    v_latest_review.id,
    actor_id,
    target_reason,
    'pending',
    v_deadline
  )
  returning id into v_appeal_id;

  -- Update claim status to appeal_pending
  update public.claims
  set status = 'appeal_pending',
      updated_at = now()
  where id = target_claim_id;

  -- Pause parent wanted request countdown and refunds
  update public.wanted_requests
  set is_paused = true,
      paused_at = coalesce(paused_at, now()),
      updated_at = now()
  where id = v_claim.wanted_request_id;

  return v_appeal_id;
end;
$$;

-- 7.3 Record Claim Appeal Decision (Segregation of Duties & Bounty Resume)
create or replace function public.record_claim_appeal_decision(
  target_appeal_id uuid,
  target_decision public.claim_appeal_status,
  target_reason_code text,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_appeal public.claim_appeals%rowtype;
  v_original_review public.claim_reviews%rowtype;
  v_claim public.claims%rowtype;
  v_wanted public.wanted_requests%rowtype;
  v_active_appeals_count int;
  v_pause_duration interval;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if target_decision not in ('upheld', 'overturned', 'dismissed') then
    raise exception 'invalid appeal decision' using errcode = '22023';
  end if;

  select * into v_appeal
  from public.claim_appeals
  where id = target_appeal_id and status = 'pending';

  if not found then
    raise exception 'pending appeal not found' using errcode = 'P0002';
  end if;

  select * into v_original_review
  from public.claim_reviews
  where id = v_appeal.original_review_id;

  select * into v_claim
  from public.claims
  where id = v_appeal.claim_id;

  select * into v_wanted
  from public.wanted_requests
  where id = v_claim.wanted_request_id;

  -- Segregation of Reviewers Invariant:
  if actor_id = v_original_review.reviewer_user_id then
    raise exception 'segregation of duties: original reviewer cannot review appeal' using errcode = '42501';
  end if;

  if actor_id = v_appeal.appellant_user_id then
    raise exception 'appellant cannot review own appeal' using errcode = '42501';
  end if;

  -- Reviewer authorization check
  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(v_claim.institution_id)
  ) then
    raise exception 'reviewer not authorized' using errcode = '42501';
  end if;

  -- Update appeal record
  update public.claim_appeals
  set status = target_decision,
      decision = target_decision,
      decision_reason_code = target_reason_code,
      decision_notes = target_notes,
      reviewer_user_id = actor_id,
      decided_at = now()
  where id = target_appeal_id;

  -- Update claim status based on appeal decision
  if target_decision = 'overturned' then
    update public.claims
    set status = 'under_review',
        is_restricted = false,
        restriction_reason = null,
        updated_at = now()
    where id = v_claim.id;
  else
    -- Upheld or dismissed: claim remains rejected
    update public.claims
    set status = 'rejected',
        updated_at = now()
    where id = v_claim.id;
  end if;

  -- Check if there are other pending appeals on the same Wanted request
  select count(*) into v_active_appeals_count
  from public.claim_appeals a
  join public.claims c on c.id = a.claim_id
  where c.wanted_request_id = v_wanted.id
    and a.status = 'pending';

  -- If no remaining active appeals on this Wanted request, resume countdown and extend closes_at
  if v_active_appeals_count = 0 and v_wanted.is_paused then
    if v_wanted.paused_at is not null then
      v_pause_duration := now() - v_wanted.paused_at;
    else
      v_pause_duration := '0 seconds'::interval;
    end if;

    update public.wanted_requests
    set is_paused = false,
        paused_at = null,
        total_paused_duration = total_paused_duration + v_pause_duration,
        closes_at = case
          when closes_at is not null then closes_at + v_pause_duration
          else null
        end,
        updated_at = now()
    where id = v_wanted.id;
  end if;
end;
$$;

-- 8. Grants
grant select on public.claim_reports to authenticated;
grant select on public.claim_appeals to authenticated;

revoke all on function public.submit_claim_report(uuid, public.claim_report_category, text) from public;
grant execute on function public.submit_claim_report(uuid, public.claim_report_category, text) to authenticated;

revoke all on function public.submit_claim_appeal(uuid, text) from public;
grant execute on function public.submit_claim_appeal(uuid, text) to authenticated;

revoke all on function public.record_claim_appeal_decision(uuid, public.claim_appeal_status, text, text) from public;
grant execute on function public.record_claim_appeal_decision(uuid, public.claim_appeal_status, text, text) to authenticated;
