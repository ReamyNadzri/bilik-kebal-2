-- Paid missing-item and discussion requests, the lifetime free-request
-- allowance with reward codes, member requests for new taxonomy entries, and
-- the UiTM campus list for the map.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-24):
-- * Missing items and discussions may carry a bounty or be free.
-- * A paid missing-item or discussion bounty is released only after the poster
--   names the member who helped and a Sheriff approves that request. Approval
--   creates the same manual payout task an approved claim creates; no money
--   moves without a recorded human Sheriff decision.
-- * Every member may publish 3 free requests in their lifetime. Reward codes
--   add more: each code has a word, a number of free requests per redemption
--   and a maximum number of redemptions; a member redeems a code once.
-- * Members cannot type their own taxonomy into a request. They ask a Sheriff
--   to add the entry, and are told in-app and by email when it is decided.

-- ---------------------------------------------------------------------------
-- 1. Request fields: session optional; missing items and discussions may be paid
-- ---------------------------------------------------------------------------

alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
alter table public.wanted_requests
  add constraint wanted_requests_kind_fields_check check (
    (
      kind = 'academic'
      and faculty_id is not null
      and programme_id is not null
      and course_id is not null
      and resource_type_id is not null
      and language_id is not null
      and last_seen_location is null
    )
    or kind in ('missing_item', 'discussion')
  );

-- The academic session is optional. Every other academic field is unchanged.
create or replace function private.wanted_taxonomy_is_valid(
  target_institution_id uuid,
  target_campus_id uuid,
  target_faculty_id uuid,
  target_programme_id uuid,
  target_course_id uuid,
  target_academic_session_id uuid,
  target_resource_type_id uuid,
  target_language_id uuid,
  target_tag_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    cardinality(target_tag_ids) <= 5
    and cardinality(target_tag_ids) = (
      select count(distinct tag_id)::integer from unnest(target_tag_ids) as tag_id
    )
    and exists (
      select 1 from public.campuses
      where id = target_campus_id and institution_id = target_institution_id and active
        and region_open
    )
    and exists (
      select 1 from public.faculties
      where id = target_faculty_id and institution_id = target_institution_id and active
    )
    and exists (
      select 1 from public.programmes
      where id = target_programme_id and institution_id = target_institution_id
        and faculty_id = target_faculty_id and active
    )
    and exists (
      select 1 from public.courses
      where id = target_course_id and institution_id = target_institution_id
        and programme_id = target_programme_id and active
    )
    and (
      target_academic_session_id is null
      or exists (
        select 1 from public.academic_sessions
        where id = target_academic_session_id and institution_id = target_institution_id and active
      )
    )
    and exists (select 1 from public.resource_types where id = target_resource_type_id and active)
    and exists (select 1 from public.languages where id = target_language_id and active)
    and cardinality(target_tag_ids) = (
      select count(*)::integer from public.tags where id = any(target_tag_ids) and active
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. Reward codes and the lifetime free-request allowance
-- ---------------------------------------------------------------------------

create table public.reward_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Za-z0-9-]{3,32}$'),
  credits_per_redemption integer not null check (credits_per_redemption between 1 and 20),
  max_redemptions integer not null check (max_redemptions between 1 and 100000),
  redemption_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (redemption_count between 0 and max_redemptions)
);
-- Codes are matched without regard to case, so "RAYA2026" and "raya2026" are one code.
create unique index reward_codes_code_uniq on public.reward_codes (upper(code));
alter table public.reward_codes enable row level security;
revoke all on public.reward_codes from public, anon, authenticated;

create table public.reward_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_code_id uuid not null references public.reward_codes (id) on delete restrict,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  credits integer not null check (credits between 1 and 20),
  redeemed_at timestamptz not null default now(),
  unique (reward_code_id, user_id)
);
create index reward_code_redemptions_user on public.reward_code_redemptions (user_id);
alter table public.reward_code_redemptions enable row level security;
revoke all on public.reward_code_redemptions from public, anon, authenticated;
grant select on public.reward_code_redemptions to authenticated;
create policy reward_code_redemptions_read_own on public.reward_code_redemptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Every attempt, so guessing codes can be slowed down.
create table private.reward_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index reward_code_attempts_user on private.reward_code_attempts (user_id, created_at desc);

