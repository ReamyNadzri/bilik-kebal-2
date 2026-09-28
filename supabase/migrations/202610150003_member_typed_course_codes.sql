-- Migration: 202610150003_member_typed_course_codes.sql
-- Description: members type the course code of an academic Wanted themselves.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-28):
-- * The Owner decided members type the course (subject) code instead of
--   choosing it from a list, and that it must be in capital letters.
-- * A code is 3 to 12 capital letters and digits, starting with a letter
--   (CSC510, ELC231, CTU551). Lower case is refused here, not converted; the
--   form converts as the member types.
-- * A course code names one subject across the institution. Typing a code
--   that already exists reuses that course, whichever programme it was first
--   filed under, so every CSC510 request stays one course for duplicate checks
--   and the Board filter. A new code is filed under the programme it was first
--   posted from and named by its code until a Sheriff names it.
-- * A course a Sheriff has deactivated is not revived by typing its code.
-- * Only a member who may transact at the programme's institution can add a
--   course, the same bar as creating a draft.
-- * A course therefore no longer has to belong to the chosen programme. The
--   rest of the hierarchy check is unchanged.

create function public.ensure_course(target_programme_id uuid, target_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  programme_institution_id uuid;
  course_id uuid;
  course_active boolean;
begin
  if target_code is null or target_code !~ '^[A-Z][A-Z0-9]{2,11}$' then
    raise exception using errcode = '22023', message = 'course_code_invalid';
  end if;

  select institution_id into programme_institution_id
  from public.programmes
  where id = target_programme_id and active;

  if programme_institution_id is null then
    raise exception using errcode = '22023', message = 'wanted_taxonomy_invalid';
  end if;
  if auth.uid() is null or not private.current_user_can_transact_at(programme_institution_id) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;

  -- A concurrent insert of the same code waits here and then does nothing;
  -- the read below sees whichever row won.
  insert into public.courses (institution_id, programme_id, slug, code, name)
  values (
    programme_institution_id,
    target_programme_id,
    private.slugify(target_code, left(replace(gen_random_uuid()::text, '-', ''), 6)),
    target_code,
    target_code
  )
  on conflict (institution_id, code) do nothing;

  select id, active into course_id, course_active
  from public.courses
  where institution_id = programme_institution_id and code = target_code;

  if not course_active then
    raise exception using errcode = '22023', message = 'course_inactive';
  end if;
  return course_id;
end;
$$;

revoke all on function public.ensure_course(uuid, text) from public;
grant execute on function public.ensure_course(uuid, text) to authenticated;

-- Same signature as 202609300001, so create and update draft pick it up. Only
-- the course clause changes: the course must be active and at the institution,
-- no longer under the chosen programme.
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
      where id = target_course_id and institution_id = target_institution_id and active
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
