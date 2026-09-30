-- Migration: 202610170002_fewer_round_trips.sql
-- Description: one database call for the signed-in account, one for the Explore Map totals.
--
-- Every signed-in page read the member's identity, then six account tables, then the
-- institution name: three round trips in a row before the page's own data. The map read every
-- open Wanted on the platform, then their contributions, and added them up in the app.
-- Decisions (context/progress-tracker.md, 2026-09-30):
-- * current_account() returns what current_identity() and the account read returned together,
--   for the caller only (private.current_user_id), so it exposes nothing the caller could not
--   already read about themselves.
-- * A member with more than one institution membership row is read as their verified one, else
--   the most recently updated; the old read refused such an account outright.
-- * campus_region_totals() keeps the old sums exactly: open and reviewing Wanteds per active
--   campus, and every contribution row on them. Service role only, like the admin read it
--   replaces; the app still hides counts from viewers without a verified email.

create function public.current_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'public_id', p.public_id,
    'email', i.email,
    'email_verified_at', i.email_verified_at,
    'created_at', p.created_at,
    'display_name', p.display_name,
    'avatar_object_key', p.avatar_object_key,
    'avatar_preset', p.avatar_preset,
    'external_avatar_url', p.external_avatar_url,
    'membership', (
      select jsonb_build_object(
        'institution_id', m.institution_id,
        'verification_state', m.verification_state,
        'institution_name', inst.name
      )
      from public.institution_memberships m
      left join public.institutions inst on inst.id = m.institution_id
      where m.user_id = p.user_id
      order by (m.verification_state = 'verified') desc, m.updated_at desc
      limit 1
    ),
    'restriction', (
      select jsonb_build_object('id', r.id, 'expires_at', r.expires_at)
      from public.account_restrictions r
      where r.user_id = p.user_id
        and r.lifted_at is null
      limit 1
    ),
    'latest_request', (
      select jsonb_build_object(
        'id', q.id,
        'state', q.state,
        'created_at', q.created_at,
        'reviewed_at', q.reviewed_at,
        'decision_reason_code', q.decision_reason_code,
        'evidence_delete_after', q.evidence_delete_after
      )
      from public.institution_verification_requests q
      where q.user_id = p.user_id
      order by q.created_at desc
      limit 1
    ),
    'has_console_access', (
      exists (select 1 from public.platform_role_assignments a where a.user_id = p.user_id)
      or exists (
        select 1
        from public.institution_role_assignments a
        where a.user_id = p.user_id
          and a.role = 'institution_sheriff'
      )
    )
  )
  from public.profiles p
  left join private.user_identities i on i.user_id = p.user_id
  where p.user_id = private.current_user_id();
$$;

revoke all on function public.current_account() from public, anon;
grant execute on function public.current_account() to authenticated;

create function public.campus_region_totals(target_institution_id uuid)
returns table (
  id uuid,
  name text,
  region_open boolean,
  latitude numeric,
  longitude numeric,
  map_x numeric,
  map_y numeric,
  open_wanted_count integer,
  open_bounty_sen bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with open_wanted as (
    select w.id, w.campus_id
    from public.wanted_requests w
    where w.status in ('open', 'reviewing')
  ),
  per_campus as (
    select
      o.campus_id,
      count(*)::integer as wanted_count,
      coalesce(sum((select sum(c.amount_sen) from public.contributions c where c.wanted_request_id = o.id)), 0)::bigint
        as bounty_sen
    from open_wanted o
    group by o.campus_id
  )
  select
    c.id,
    c.name,
    c.region_open,
    c.latitude::numeric,
    c.longitude::numeric,
    c.map_x::numeric,
    c.map_y::numeric,
    case when c.region_open then coalesce(t.wanted_count, 0) else 0 end,
    case when c.region_open then coalesce(t.bounty_sen, 0) else 0 end
  from public.campuses c
  left join per_campus t on t.campus_id = c.id
  where c.active
    and (target_institution_id is null or c.institution_id = target_institution_id)
  order by c.sort_order, c.name;
$$;

revoke all on function public.campus_region_totals(uuid) from public, anon, authenticated;
grant execute on function public.campus_region_totals(uuid) to service_role;
