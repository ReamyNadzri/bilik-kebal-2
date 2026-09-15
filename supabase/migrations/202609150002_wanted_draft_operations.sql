create function private.wanted_taxonomy_is_valid(
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

revoke all on function private.wanted_taxonomy_is_valid(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[]) from public;

create function public.create_wanted_draft(
  campus_id uuid,
  faculty_id uuid,
  programme_id uuid,
  course_id uuid,
  academic_session_id uuid,
  resource_type_id uuid,
  language_id uuid,
  tag_ids uuid[],
  title text,
  description text,
  duration_days smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_institution_id uuid;
  draft_id uuid := gen_random_uuid();
begin
  if actor_id is null or not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;

  select membership.institution_id into actor_institution_id
  from public.institution_memberships as membership
  where membership.user_id = actor_id
    and membership.verification_state = 'verified'
    and private.current_user_can_transact_at(membership.institution_id)
  order by membership.verified_at desc nulls last
  limit 1;

  if actor_institution_id is null then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if not private.wanted_taxonomy_is_valid(
    actor_institution_id, campus_id, faculty_id, programme_id, course_id,
    academic_session_id, resource_type_id, language_id, tag_ids
  ) then
    raise exception using errcode = '22023', message = 'wanted_taxonomy_invalid';
  end if;

  insert into public.wanted_requests (
    id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id,
    course_id, academic_session_id, resource_type_id, language_id, title,
    description, requested_duration_days, policy_accepted_at
  ) values (
    draft_id, actor_id, actor_institution_id, campus_id, faculty_id, programme_id,
    course_id, academic_session_id, resource_type_id, language_id, trim(title),
    trim(description), duration_days, now()
  );

  insert into public.wanted_request_tags (wanted_request_id, tag_id)
  select draft_id, tag_id from unnest(tag_ids) as tag_id;
  return draft_id;
end;
$$;

create function public.update_wanted_draft(
  draft_id uuid,
  campus_id uuid,
  faculty_id uuid,
  programme_id uuid,
  course_id uuid,
  academic_session_id uuid,
  resource_type_id uuid,
  language_id uuid,
  tag_ids uuid[],
  title text,
  description text,
  duration_days smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_institution_id uuid;
begin
  select institution_id into actor_institution_id
  from public.wanted_requests
  where id = draft_id and commissioner_user_id = actor_id and status = 'draft'
  for update;

  if actor_institution_id is null then
    raise exception using errcode = 'P0002', message = 'wanted_editable_draft_not_found';
  end if;
  if not private.current_user_can_transact_at(actor_institution_id) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if not private.wanted_taxonomy_is_valid(
    actor_institution_id, campus_id, faculty_id, programme_id, course_id,
    academic_session_id, resource_type_id, language_id, tag_ids
  ) then
    raise exception using errcode = '22023', message = 'wanted_taxonomy_invalid';
  end if;

  update public.wanted_requests set
    campus_id = update_wanted_draft.campus_id,
    faculty_id = update_wanted_draft.faculty_id,
    programme_id = update_wanted_draft.programme_id,
    course_id = update_wanted_draft.course_id,
    academic_session_id = update_wanted_draft.academic_session_id,
    resource_type_id = update_wanted_draft.resource_type_id,
    language_id = update_wanted_draft.language_id,
    title = trim(update_wanted_draft.title),
    description = trim(update_wanted_draft.description),
    requested_duration_days = duration_days,
    policy_accepted_at = now()
  where id = draft_id;

  delete from public.wanted_request_tags where wanted_request_id = draft_id;
  insert into public.wanted_request_tags (wanted_request_id, tag_id)
  select draft_id, tag_id from unnest(tag_ids) as tag_id;
  return draft_id;
end;
$$;

revoke all on function public.create_wanted_draft(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, text, smallint) from public;
revoke all on function public.update_wanted_draft(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, text, smallint) from public;
grant execute on function public.create_wanted_draft(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, text, smallint) to authenticated;
grant execute on function public.update_wanted_draft(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, text, smallint) to authenticated;
