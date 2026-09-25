-- Migration: 202610120001_wanted_pictures_and_entry_fixes.sql
-- Description:
-- 1. Wanted pictures. The poster of a Wanted may pick one of fifty drawn
--    pictures, or upload their own. The browser crops, shrinks and pixelates an
--    upload to a small PNG before it leaves the device, which also drops any
--    camera metadata. A picture is shown at once; a Sheriff who moderates the
--    Wanted, or the Owner, can remove it (audited, with a reason code).
--    Pictures live in their own table so setting one never touches the Wanted
--    row, its updated_at, or a duplicate-check token issued for a draft.
-- 2. Approving a campus entry request whose name matches a campus that is
--    already listed (for example one added locked as "coming soon") reuses
--    that campus instead of adding a duplicate.

-- ---------------------------------------------------------------------------
-- 1. Wanted pictures
-- ---------------------------------------------------------------------------

create table public.wanted_pictures (
  wanted_request_id uuid primary key references public.wanted_requests (id) on delete cascade,
  -- One of the fifty drawn pictures, or null when an upload is used.
  preset smallint check (preset between 0 and 49),
  -- "<poster public id>/<uuid>.png" in the public wanted-pictures bucket.
  object_key text check (
    object_key is null
    or object_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'
  ),
  set_by uuid not null references public.profiles (user_id) on delete restrict,
  updated_at timestamptz not null default now(),
  check ((preset is null) <> (object_key is null))
);

alter table public.wanted_pictures enable row level security;
revoke all on public.wanted_pictures from public, anon, authenticated;
grant select on public.wanted_pictures to anon, authenticated;
grant all on public.wanted_pictures to service_role;
-- The picture of a Wanted is as public as the poster it decorates; a draft's
-- picture reveals only a drawing number or a public image key.
create policy wanted_pictures_read on public.wanted_pictures for select to anon, authenticated
  using (true);

-- Uploaded pictures: public, PNG only, 64 KB. The pixelated square is tiny.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wanted-pictures', 'wanted-pictures', true, 65536, array['image/png'])
on conflict (id) do update
set public = true, file_size_limit = 65536, allowed_mime_types = array['image/png'];

create policy wanted_pictures_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'wanted-pictures'
  and private.current_user_is_email_verified()
  and (storage.foldername(name))[1] = private.current_user_public_id()::text
);

create policy wanted_pictures_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'wanted-pictures'
  and (storage.foldername(name))[1] = private.current_user_public_id()::text
);

-- Accepts the Wanted's internal id (a draft) or its public id (a posted one).
create function private.wanted_by_ref(target_ref uuid)
returns public.wanted_requests
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.wanted_requests where id = target_ref or public_id = target_ref limit 1;
$$;
revoke all on function private.wanted_by_ref(uuid) from public, anon, authenticated;

-- The poster sets or clears their Wanted's picture. Exactly one of preset and
-- object key, or neither to go back to the automatic drawing.
create function public.set_own_wanted_picture(
  target_wanted_ref uuid,
  new_preset smallint default null,
  new_object_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.wanted_requests;
  owner_public_id uuid := private.current_user_public_id();
begin
  if auth.uid() is null or owner_public_id is null then
    raise exception using errcode = '28000', message = 'wanted_picture_auth_required';
  end if;
  wanted := private.wanted_by_ref(target_wanted_ref);
  if wanted.id is null or wanted.commissioner_user_id <> auth.uid() then
    raise exception using errcode = 'P0002', message = 'wanted_picture_not_found';
  end if;
  if not private.current_user_can_transact_at(wanted.institution_id) then
    raise exception using errcode = '42501', message = 'wanted_picture_not_allowed';
  end if;
  if new_preset is not null and new_object_key is not null then
    raise exception using errcode = '22023', message = 'wanted_picture_invalid';
  end if;
  if new_preset is not null and (new_preset < 0 or new_preset > 49) then
    raise exception using errcode = '22023', message = 'wanted_picture_invalid';
  end if;
  if new_object_key is not null then
    if split_part(new_object_key, '/', 1) <> owner_public_id::text then
      raise exception using errcode = '42501', message = 'wanted_picture_not_owned';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'wanted-pictures' and name = new_object_key
    ) then
      raise exception using errcode = 'P0002', message = 'wanted_picture_not_uploaded';
    end if;
  end if;

  if new_preset is null and new_object_key is null then
    delete from public.wanted_pictures where wanted_request_id = wanted.id;
  else
    insert into public.wanted_pictures (wanted_request_id, preset, object_key, set_by, updated_at)
    values (wanted.id, new_preset, new_object_key, auth.uid(), now())
    on conflict (wanted_request_id) do update
    set preset = excluded.preset,
        object_key = excluded.object_key,
        set_by = excluded.set_by,
        updated_at = excluded.updated_at;
  end if;
end;
$$;
revoke all on function public.set_own_wanted_picture(uuid, smallint, text) from public, anon;
grant execute on function public.set_own_wanted_picture(uuid, smallint, text) to authenticated;

-- A Sheriff who moderates the Wanted, or the Owner, removes its picture. The
-- poster's upload stays in storage as evidence; the Wanted falls back to its
-- automatic drawing.
create function public.remove_wanted_picture(target_wanted_ref uuid, reason_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.wanted_requests;
  removed public.wanted_pictures;
begin
  perform private.check_reason_code(reason_code);
  wanted := private.wanted_by_ref(target_wanted_ref);
  if wanted.id is null or not private.current_user_moderates_wanted(wanted.id) then
    raise exception using errcode = '42501', message = 'wanted_picture_moderator_required';
  end if;
  delete from public.wanted_pictures where wanted_request_id = wanted.id returning * into removed;
  if removed.wanted_request_id is not null then
    insert into public.identity_audit_events (
      event_type, actor_user_id, subject_user_id, institution_id, details
    )
    values (
      'wanted.picture_removed_by_staff', auth.uid(), wanted.commissioner_user_id,
      wanted.institution_id,
      jsonb_build_object(
        'reason_code', reason_code,
        'wanted_request_id', wanted.id,
        'preset', removed.preset,
        'object_key', removed.object_key
      )
    );
  end if;
end;
$$;
revoke all on function public.remove_wanted_picture(uuid, text) from public, anon;
grant execute on function public.remove_wanted_picture(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Campus entry requests reuse a campus that is already listed
-- ---------------------------------------------------------------------------

create or replace function public.decide_taxonomy_request(
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
        -- "Machang" matches the listed "UiTM Machang": open that one rather
        -- than adding a second pin for the same campus.
        select id into item_id from public.campuses
        where institution_id = req.institution_id
          and position(lower(trim(req.label)) in lower(name)) > 0
        order by char_length(name)
        limit 1;
        if item_id is not null then
          update public.campuses
          set active = true, region_open = region_open or open_region
          where id = item_id;
        else
          insert into public.campuses (institution_id, slug, name, region_open)
          values (req.institution_id, private.slugify(req.label, suffix), req.label, open_region)
          returning id into item_id;
        end if;
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
