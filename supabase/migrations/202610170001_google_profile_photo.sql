-- Migration: 202610170001_google_profile_photo.sql
-- Description: a member who signs in with Google starts with their Google photo.
--
-- Decisions (context/progress-tracker.md, 2026-09-30):
-- * The picture shown is, in order: an uploaded photo, a chosen drawn avatar, the Google photo,
--   then the default drawing. Choosing a photo or drawn avatar therefore replaces the Google
--   photo; "Use my Google photo" clears both choices to bring it back.
-- * Only the link is kept (Clerk's copy of the Google photo, from the verified Clerk webhook or
--   the member's own session sync), never the image. A member signing in with email only has
--   no link and keeps the drawn avatars.
-- * The raw link lives in private.user_identities with the rest of the Clerk facts. The shown
--   link is copied to public.profiles only while the member uses it, so a photo a Sheriff reset
--   is not left readable on the public profile row.
-- * A Sheriff avatar reset also turns the Google photo off; later Clerk syncs do not bring it
--   back. The member can choose it again themselves.

alter table private.user_identities
  add column clerk_avatar_url text,
  add constraint user_identities_clerk_avatar_url_check check (
    clerk_avatar_url is null
    or (
      length(clerk_avatar_url) <= 2048
      and clerk_avatar_url ~ '^https://(img\.clerk\.com|lh3\.googleusercontent\.com)/'
    )
  );

alter table public.profiles
  add column external_avatar_url text,
  add column external_avatar_enabled boolean not null default true,
  add constraint profiles_external_avatar_url_check check (
    external_avatar_url is null
    or (
      length(external_avatar_url) <= 2048
      and external_avatar_url ~ '^https://(img\.clerk\.com|lh3\.googleusercontent\.com)/'
    )
  );

-- Service role only: called after sync_clerk_user with the same Clerk updated_at, so a stale
-- delivery (older than the identity's last sync) changes nothing.
create function public.sync_clerk_avatar(
  target_clerk_user_id text,
  target_avatar_url text,
  target_clerk_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  identity private.user_identities;
  cleaned_url text := nullif(trim(target_avatar_url), '');
begin
  select * into identity
  from private.user_identities
  where clerk_user_id = target_clerk_user_id
  for update;

  if not found then
    return;
  end if;
  if identity.clerk_updated_at is not null
    and target_clerk_updated_at < identity.clerk_updated_at
  then
    return;
  end if;
  if cleaned_url is not null
    and (
      length(cleaned_url) > 2048
      or cleaned_url !~ '^https://(img\.clerk\.com|lh3\.googleusercontent\.com)/'
    )
  then
    cleaned_url := null; -- not a Clerk or Google image link: keep none rather than fail the sync
  end if;

  update private.user_identities
  set clerk_avatar_url = cleaned_url
  where user_id = identity.user_id;

  update public.profiles
  set external_avatar_url = case when external_avatar_enabled then cleaned_url end
  where user_id = identity.user_id
    and external_avatar_url is distinct from case when external_avatar_enabled then cleaned_url end;
end;
$$;

revoke all on function public.sync_clerk_avatar(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_clerk_avatar(text, text, timestamptz) to service_role;

-- The member's own "Use my Google photo": clears their photo and drawn avatar.
create function public.use_own_external_avatar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid := auth.uid();
  avatar_url text;
begin
  if member_id is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select clerk_avatar_url into avatar_url
  from private.user_identities
  where user_id = member_id;

  if avatar_url is null then
    raise exception using errcode = '22023', message = 'external_avatar_missing';
  end if;

  update public.profiles
  set avatar_object_key = null,
      avatar_preset = null,
      external_avatar_enabled = true,
      external_avatar_url = avatar_url,
      updated_at = now()
  where user_id = member_id;

  return avatar_url;
end;
$$;

revoke all on function public.use_own_external_avatar() from public, anon;
grant execute on function public.use_own_external_avatar() to authenticated;

-- A Sheriff reset now also turns the Google photo off (body otherwise as in 202610100004).
create or replace function public.console_reset_member_avatar(target_public_id uuid, reason_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  perform private.console_write_guard(array['owner', 'platform_sheriff']);
  perform private.check_reason_code(reason_code);
  member_id := private.member_by_public_id(target_public_id);
  if exists (select 1 from public.platform_role_assignments where user_id = member_id and role = 'owner')
    and member_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  update public.profiles
  set avatar_object_key = null,
      avatar_preset = null,
      external_avatar_enabled = false,
      external_avatar_url = null,
      updated_at = now()
  where user_id = member_id;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values ('profile.avatar_reset_by_staff', auth.uid(), member_id, jsonb_build_object('reason_code', reason_code));
end;
$$;


-- The Hunters wall carries the Google photo too (bodies otherwise as in 202610140001 and
-- 202610150005).
create or replace function public.list_public_hunters(page_size integer, page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hunter_total integer;
  hunter_items jsonb;
begin
  if not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;
  if page_size is null or page_size not in (10, 15, 20) then
    raise exception using errcode = '22023', message = 'page_size_invalid';
  end if;
  if page is null or page < 1 then
    raise exception using errcode = '22023', message = 'page_invalid';
  end if;

  with hunters as (
    select
      p.public_id,
      p.display_name,
      p.avatar_object_key,
      p.avatar_preset,
      p.external_avatar_url,
      p.created_at,
      membership.institution_name
    from public.profiles p
    cross join lateral (
      select i.name as institution_name
      from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id
      where m.user_id = p.user_id
        and m.verification_state = 'verified'
      order by m.verified_at desc
      limit 1
    ) membership
    where not exists (
      select 1
      from public.account_restrictions r
      where r.user_id = p.user_id
        and r.lifted_at is null
        and (r.expires_at is null or r.expires_at > now())
    )
  ),
  counted as (
    select count(*)::integer as total from hunters
  ),
  paged as (
    select *
    from hunters
    order by created_at desc, public_id
    limit page_size
    offset (page - 1) * page_size
  )
  select
    counted.total,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'publicId', paged.public_id,
            'displayName', paged.display_name,
            'avatarObjectKey', paged.avatar_object_key,
            'avatarPreset', paged.avatar_preset,
            'externalAvatarUrl', paged.external_avatar_url,
            'institutionName', paged.institution_name,
            'joinedAt', paged.created_at
          )
          order by paged.created_at desc, paged.public_id
        )
        from paged
      ),
      '[]'::jsonb
    )
  into hunter_total, hunter_items
  from counted;

  return jsonb_build_object('total', hunter_total, 'items', hunter_items);
end;
$$;

create or replace function public.list_public_hunters_at(
  target_institution_id uuid,
  page_size integer,
  page integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hunter_total integer;
  hunter_items jsonb;
begin
  if not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;
  if page_size is null or page_size not in (10, 15, 20) then
    raise exception using errcode = '22023', message = 'page_size_invalid';
  end if;
  if page is null or page < 1 then
    raise exception using errcode = '22023', message = 'page_invalid';
  end if;

  with hunters as (
    select
      p.public_id,
      p.display_name,
      p.avatar_object_key,
      p.avatar_preset,
      p.external_avatar_url,
      p.created_at,
      membership.institution_name
    from public.profiles p
    cross join lateral (
      select i.id as institution_id, i.name as institution_name
      from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id
      where m.user_id = p.user_id
        and m.verification_state = 'verified'
      order by m.verified_at desc
      limit 1
    ) membership
    where membership.institution_id = target_institution_id
      and not exists (
        select 1
        from public.account_restrictions r
        where r.user_id = p.user_id
          and r.lifted_at is null
          and (r.expires_at is null or r.expires_at > now())
      )
  ),
  counted as (
    select count(*)::integer as total from hunters
  ),
  paged as (
    select *
    from hunters
    order by created_at desc, public_id
    limit page_size
    offset (page - 1) * page_size
  )
  select
    counted.total,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'publicId', paged.public_id,
            'displayName', paged.display_name,
            'avatarObjectKey', paged.avatar_object_key,
            'avatarPreset', paged.avatar_preset,
            'externalAvatarUrl', paged.external_avatar_url,
            'institutionName', paged.institution_name,
            'joinedAt', paged.created_at
          )
          order by paged.created_at desc, paged.public_id
        )
        from paged
      ),
      '[]'::jsonb
    )
  into hunter_total, hunter_items
  from counted;

  return jsonb_build_object('total', hunter_total, 'items', hunter_items);
end;
$$;
