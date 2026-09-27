-- Migration: 202610140001_list_public_hunters.sql
-- Description: the Hunters wall on the Board, one page of verified members.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-28):
-- * The wall lists members with a verified institution membership and no
--   active account restriction. It is read at the Board's bar: a verified
--   email, and nothing more.
-- * Each entry carries only what a public profile already shows: public id,
--   display name, avatar (object key or drawn preset), the verified
--   institution's name and the joined date. Never an email address, user id,
--   verification evidence, claims or contributions.
-- * page_size is one of 10, 15 or 20; page counts from 1. Anything else is
--   refused rather than clamped, so a caller cannot ask for the whole list.
-- * Order is newest member first, public id breaking ties, so consecutive
--   pages never repeat or skip a member while nobody joins.

create function public.list_public_hunters(page_size integer, page integer)
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

revoke all on function public.list_public_hunters(integer, integer) from public, anon;
grant execute on function public.list_public_hunters(integer, integer) to authenticated;