create function private.free_request_allowance(target_user_id uuid)
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
        where r.user_id = target_user_id
      ), 0) as bonus,
      (
        select count(*)::integer from public.wanted_requests w
        where w.commissioner_user_id = target_user_id and w.is_free and w.status <> 'draft'
      ) as used
  )
  select base, bonus, used, greatest(base + bonus - used, 0) from totals;
$$;
revoke all on function private.free_request_allowance(uuid) from public;

create function public.my_free_request_allowance()
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.free_request_allowance(auth.uid());
$$;
revoke all on function public.my_free_request_allowance() from public, anon;
grant execute on function public.my_free_request_allowance() to authenticated;

-- Locks the member's profile row so two publications at once cannot both take
-- the last free request.
create function private.take_free_request_slot()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where user_id = auth.uid() for update;
  if (select remaining from private.free_request_allowance(auth.uid())) <= 0 then
    raise exception using errcode = 'P0001', message = 'wanted_free_limit_reached';
  end if;
end;
$$;
revoke all on function private.take_free_request_slot() from public;

-- Returns 'redeemed', 'invalid', 'already_redeemed', 'exhausted' or
-- 'rate_limited'. A refusal is an answer, not an error, so the attempt is kept.
create function public.redeem_reward_code(target_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  found_code public.reward_codes%rowtype;
begin
  if actor_id is null or not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'reward_code_not_eligible';
  end if;

  if (
    select count(*) from private.reward_code_attempts
    where user_id = actor_id and not succeeded and created_at > now() - interval '1 hour'
  ) >= 10 then
    return 'rate_limited';
  end if;

  select * into found_code from public.reward_codes
  where upper(code) = upper(trim(coalesce(target_code, '')))
    and active
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'invalid';
  end if;
  if exists (
    select 1 from public.reward_code_redemptions
    where reward_code_id = found_code.id and user_id = actor_id
  ) then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'already_redeemed';
  end if;
  if found_code.redemption_count >= found_code.max_redemptions then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'exhausted';
  end if;

  insert into public.reward_code_redemptions (reward_code_id, user_id, credits)
  values (found_code.id, actor_id, found_code.credits_per_redemption);
  update public.reward_codes set redemption_count = redemption_count + 1 where id = found_code.id;
  insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, true);
  return 'redeemed';
end;
$$;
revoke all on function public.redeem_reward_code(text) from public, anon;
grant execute on function public.redeem_reward_code(text) to authenticated;

