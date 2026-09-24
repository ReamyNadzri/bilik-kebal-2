-- Migration: 202609290001_profiles_free_requests_and_regions.sql
-- Description: public profiles and avatars, request kinds (academic, missing item,
-- discussion), free (no-bounty) requests, community replies, region lock for
-- campuses, and a correction to the lifecycle check from 202609250001.
--
-- Public reads (profiles, replies, totals) go through the server's read service,
-- which checks the viewer before reading; these tables need no new read RPCs.
--
-- Product decisions recorded in context/progress-tracker.md (2026-09-24):
--   * Any Wanted may be posted free (no bounty, no fee, no payment step).
--   * Missing-item and discussion Wanteds are free-only; they take text replies,
--     never files, and any handover happens off-platform.
--   * Public profiles show display name, avatar, joined date, badges and the
--     Wanteds the person posted. Never email, evidence, claims or contributions.
--   * Only campuses whose region is open accept new Wanteds and appear on the map.

-- ---------------------------------------------------------------------------
-- 0. Corrections
-- ---------------------------------------------------------------------------

-- 202609250001 added the 'fulfilled' and 'closed' statuses but left the
-- lifecycle check naming only open/reviewing/expired, so approving a winning
-- claim violated the constraint. Re-create it with every published status.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.wanted_requests'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%awaiting_payment%'
    and pg_get_constraintdef(con.oid) like '%published_at%';
  if constraint_name is not null then
    execute format('alter table public.wanted_requests drop constraint %I', constraint_name);
  end if;
end $$;

-- Duration becomes a range (3 to 30 days) so the form can offer a slider.
alter table public.wanted_requests
  drop constraint if exists wanted_requests_requested_duration_days_check,
  drop constraint if exists wanted_requests_duration_days_snapshot_check;

alter table public.wanted_requests
  add constraint wanted_requests_requested_duration_days_check
    check (requested_duration_days between 3 and 30),
  add constraint wanted_requests_duration_days_snapshot_check
    check (duration_days_snapshot is null or duration_days_snapshot between 3 and 30),
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
      status in ('open', 'reviewing', 'expired', 'fulfilled', 'closed')
      and duration_days_snapshot is not null
      and fee_rate_basis_points_snapshot is not null
      and policy_version_snapshot is not null
      and access_basis_snapshot is not null
      and published_at is not null
      and closes_at > published_at
    )
  );

-- ---------------------------------------------------------------------------
-- 1. Profiles: public identifier, avatar and a short bio
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists public_id uuid not null default gen_random_uuid(),
  add column if not exists avatar_object_key text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists bio text;

alter table public.profiles
  add constraint profiles_public_id_key unique (public_id),
  add constraint profiles_avatar_object_key_check check (
    avatar_object_key is null
    or avatar_object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar-[0-9]{10,16}\.webp$'
  ),
  add constraint profiles_bio_check check (
    bio is null or (char_length(bio) between 1 and 160 and bio = trim(bio))
  );

create function private.current_user_public_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public_id from public.profiles where user_id = auth.uid();
$$;

revoke all on function private.current_user_public_id() from public;
grant execute on function private.current_user_public_id() to authenticated;

-- Avatars: public images, 512 KB, WebP only. The browser crops, rotates and
-- re-encodes before upload, which also strips any camera metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 524288, allowed_mime_types = array['image/webp'];

create policy avatars_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and private.current_user_is_email_verified()
  and (storage.foldername(name))[1] = private.current_user_public_id()::text
);

create policy avatars_update_own on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = private.current_user_public_id()::text
);

create policy avatars_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = private.current_user_public_id()::text
);

