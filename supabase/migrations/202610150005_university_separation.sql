-- Migration: 202610150005_university_separation.sql
-- Description: browse one university at a time; UMPSA email domain; a short
-- name for each university; the Hunters wall of one university.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-29):
-- * Each university is browsed on its own. A member verified at a university
--   sees that university's Board, map, Hunters and homepage; anyone else picks
--   one. This is a filter, not access control: RLS is unchanged, and a shared
--   link to another university's Wanted still opens, read-only.
-- * Posting, backing, claiming, replying and downloading were already limited
--   to the member's own university (current_user_can_transact_at).
-- * UMPSA student addresses end in @adab.umpsa.edu.my (Owner, 2026-09-29) and
--   verify by domain, the same way as UiTM's.
-- * short_name ("UiTM", "UMPSA") is what the switch and labels show. It may be
--   absent on an institution added later; the application falls back to name.
-- * list_public_hunters_at is list_public_hunters for one institution. The
--   two-argument function stays for the deployed site until it moves over.

alter table public.institutions
  add column short_name text
  check (short_name is null or char_length(short_name) between 1 and 20);

update public.institutions set short_name = 'UiTM' where slug = 'uitm' and short_name is null;
update public.institutions set short_name = 'UMPSA' where slug = 'umpsa' and short_name is null;

insert into public.institution_email_domains (domain, institution_id)
select 'adab.umpsa.edu.my', id
from public.institutions
where slug = 'umpsa'
on conflict (domain) do nothing;

create function public.list_public_hunters_at(
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

revoke all on function public.list_public_hunters_at(uuid, integer, integer) from public, anon;
grant execute on function public.list_public_hunters_at(uuid, integer, integer) to authenticated;