-- Owner-only. Codes can also be inserted from the SQL editor.
create function public.create_reward_code(
  target_code text,
  target_credits integer,
  target_max_redemptions integer,
  target_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  if not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'reward_code_owner_only';
  end if;
  insert into public.reward_codes (code, credits_per_redemption, max_redemptions, expires_at, created_by)
  values (trim(target_code), target_credits, target_max_redemptions, target_expires_at, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_reward_code(text, integer, integer, timestamptz) from public, anon;
grant execute on function public.create_reward_code(text, integer, integer, timestamptz) to authenticated;

-- Free academic publication: unchanged except that it takes a free slot.
create or replace function public.publish_free_wanted(
  target_draft_id uuid,
  target_token_hash_hex text,
  target_criteria_hash_hex text,
  target_policy_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_check public.wanted_duplicate_checks%rowtype;
  draft public.wanted_requests%rowtype;
begin
  select * into draft from public.wanted_requests
  where id = target_draft_id
    and commissioner_user_id = auth.uid()
    and status = 'draft'
    and private.current_user_can_transact_at(institution_id)
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'wanted_editable_draft_not_found';
  end if;

  perform private.take_free_request_slot();

  select * into duplicate_check
  from public.wanted_duplicate_checks
  where wanted_request_id = target_draft_id
    and token_hash = decode(target_token_hash_hex, 'hex')
    and criteria_hash = decode(target_criteria_hash_hex, 'hex')
  order by created_at desc
  limit 1
  for update;

  if duplicate_check.id is null or duplicate_check.consumed_at is not null then
    return 'required';
  end if;
  if duplicate_check.expires_at <= now() then
    return 'expired';
  end if;

  update public.wanted_duplicate_checks set consumed_at = now() where id = duplicate_check.id;
  update public.wanted_requests set
    status = 'open',
    is_free = true,
    duration_days_snapshot = draft.requested_duration_days,
    fee_rate_basis_points_snapshot = 0,
    policy_version_snapshot = target_policy_version,
    access_basis_snapshot = 'commissioner_free',
    published_at = now(),
    closes_at = now() + make_interval(days => draft.requested_duration_days)
  where id = target_draft_id;

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target_draft_id, 'wanted_posted_free', 'Posted as a free request');
  return 'published';
end;
$$;

-- Free missing item or discussion: unchanged except that it takes a free slot.
create or replace function public.publish_community_wanted(
  target_kind public.wanted_kind,
  target_campus_id uuid,
  target_title text,
  target_description text,
  target_duration_days smallint,
  target_last_seen_location text,
  target_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_institution_id uuid := private.actor_verified_institution();
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or actor_institution_id is null then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if target_kind not in ('missing_item', 'discussion') then
    raise exception using errcode = '22023', message = 'wanted_kind_invalid';
  end if;
  if target_policy_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:\.[0-9]+)?$' then
    raise exception using errcode = '22023', message = 'wanted_policy_invalid';
  end if;
  if not exists (
    select 1 from public.campuses
    where id = target_campus_id and institution_id = actor_institution_id and active and region_open
  ) then
    raise exception using errcode = '22023', message = 'wanted_region_closed';
  end if;

  perform private.take_free_request_slot();

  insert into public.wanted_requests (
    id, kind, is_free, commissioner_user_id, institution_id, campus_id, title, description,
    last_seen_location, requested_duration_days, status, duration_days_snapshot,
    fee_rate_basis_points_snapshot, policy_version_snapshot, access_basis_snapshot,
    policy_accepted_at, published_at, closes_at
  ) values (
    new_id, target_kind, true, auth.uid(), actor_institution_id, target_campus_id,
    trim(target_title), trim(target_description),
    case when target_kind = 'missing_item' then nullif(trim(coalesce(target_last_seen_location, '')), '') end,
    target_duration_days, 'open', target_duration_days, 0, target_policy_version,
    'commissioner_free', now(), now(), now() + make_interval(days => target_duration_days)
  );

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (
    new_id,
    'wanted_posted_free',
    case when target_kind = 'missing_item' then 'Missing item reported' else 'Discussion opened' end
  );
  return new_id;
end;
$$;

-- A paid missing item or discussion starts as a draft, like a paid academic
-- request. It opens only after the first contribution is verified through the
-- existing contribution path (create_contribution_intent is kind-agnostic).
create function public.create_community_draft(
  target_kind public.wanted_kind,
  target_campus_id uuid,
  target_title text,
  target_description text,
  target_duration_days smallint,
  target_last_seen_location text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_institution_id uuid := private.actor_verified_institution();
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or actor_institution_id is null then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if target_kind not in ('missing_item', 'discussion') then
    raise exception using errcode = '22023', message = 'wanted_kind_invalid';
  end if;
  if not exists (
    select 1 from public.campuses
    where id = target_campus_id and institution_id = actor_institution_id and active and region_open
  ) then
    raise exception using errcode = '22023', message = 'wanted_region_closed';
  end if;

  insert into public.wanted_requests (
    id, kind, is_free, commissioner_user_id, institution_id, campus_id, title, description,
    last_seen_location, requested_duration_days, policy_accepted_at
  ) values (
    new_id, target_kind, false, auth.uid(), actor_institution_id, target_campus_id,
    trim(target_title), trim(target_description),
    case when target_kind = 'missing_item' then nullif(trim(coalesce(target_last_seen_location, '')), '') end,
    target_duration_days, now()
  );
  return new_id;
end;
$$;
revoke all on function public.create_community_draft(public.wanted_kind, uuid, text, text, smallint, text) from public, anon;
grant execute on function public.create_community_draft(public.wanted_kind, uuid, text, text, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Paid missing items and discussions: the poster names the finder, a
--    Sheriff approves, and only then is a payout task created
-- ---------------------------------------------------------------------------

create table public.community_payout_requests (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  requester_user_id uuid not null references public.profiles (user_id) on delete restrict,
  finder_user_id uuid not null references public.profiles (user_id) on delete restrict,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_user_id uuid references public.profiles (user_id) on delete restrict,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (finder_user_id <> requester_user_id)
);
-- One open request per Wanted, and at most one approval ever.
create unique index community_payout_requests_one_pending
  on public.community_payout_requests (wanted_request_id) where status = 'pending';
create unique index community_payout_requests_one_approved
  on public.community_payout_requests (wanted_request_id) where status = 'approved';
create index community_payout_requests_status on public.community_payout_requests (status, created_at);

alter table public.community_payout_requests enable row level security;
revoke all on public.community_payout_requests from public, anon, authenticated;
grant select on public.community_payout_requests to authenticated;
create policy community_payout_requests_read_parties on public.community_payout_requests
  for select to authenticated
  using (requester_user_id = (select auth.uid()) or finder_user_id = (select auth.uid()));
create policy community_payout_requests_read_reviewers on public.community_payout_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.wanted_requests w
      where w.id = wanted_request_id
        and (
          private.current_user_has_platform_role('owner')
          or private.current_user_has_platform_role('platform_sheriff')
          or private.current_user_is_institution_sheriff(w.institution_id)
        )
    )
  );

-- A payout task now comes from an approved claim or an approved finder request.
alter table public.payout_tasks
  alter column claim_id drop not null,
  add column community_payout_request_id uuid unique
    references public.community_payout_requests (id) on delete restrict,
  add constraint payout_tasks_source_check check (
    (claim_id is not null) <> (community_payout_request_id is not null)
  );

create function public.request_community_payout(
  target_public_id uuid,
  finder_public_id uuid,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
  finder_id uuid;
  new_id uuid;
begin
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = auth.uid()
  for update;
  if not found or target.kind not in ('missing_item', 'discussion') or target.is_free
    or target.status not in ('open', 'closed', 'expired') then
    raise exception using errcode = '42501', message = 'community_payout_not_requestable';
  end if;
  if not exists (select 1 from public.contributions c where c.wanted_request_id = target.id) then
    raise exception using errcode = 'P0001', message = 'community_payout_no_bounty';
  end if;

  select user_id into finder_id from public.profiles where public_id = finder_public_id;
  if finder_id is null or finder_id = auth.uid() then
    raise exception using errcode = '22023', message = 'community_payout_finder_invalid';
  end if;

  insert into public.community_payout_requests (wanted_request_id, requester_user_id, finder_user_id, note)
  values (target.id, auth.uid(), finder_id, nullif(trim(coalesce(target_note, '')), ''))
  returning id into new_id;

  update public.wanted_requests set status = 'reviewing', updated_at = now() where id = target.id;
  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'payout_requested', 'The poster asked a Sheriff to release the bounty');
  return new_id;
end;
$$;
revoke all on function public.request_community_payout(uuid, uuid, text) from public, anon;
grant execute on function public.request_community_payout(uuid, uuid, text) to authenticated;

create function public.decide_community_payout(
  target_request_id uuid,
  approve boolean,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_row public.community_payout_requests%rowtype;
  target public.wanted_requests%rowtype;
  v_gross_sen bigint;
  v_fee_bps integer;
  v_fee_sen bigint;
  v_payout_id uuid;
begin
  select * into request_row from public.community_payout_requests
  where id = target_request_id and status = 'pending'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'community_payout_request_not_found';
  end if;
  select * into strict target from public.wanted_requests where id = request_row.wanted_request_id for update;

  if actor_id is null or not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(target.institution_id)
  ) then
    raise exception using errcode = '42501', message = 'community_payout_reviewer_not_authorized';
  end if;
  if actor_id in (request_row.requester_user_id, request_row.finder_user_id) then
    raise exception using errcode = '42501', message = 'community_payout_reviewer_conflicted';
  end if;

  update public.community_payout_requests set
    status = case when approve then 'approved' else 'rejected' end,
    reviewer_user_id = actor_id,
    decision_note = nullif(trim(coalesce(target_note, '')), ''),
    decided_at = now()
  where id = target_request_id;

  if not approve then
    update public.wanted_requests set status = 'open', updated_at = now()
    where id = target.id and status = 'reviewing' and closes_at > now();
    update public.wanted_requests set status = 'expired', updated_at = now()
    where id = target.id and status = 'reviewing';
    perform public.enqueue_notification(
      target_request_id, request_row.requester_user_id, 'community_payout_rejected', target.public_id
    );
    return null;
  end if;

  select coalesce(sum(amount_sen), 0) into v_gross_sen
  from public.contributions where wanted_request_id = target.id;
  if v_gross_sen = 0 then
    raise exception using errcode = 'P0001', message = 'community_payout_no_bounty';
  end if;
  v_fee_bps := coalesce(target.fee_rate_basis_points_snapshot, 1000);
  v_fee_sen := (v_gross_sen * v_fee_bps) / 10000;

  insert into public.payout_tasks (
    wanted_request_id, community_payout_request_id, hunter_user_id, gross_bounty_sen,
    fee_rate_basis_points, platform_fee_sen, net_payout_sen, status
  ) values (
    target.id, target_request_id, request_row.finder_user_id, v_gross_sen,
    v_fee_bps, v_fee_sen, v_gross_sen - v_fee_sen, 'pending'
  )
  returning id into v_payout_id;

  update public.wanted_requests set status = 'fulfilled', updated_at = now() where id = target.id;
  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'payout_approved', 'A Sheriff approved the bounty release');

  perform public.enqueue_notification(
    target_request_id, request_row.requester_user_id, 'community_payout_approved', target.public_id
  );
  perform public.enqueue_notification(
    target_request_id, request_row.finder_user_id, 'community_bounty_awarded', target.public_id
  );
  return v_payout_id;
end;
$$;
revoke all on function public.decide_community_payout(uuid, boolean, text) from public, anon;
grant execute on function public.decide_community_payout(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Requests for new taxonomy entries
-- ---------------------------------------------------------------------------

create table public.taxonomy_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles (user_id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  category text not null check (category in (
    'campus', 'faculty', 'programme', 'course', 'academic_session', 'resource_type', 'tag'
  )),
  label text not null check (char_length(label) between 2 and 160 and label = trim(label)),
  course_code text check (course_code is null or course_code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  parent_faculty_id uuid references public.faculties (id) on delete cascade,
  parent_programme_id uuid references public.programmes (id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_user_id uuid references public.profiles (user_id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  created_item_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (category <> 'programme' or parent_faculty_id is not null),
  check (category <> 'course' or (parent_programme_id is not null and course_code is not null))
);
create index taxonomy_requests_status on public.taxonomy_requests (status, created_at);
create index taxonomy_requests_requester on public.taxonomy_requests (requester_user_id, created_at desc);

alter table public.taxonomy_requests enable row level security;
revoke all on public.taxonomy_requests from public, anon, authenticated;
grant select on public.taxonomy_requests to authenticated;
create policy taxonomy_requests_read_own on public.taxonomy_requests
  for select to authenticated using (requester_user_id = (select auth.uid()));
create policy taxonomy_requests_read_reviewers on public.taxonomy_requests
  for select to authenticated
  using (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(institution_id)
  );

create function private.slugify(source text, suffix text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(left(trim(both '-' from regexp_replace(lower(source), '[^a-z0-9]+', '-', 'g')), 60), ''),
    'item'
  ) || '-' || suffix;
$$;

create function public.submit_taxonomy_request(
  target_category text,
  target_label text,
  target_course_code text default null,
  target_parent_id uuid default null,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_institution_id uuid := private.actor_verified_institution();
  new_id uuid;
begin
  if auth.uid() is null or actor_institution_id is null then
    raise exception using errcode = '42501', message = 'taxonomy_request_not_eligible';
  end if;
  if (
    select count(*) from public.taxonomy_requests
    where requester_user_id = auth.uid() and status = 'pending'
  ) >= 10 then
    raise exception using errcode = 'P0001', message = 'taxonomy_request_limit_reached';
  end if;
  if target_category = 'programme' and not exists (
    select 1 from public.faculties where id = target_parent_id and institution_id = actor_institution_id
  ) then
    raise exception using errcode = '22023', message = 'taxonomy_request_parent_invalid';
  end if;
  if target_category = 'course' and not exists (
    select 1 from public.programmes where id = target_parent_id and institution_id = actor_institution_id
  ) then
    raise exception using errcode = '22023', message = 'taxonomy_request_parent_invalid';
  end if;

  insert into public.taxonomy_requests (
    requester_user_id, institution_id, category, label, course_code,
    parent_faculty_id, parent_programme_id, note
  ) values (
    auth.uid(), actor_institution_id, target_category, trim(target_label),
    case when target_category = 'course' then upper(trim(target_course_code)) end,
    case when target_category = 'programme' then target_parent_id end,
    case when target_category = 'course' then target_parent_id end,
    nullif(trim(coalesce(target_note, '')), '')
  )
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_taxonomy_request(text, text, text, uuid, text) from public, anon;
grant execute on function public.submit_taxonomy_request(text, text, text, uuid, text) to authenticated;

create function public.decide_taxonomy_request(
  target_request_id uuid,
  approve boolean,
  target_note text default null,
  open_region boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  req public.taxonomy_requests%rowtype;
  suffix text;
  item_id uuid;
begin
  select * into req from public.taxonomy_requests
  where id = target_request_id and status = 'pending'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'taxonomy_request_not_found';
  end if;
  if actor_id is null or not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(req.institution_id)
  ) then
    raise exception using errcode = '42501', message = 'taxonomy_reviewer_not_authorized';
  end if;

  if approve then
    suffix := left(replace(req.id::text, '-', ''), 6);
    case req.category
      when 'campus' then
        insert into public.campuses (institution_id, slug, name, region_open)
        values (req.institution_id, private.slugify(req.label, suffix), req.label, open_region)
        returning id into item_id;
      when 'faculty' then
        insert into public.faculties (institution_id, slug, name)
        values (req.institution_id, private.slugify(req.label, suffix), req.label)
        returning id into item_id;
      when 'programme' then
        insert into public.programmes (institution_id, faculty_id, slug, name)
        values (req.institution_id, req.parent_faculty_id, private.slugify(req.label, suffix), req.label)
        returning id into item_id;
      when 'course' then
        if exists (
          select 1 from public.courses where institution_id = req.institution_id and code = req.course_code
        ) then
          raise exception using errcode = '23505', message = 'taxonomy_course_code_exists';
        end if;
        insert into public.courses (institution_id, programme_id, slug, code, name)
        values (
          req.institution_id, req.parent_programme_id,
          private.slugify(req.course_code || ' ' || req.label, suffix), req.course_code, req.label
        )
        returning id into item_id;
      when 'academic_session' then
        insert into public.academic_sessions (institution_id, slug, name)
        values (req.institution_id, private.slugify(req.label, suffix), req.label)
        returning id into item_id;
      when 'resource_type' then
        insert into public.resource_types (slug, name)
        values (private.slugify(req.label, suffix), left(req.label, 100))
        returning id into item_id;
      when 'tag' then
        insert into public.tags (slug, name)
        values (private.slugify(req.label, suffix), left(req.label, 80))
        returning id into item_id;
    end case;
  end if;

  update public.taxonomy_requests set
    status = case when approve then 'approved' else 'rejected' end,
    reviewer_user_id = actor_id,
    decision_note = nullif(trim(coalesce(target_note, '')), ''),
    created_item_id = item_id,
    decided_at = now()
  where id = target_request_id;

  perform public.enqueue_notification(
    target_request_id,
    req.requester_user_id,
    case when approve then 'taxonomy_request_approved' else 'taxonomy_request_rejected' end,
    target_request_id
  );
  return item_id;
end;
$$;
revoke all on function public.decide_taxonomy_request(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.decide_taxonomy_request(uuid, boolean, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Notification kinds (all emailed except replies, as before)
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
  'institution_verification_approved', 'institution_verification_rejected',
  'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated',
  'wanted_reply',
  'taxonomy_request_approved', 'taxonomy_request_rejected',
  'community_payout_approved', 'community_payout_rejected', 'community_bounty_awarded'
));

-- ---------------------------------------------------------------------------
-- 6. UiTM campuses for the map
-- ---------------------------------------------------------------------------
-- Open: Shah Alam, Puncak Alam, Kuala Terengganu, Dungun, Bukit Besi. The
-- other branch campuses are added locked, so they appear on the map as
-- "coming soon" and cannot take requests. Rows are added only when no campus
-- with that name exists, under the same institution as Shah Alam.

insert into public.campuses (
  institution_id, slug, name, active, sort_order, region_open, latitude, longitude, map_x, map_y
)
select uitm.institution_id, v.slug, v.name, true, v.sort_order, v.region_open, v.lat, v.lng, v.mx, v.my
from (
  select institution_id from public.campuses where name ilike '%shah alam%' limit 1
) as uitm
cross join (values
  ('kuala-terengganu', 'UiTM Kuala Terengganu', 'kuala terengganu', 3, true,  5.26010, 103.18390, 40.0, 33.0),
  ('dungun',           'UiTM Dungun',           'dungun',           4, true,  4.79530, 103.42010, 41.0, 39.0),
  ('bukit-besi',       'UiTM Bukit Besi',       'bukit besi',       5, true,  4.64830, 103.19990, 38.0, 41.0),
  ('arau',             'UiTM Arau',             'arau',            10, false, 6.44540, 100.27830,  7.0, 13.0),
  ('sungai-petani',    'UiTM Sungai Petani',    'sungai petani',   11, false, 5.63480, 100.52050, 14.0, 22.0),
  ('permatang-pauh',   'UiTM Permatang Pauh',   'permatang pauh',  12, false, 5.36120, 100.43580,  6.0, 31.0),
  ('seri-iskandar',    'UiTM Seri Iskandar',    'seri iskandar',   13, false, 4.35780, 100.97870, 17.0, 37.0),
  ('machang',          'UiTM Machang',          'machang',         14, false, 5.76080, 102.21740, 28.0, 26.0),
  ('raub',             'UiTM Raub',             'raub',            15, false, 3.73860, 101.85070, 32.0, 51.0),
  ('kuala-pilah',      'UiTM Kuala Pilah',      'kuala pilah',     16, false, 2.79190, 102.25680, 21.0, 60.0),
  ('alor-gajah',       'UiTM Alor Gajah',       'alor gajah',      17, false, 2.37260, 102.18480, 25.0, 69.0),
  ('segamat',          'UiTM Segamat',          'segamat',         18, false, 2.51170, 102.82070, 34.0, 77.0),
  ('samarahan',        'UiTM Samarahan',        'samarahan',       19, false, 1.45440, 110.43310, 62.0, 63.0),
  ('kota-kinabalu',    'UiTM Kota Kinabalu',    'kota kinabalu',   20, false, 5.96110, 116.09380, 86.0, 53.0)
) as v(slug, name, match, sort_order, region_open, lat, lng, mx, my)
where not exists (
  select 1 from public.campuses c
  where c.institution_id = uitm.institution_id and c.name ilike '%' || v.match || '%'
)
on conflict (institution_id, slug) do nothing;

-- Existing rows for the open campuses are opened and placed.
update public.campuses
set region_open = true, latitude = 5.26010, longitude = 103.18390, map_x = 40, map_y = 33
where name ilike '%kuala terengganu%';
update public.campuses
set region_open = true, latitude = 4.79530, longitude = 103.42010, map_x = 41, map_y = 39
where name ilike '%dungun%';
update public.campuses
set region_open = true, latitude = 4.64830, longitude = 103.19990, map_x = 38, map_y = 41
where name ilike '%bukit besi%';

-- Replies stay readable while a bounty release is reviewed and after it.
drop policy if exists wanted_replies_read on public.wanted_replies;
create policy wanted_replies_read on public.wanted_replies for select to authenticated
using (
  hidden_at is null
  and private.current_user_is_email_verified()
  and exists (
    select 1 from public.wanted_requests w
    where w.id = wanted_replies.wanted_request_id
      and w.kind in ('missing_item', 'discussion')
      and w.status in ('open', 'reviewing', 'expired', 'fulfilled', 'closed')
  )
);

-- ---------------------------------------------------------------------------
-- 7. Drawn avatars: a member may pick one of the twelve drawn characters
--    instead of uploading a photo. An uploaded photo and a drawn avatar are
--    exclusive; choosing one clears the other.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_preset smallint check (avatar_preset between 0 and 11);

create or replace function public.set_own_avatar(new_object_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_public_id uuid := private.current_user_public_id();
begin
  if owner_public_id is null then
    raise exception using errcode = '28000', message = 'profile_auth_required';
  end if;
  if new_object_key is not null then
    if split_part(new_object_key, '/', 1) <> owner_public_id::text then
      raise exception using errcode = '42501', message = 'avatar_not_owned';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'avatars' and name = new_object_key
    ) then
      raise exception using errcode = 'P0002', message = 'avatar_not_uploaded';
    end if;
  end if;
  update public.profiles
  set avatar_object_key = new_object_key,
      avatar_preset = case when new_object_key is null then avatar_preset end,
      avatar_updated_at = now()
  where user_id = auth.uid();
end;
$$;

create function public.set_own_avatar_preset(new_preset smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'profile_auth_required';
  end if;
  if new_preset is not null and new_preset not between 0 and 11 then
    raise exception using errcode = '22023', message = 'avatar_preset_invalid';
  end if;
  update public.profiles
  set avatar_preset = new_preset,
      avatar_object_key = null,
      avatar_updated_at = now()
  where user_id = auth.uid();
end;
$$;
revoke all on function public.set_own_avatar_preset(smallint) from public, anon;
grant execute on function public.set_own_avatar_preset(smallint) to authenticated;