create function public.update_own_profile(new_display_name text, new_bio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'profile_auth_required';
  end if;
  update public.profiles
  set display_name = trim(new_display_name),
      bio = nullif(trim(coalesce(new_bio, '')), '')
  where user_id = auth.uid();
end;
$$;

revoke all on function public.update_own_profile(text, text) from public;
grant execute on function public.update_own_profile(text, text) to authenticated;

create function public.set_own_avatar(new_object_key text)
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
      avatar_updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.set_own_avatar(text) from public;
grant execute on function public.set_own_avatar(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Regions: only open campuses accept new Wanteds and appear on the map
-- ---------------------------------------------------------------------------

alter table public.campuses
  add column if not exists region_open boolean not null default false,
  add column if not exists latitude numeric(8, 5),
  add column if not exists longitude numeric(8, 5),
  -- Pin position on the illustrated map, as a percentage of its width and
  -- height. The illustration is not to scale, so it cannot be projected from
  -- latitude and longitude.
  add column if not exists map_x numeric(5, 2),
  add column if not exists map_y numeric(5, 2);

alter table public.campuses
  add constraint campuses_latitude_check check (latitude is null or latitude between -90 and 90),
  add constraint campuses_longitude_check check (longitude is null or longitude between -180 and 180),
  add constraint campuses_map_x_check check (map_x is null or map_x between 0 and 100),
  add constraint campuses_map_y_check check (map_y is null or map_y between 0 and 100);

-- The first open regions: Selangor (Shah Alam, Puncak Alam) and Terengganu
-- (Dungun, Bukit Besi). Coordinates are the public campus locations.
update public.campuses
set region_open = true, latitude = 3.06940, longitude = 101.50270, map_x = 16, map_y = 49
where name ilike '%shah alam%';
update public.campuses
set region_open = true, latitude = 3.24310, longitude = 101.42520, map_x = 14.5, map_y = 46
where name ilike '%puncak alam%';
update public.campuses
set region_open = true, latitude = 4.79530, longitude = 103.42010, map_x = 41, map_y = 39
where name ilike '%dungun%';
update public.campuses
set region_open = true, latitude = 4.64830, longitude = 103.19990, map_x = 38, map_y = 41
where name ilike '%bukit besi%';

-- Other campuses stay locked (region_open = false) but keep their place on
-- the map so members can see what is coming.
update public.campuses set map_x = 7, map_y = 13 where name ilike '%arau%';
update public.campuses set map_x = 14, map_y = 22 where name ilike '%sungai petani%';
update public.campuses set map_x = 6, map_y = 31 where name ilike '%pulau pinang%' or name ilike '%permatang pauh%';
update public.campuses set map_x = 17, map_y = 37 where name ilike '%seri iskandar%';
update public.campuses set map_x = 28, map_y = 26 where name ilike '%kota bharu%' or name ilike '%machang%';
update public.campuses set map_x = 32, map_y = 51 where name ilike '%raub%';
update public.campuses set map_x = 21, map_y = 60 where name ilike '%seremban%' or name ilike '%kuala pilah%';
update public.campuses set map_x = 25, map_y = 69 where name ilike '%jasin%' or name ilike '%alor gajah%';
update public.campuses set map_x = 34, map_y = 77 where name ilike '%segamat%';
update public.campuses set map_x = 62, map_y = 63 where name ilike '%samarahan%';
update public.campuses set map_x = 86, map_y = 53 where name ilike '%kota kinabalu%';

-- Taxonomy validation now also requires an open region. Same signature, so
-- every caller (create and update draft) picks it up.
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
    and exists (
      select 1 from public.academic_sessions
      where id = target_academic_session_id and institution_id = target_institution_id and active
    )
    and exists (select 1 from public.resource_types where id = target_resource_type_id and active)
    and exists (select 1 from public.languages where id = target_language_id and active)
    and cardinality(target_tag_ids) = (
      select count(*)::integer from public.tags where id = any(target_tag_ids) and active
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Request kinds and free requests
-- ---------------------------------------------------------------------------

create type public.wanted_kind as enum ('academic', 'missing_item', 'discussion');
alter type public.wanted_access_basis add value if not exists 'commissioner_free';

alter table public.wanted_requests
  add column if not exists kind public.wanted_kind not null default 'academic',
  add column if not exists is_free boolean not null default false,
  add column if not exists last_seen_location text,
  alter column faculty_id drop not null,
  alter column programme_id drop not null,
  alter column course_id drop not null,
  alter column academic_session_id drop not null,
  alter column resource_type_id drop not null,
  alter column language_id drop not null;

alter table public.wanted_requests
  add constraint wanted_requests_kind_fields_check check (
    (
      kind = 'academic'
      and faculty_id is not null
      and programme_id is not null
      and course_id is not null
      and academic_session_id is not null
      and resource_type_id is not null
      and language_id is not null
      and last_seen_location is null
    )
    or (kind in ('missing_item', 'discussion') and is_free)
  ),
  add constraint wanted_requests_last_seen_location_check check (
    last_seen_location is null
    or (char_length(last_seen_location) between 2 and 160 and last_seen_location = trim(last_seen_location))
  );

-- Visible statuses now include the archive (fulfilled, closed).
drop policy if exists wanted_requests_read on public.wanted_requests;
create policy wanted_requests_read on public.wanted_requests for select to authenticated
using (
  commissioner_user_id = auth.uid()
  or (
    status in ('open', 'reviewing', 'expired', 'fulfilled', 'closed')
    and private.current_user_is_email_verified()
  )
);

create function private.actor_verified_institution()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.institution_id
  from public.institution_memberships as membership
  where membership.user_id = auth.uid()
    and membership.verification_state = 'verified'
    and private.current_user_can_transact_at(membership.institution_id)
  order by membership.verified_at desc nulls last
  limit 1;
$$;

revoke all on function private.actor_verified_institution() from public;

-- Publishes an academic draft with no bounty: no payment, no fee, open at once.
-- The duplicate check is still required and consumed exactly once.
create function public.publish_free_wanted(
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

revoke all on function public.publish_free_wanted(uuid, text, text, text) from public;
grant execute on function public.publish_free_wanted(uuid, text, text, text) to authenticated;

-- Creates and opens a missing-item or discussion Wanted in one step. Always
-- free; the campus must be in an open region.
create function public.publish_community_wanted(
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

revoke all on function public.publish_community_wanted(public.wanted_kind, uuid, text, text, smallint, text, text) from public;
grant execute on function public.publish_community_wanted(public.wanted_kind, uuid, text, text, smallint, text, text) to authenticated;

-- The poster of a community Wanted marks it resolved (found, answered).
create function public.resolve_own_community_wanted(target_public_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wanted_requests
  set status = 'closed'
  where public_id = target_public_id
    and commissioner_user_id = auth.uid()
    and kind in ('missing_item', 'discussion')
    and status = 'open';
  if not found then
    raise exception using errcode = '42501', message = 'wanted_not_resolvable';
  end if;
  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  select id, 'wanted_resolved', 'Marked resolved by the poster'
  from public.wanted_requests where public_id = target_public_id;
end;
$$;

revoke all on function public.resolve_own_community_wanted(uuid) from public;
grant execute on function public.resolve_own_community_wanted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Community replies (missing items and discussions): text only
-- ---------------------------------------------------------------------------

create table public.wanted_replies (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete cascade,
  author_user_id uuid not null references public.profiles (user_id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000 and body = trim(body)),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create index wanted_replies_by_wanted on public.wanted_replies (wanted_request_id, created_at);
alter table public.wanted_replies enable row level security;

create policy wanted_replies_read on public.wanted_replies for select to authenticated
using (
  hidden_at is null
  and private.current_user_is_email_verified()
  and exists (
    select 1 from public.wanted_requests w
    where w.id = wanted_replies.wanted_request_id
      and w.kind in ('missing_item', 'discussion')
      and w.status in ('open', 'closed')
  )
);

create function public.post_wanted_reply(target_public_id uuid, reply_body text)
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
  where public_id = target_public_id and kind in ('missing_item', 'discussion') and status = 'open';
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  if not private.current_user_can_transact_at(target.institution_id) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  insert into public.wanted_replies (wanted_request_id, author_user_id, body)
  values (target.id, auth.uid(), trim(reply_body))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.post_wanted_reply(uuid, text) from public;
grant execute on function public.post_wanted_reply(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fulfilment for free requests
-- ---------------------------------------------------------------------------
-- Identical to 202609250001 except: a free request entitles its commissioner
-- (there are no contributors), and a request with no bounty creates no payout
-- task. Every other step, including the one-winner rule, is unchanged.

create or replace function public.approve_winning_claim_and_fulfill(
  target_claim_id uuid,
  target_reason_code text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_claim public.claims%rowtype;
  v_wanted public.wanted_requests%rowtype;
  v_payout_id uuid;
  v_gross_sen bigint;
  v_fee_bps integer;
  v_fee_sen bigint;
  v_net_sen bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_claim
  from public.claims
  where id = target_claim_id and status in ('screening', 'needs_information', 'under_review');

  if not found then
    raise exception 'claim is not in reviewable state' using errcode = 'P0001';
  end if;

  if v_claim.is_restricted then
    raise exception 'restricted claim cannot be approved' using errcode = '42501';
  end if;

  if v_claim.hunter_user_id = actor_id then
    raise exception 'claim owner cannot review own claim' using errcode = '42501';
  end if;

  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(v_claim.institution_id)
  ) then
    raise exception 'reviewer not authorized' using errcode = '42501';
  end if;

  select * into v_wanted
  from public.wanted_requests
  where id = v_claim.wanted_request_id;

  if not found then
    raise exception 'wanted request not found' using errcode = 'P0002';
  end if;

  update public.claims
  set status = 'not_selected',
      updated_at = now()
  where wanted_request_id = v_claim.wanted_request_id
    and id <> target_claim_id
    and status in ('screening', 'needs_information', 'under_review');

  update public.claims
  set status = 'approved',
      bucket = 'approved',
      updated_at = now()
  where id = target_claim_id;

  insert into public.claim_reviews (claim_id, reviewer_user_id, decision, reason_code, notes)
  values (target_claim_id, actor_id, 'approve', target_reason_code, target_notes);

  update public.wanted_requests
  set status = 'fulfilled',
      updated_at = now()
  where id = v_claim.wanted_request_id;

  insert into public.entitlements (wanted_request_id, claim_id, user_id)
  select distinct c.wanted_request_id, target_claim_id, c.contributor_user_id
  from public.contributions c
  where c.wanted_request_id = v_claim.wanted_request_id
  on conflict (wanted_request_id, user_id) do nothing;

  if v_wanted.is_free then
    insert into public.entitlements (wanted_request_id, claim_id, user_id)
    values (v_claim.wanted_request_id, target_claim_id, v_wanted.commissioner_user_id)
    on conflict (wanted_request_id, user_id) do nothing;
  end if;

  select coalesce(sum(amount_sen), 0) into v_gross_sen
  from public.contributions
  where wanted_request_id = v_claim.wanted_request_id;

  if v_gross_sen = 0 then
    return null;
  end if;

  v_fee_bps := coalesce(v_wanted.fee_rate_basis_points_snapshot, 1000);
  v_fee_sen := (v_gross_sen * v_fee_bps) / 10000;
  v_net_sen := v_gross_sen - v_fee_sen;

  insert into public.payout_tasks (
    wanted_request_id,
    claim_id,
    hunter_user_id,
    gross_bounty_sen,
    fee_rate_basis_points,
    platform_fee_sen,
    net_payout_sen,
    status
  )
  values (
    v_claim.wanted_request_id,
    target_claim_id,
    v_claim.hunter_user_id,
    v_gross_sen,
    v_fee_bps,
    v_fee_sen,
    v_net_sen,
    'pending'
  )
  on conflict (wanted_request_id) do update
  set updated_at = now()
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;
