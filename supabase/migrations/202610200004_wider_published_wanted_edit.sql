-- Migration: 202610200004_wider_published_wanted_edit.sql
-- A published Wanted's details may be corrected in its first hour (user, 2 October 2026).
--
-- Rules (docs/superpowers/plans/2026-10-02-qa-round-3.md, Task 11):
--   * The same locks as the title-only edit of 202610130002: the first hour after publishing,
--     the first claim, the first reply from someone other than the poster. They are decided by
--     private.wanted_poster_change_refusal under the row lock.
--   * Editable by kind:
--       academic      title, description, campus, faculty, programme, course, session,
--                     resource type, language, tags
--       missing_item  title, description, campus, last-seen location, tags
--       discussion    title, description, campus, tags
--   * Never editable: the university, the bounty, the duration, the fee and policy snapshots,
--     the kind and free/paid. None of those columns is written here.
--   * A value the poster changes must be one a new Wanted could choose: active, in the
--     Wanted's own university, and for a campus, in an open region. A value left as published
--     is kept even if it has since been switched off, so a poster can still fix a typo.
--   * Every edit keeps the previous values in wanted_request_revisions and adds one
--     "Edited by the poster" public event. A save that changes nothing records nothing.

-- ---------------------------------------------------------------------------
-- 1. Revisions keep the previous details as well as the previous text
-- ---------------------------------------------------------------------------

alter table public.wanted_request_revisions
  add column if not exists previous_details jsonb;

-- ---------------------------------------------------------------------------
-- 2. Edit the details
-- ---------------------------------------------------------------------------

create function public.update_own_published_wanted_details(
  target_public_id uuid,
  new_title text,
  new_description text,
  new_campus_id uuid,
  new_faculty_id uuid,
  new_programme_id uuid,
  new_course_id uuid,
  new_academic_session_id uuid,
  new_resource_type_id uuid,
  new_language_id uuid,
  new_last_seen_location text,
  new_tag_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.current_user_id();
  target public.wanted_requests%rowtype;
  refusal text;
  academic boolean;
  wanted_title text := trim(coalesce(new_title, ''));
  wanted_description text := trim(coalesce(new_description, ''));
  wanted_location text;
  wanted_tags uuid[];
  old_tags uuid[];
begin
  if caller is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  -- The row lock orders this against claim creation, replies and withdrawal; the refusal
  -- below is evaluated after it is held.
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = caller
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  refusal := private.wanted_poster_change_refusal(target);
  if refusal is not null then
    raise exception using errcode = '42501', message = 'wanted_change_locked:' || refusal;
  end if;

  academic := target.kind = 'academic';
  wanted_location := case
    when target.kind = 'missing_item' then nullif(trim(coalesce(new_last_seen_location, '')), '')
    else target.last_seen_location
  end;
  select coalesce(array_agg(distinct tag_id order by tag_id), '{}') into wanted_tags
  from unnest(coalesce(new_tag_ids, '{}')) as tag_id;
  select coalesce(array_agg(tag_id order by tag_id), '{}') into old_tags
  from public.wanted_request_tags where wanted_request_id = target.id;

  -- Text and tags.
  if char_length(wanted_title) not between 8 and 120
    or char_length(wanted_description) not between 10 and 2000
    or array_position(coalesce(new_tag_ids, '{}'), null) is not null
    or cardinality(wanted_tags) <> cardinality(coalesce(new_tag_ids, '{}'))
    or cardinality(wanted_tags) > 5
    or (wanted_location is not null and char_length(wanted_location) not between 2 and 160)
    or new_campus_id is null
  then
    raise exception using errcode = '22023', message = 'wanted_change_invalid';
  end if;

  -- A newly added tag must be active; a tag already on the Wanted may stay.
  if exists (
    select 1 from unnest(wanted_tags) as tag_id
    where tag_id <> all (old_tags)
      and not exists (select 1 from public.tags t where t.id = tag_id and t.active)
  ) then
    raise exception using errcode = '22023', message = 'wanted_change_invalid';
  end if;

  -- A new campus must be open for requests in the Wanted's own university.
  if new_campus_id is distinct from target.campus_id and not exists (
    select 1 from public.campuses
    where id = new_campus_id and institution_id = target.institution_id and active and region_open
  ) then
    raise exception using errcode = '22023', message = 'wanted_change_invalid';
  end if;

  -- An academic Wanted keeps every academic field; each new value must be active in its
  -- university and the programme must sit under the faculty. The composite foreign keys
  -- refuse a faculty, programme, course or session from another university as well.
  if academic and (
    new_faculty_id is null or new_programme_id is null or new_course_id is null
    or new_resource_type_id is null or new_language_id is null
    or (new_faculty_id is distinct from target.faculty_id and not exists (
      select 1 from public.faculties
      where id = new_faculty_id and institution_id = target.institution_id and active
    ))
    or ((new_programme_id is distinct from target.programme_id
         or new_faculty_id is distinct from target.faculty_id) and not exists (
      select 1 from public.programmes
      where id = new_programme_id and institution_id = target.institution_id
        and faculty_id = new_faculty_id
        and (active or new_programme_id = target.programme_id)
    ))
    or (new_course_id is distinct from target.course_id and not exists (
      select 1 from public.courses
      where id = new_course_id and institution_id = target.institution_id and active
    ))
    or (new_academic_session_id is not null
        and new_academic_session_id is distinct from target.academic_session_id
        and not exists (
      select 1 from public.academic_sessions
      where id = new_academic_session_id and institution_id = target.institution_id and active
    ))
    or (new_resource_type_id is distinct from target.resource_type_id and not exists (
      select 1 from public.resource_types where id = new_resource_type_id and active
    ))
    or (new_language_id is distinct from target.language_id and not exists (
      select 1 from public.languages where id = new_language_id and active
    ))
  ) then
    raise exception using errcode = '22023', message = 'wanted_change_invalid';
  end if;

  -- Nothing changed: nothing to record.
  if wanted_title = target.title
    and wanted_description = target.description
    and new_campus_id = target.campus_id
    and wanted_location is not distinct from target.last_seen_location
    and wanted_tags = old_tags
    and (
      not academic or (
        new_faculty_id = target.faculty_id
        and new_programme_id = target.programme_id
        and new_course_id = target.course_id
        and new_academic_session_id is not distinct from target.academic_session_id
        and new_resource_type_id = target.resource_type_id
        and new_language_id = target.language_id
      )
    )
  then
    return;
  end if;

  insert into public.wanted_request_revisions (
    wanted_request_id, previous_title, previous_description, revised_by, previous_details
  )
  values (
    target.id, target.title, target.description, caller,
    jsonb_build_object(
      'campus_id', target.campus_id,
      'faculty_id', target.faculty_id,
      'programme_id', target.programme_id,
      'course_id', target.course_id,
      'academic_session_id', target.academic_session_id,
      'resource_type_id', target.resource_type_id,
      'language_id', target.language_id,
      'last_seen_location', target.last_seen_location,
      'tag_ids', to_jsonb(old_tags)
    )
  );

  update public.wanted_requests
  set title = wanted_title,
      description = wanted_description,
      campus_id = new_campus_id,
      faculty_id = case when academic then new_faculty_id else faculty_id end,
      programme_id = case when academic then new_programme_id else programme_id end,
      course_id = case when academic then new_course_id else course_id end,
      academic_session_id = case when academic then new_academic_session_id else academic_session_id end,
      resource_type_id = case when academic then new_resource_type_id else resource_type_id end,
      language_id = case when academic then new_language_id else language_id end,
      last_seen_location = wanted_location,
      updated_at = now()
  where id = target.id;

  if wanted_tags <> old_tags then
    delete from public.wanted_request_tags
    where wanted_request_id = target.id and tag_id <> all (wanted_tags);
    insert into public.wanted_request_tags (wanted_request_id, tag_id)
    select target.id, tag_id from unnest(wanted_tags) as tag_id
    on conflict do nothing;
  end if;

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'wanted_edited', 'Edited by the poster');
end;
$$;

revoke all on function public.update_own_published_wanted_details(
  uuid, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[]
) from public, anon;
grant execute on function public.update_own_published_wanted_details(
  uuid, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The title-only edit is superseded. It stays callable for a deploy in flight and keeps
--    every other detail as it is, at the new 10-character description floor.
-- ---------------------------------------------------------------------------

create or replace function public.update_own_published_wanted(
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
  current_tags uuid[];
begin
  if private.current_user_id() is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  select * into target from public.wanted_requests
  where public_id = target_public_id and commissioner_user_id = private.current_user_id();
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  select coalesce(array_agg(tag_id), '{}') into current_tags
  from public.wanted_request_tags where wanted_request_id = target.id;
  perform public.update_own_published_wanted_details(
    target_public_id, new_title, new_description, target.campus_id, target.faculty_id,
    target.programme_id, target.course_id, target.academic_session_id, target.resource_type_id,
    target.language_id, target.last_seen_location, current_tags
  );
end;
$$;

revoke all on function public.update_own_published_wanted(uuid, text, text) from public, anon;
grant execute on function public.update_own_published_wanted(uuid, text, text) to authenticated;
