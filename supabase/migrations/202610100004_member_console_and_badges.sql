-- The member console (Owner and Sheriffs) and Owner-awarded badges.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-25):
-- * No raw database editor. The console calls these functions only; each
--   checks the caller's role, needs a sign-in in the last 15 minutes for a
--   write, and writes identity_audit_events. Money stays out of the console.
-- * Search: the Owner and platform Sheriffs search every member and see email
--   addresses; an institution Sheriff sees only members of their institution,
--   without email addresses.
-- * The Owner and platform Sheriffs may rename a member or reset their avatar
--   (offensive names or pictures). Nobody but the Owner may change the Owner.
-- * Only the Owner grants or revokes institution verification by hand and
--   appoints or removes Sheriffs. The Owner role itself is never assignable
--   here.
-- * Badges: the Owner designs badges (name, description, image) and pins at
--   most one to a member. A badge is shown beside the member's name and is
--   separate from the institution-verified star. Badge images live in the
--   public `badges` bucket, which only the Owner can write.

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------

create function private.current_user_console_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.current_user_has_platform_role('owner') then 'owner'
    when private.current_user_has_platform_role('platform_sheriff') then 'platform_sheriff'
    when exists (
      select 1 from public.institution_role_assignments
      where user_id = auth.uid() and role = 'institution_sheriff'
    ) then 'institution_sheriff'
  end;
$$;
revoke all on function private.current_user_console_role() from public, anon;
grant execute on function private.current_user_console_role() to authenticated;

create function private.console_write_guard(allowed text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(private.current_user_console_role(), '') <> all (allowed) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;
end;
$$;
revoke all on function private.console_write_guard(text[]) from public, anon, authenticated;

create function private.member_by_public_id(target_public_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select user_id into found_id from public.profiles where public_id = target_public_id;
  if found_id is null then
    raise exception using errcode = 'P0002', message = 'MEMBER_NOT_FOUND';
  end if;
  return found_id;
end;
$$;
revoke all on function private.member_by_public_id(uuid) from public, anon, authenticated;

create function private.check_reason_code(reason_code text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if reason_code is null or reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_REASON_CODE';
  end if;
end;
$$;
revoke all on function private.check_reason_code(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Badges
-- ---------------------------------------------------------------------------

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 40 and name = trim(name)),
  description text check (description is null or char_length(description) <= 160),
  image_object_key text check (
    image_object_key is null or image_object_key ~ '^[0-9a-f-]{36}\.(png|webp)$'
  ),
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table public.badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges (id) on delete restrict,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  awarded_by uuid not null references public.profiles (user_id) on delete restrict,
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (user_id) on delete restrict,
  check ((revoked_at is null) = (revoked_by is null))
);
create unique index badge_awards_one_active on public.badge_awards (user_id) where revoked_at is null;

alter table public.badges enable row level security;
alter table public.badge_awards enable row level security;
revoke all on public.badges, public.badge_awards from public, anon, authenticated;
grant select on public.badges, public.badge_awards to anon, authenticated;
grant all on public.badges, public.badge_awards to service_role;
create policy badges_read on public.badges for select to anon, authenticated using (true);
create policy badge_awards_read on public.badge_awards for select to anon, authenticated
  using (revoked_at is null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('badges', 'badges', true, 262144, array['image/png', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 262144, allowed_mime_types = array['image/png', 'image/webp'];

create policy badges_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'badges' and private.current_user_has_platform_role('owner'));
create policy badges_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'badges' and private.current_user_has_platform_role('owner'));

create function public.create_badge(
  badge_name text,
  badge_description text default null,
  image_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.console_write_guard(array['owner']);
  insert into public.badges (name, description, image_object_key, created_by)
  values (trim(badge_name), nullif(trim(coalesce(badge_description, '')), ''), image_key, auth.uid())
  returning id into new_id;
  insert into public.identity_audit_events (event_type, actor_user_id, details)
  values ('badge.created', auth.uid(), jsonb_build_object('badge_id', new_id, 'name', trim(badge_name)));
  return new_id;
end;
$$;
revoke all on function public.create_badge(text, text, text) from public, anon;
grant execute on function public.create_badge(text, text, text) to authenticated;

create function public.retire_badge(target_badge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.console_write_guard(array['owner']);
  update public.badges set retired_at = now() where id = target_badge_id and retired_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'BADGE_NOT_FOUND';
  end if;
  -- A retired badge comes off everyone wearing it.
  update public.badge_awards set revoked_at = now(), revoked_by = auth.uid()
  where badge_id = target_badge_id and revoked_at is null;
  insert into public.identity_audit_events (event_type, actor_user_id, details)
  values ('badge.retired', auth.uid(), jsonb_build_object('badge_id', target_badge_id));
end;
$$;
revoke all on function public.retire_badge(uuid) from public, anon;
grant execute on function public.retire_badge(uuid) to authenticated;

-- Pins a badge to a member, replacing any badge they wore. Null removes it.
create function public.set_member_badge(target_public_id uuid, target_badge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  perform private.console_write_guard(array['owner']);
  member_id := private.member_by_public_id(target_public_id);
  if target_badge_id is not null and not exists (
    select 1 from public.badges where id = target_badge_id and retired_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'BADGE_NOT_FOUND';
  end if;
  update public.badge_awards set revoked_at = now(), revoked_by = auth.uid()
  where user_id = member_id and revoked_at is null;
  if target_badge_id is not null then
    insert into public.badge_awards (badge_id, user_id, awarded_by)
    values (target_badge_id, member_id, auth.uid());
  end if;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values (
    case when target_badge_id is null then 'badge.removed' else 'badge.awarded' end,
    auth.uid(),
    member_id,
    jsonb_build_object('badge_id', target_badge_id)
  );
end;
$$;
revoke all on function public.set_member_badge(uuid, uuid) from public, anon;
grant execute on function public.set_member_badge(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. People
-- ---------------------------------------------------------------------------

create function public.console_search_members(search text default null, max_rows integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  role_ text := private.current_user_console_role();
  staff boolean;
  term text := nullif(trim(coalesce(search, '')), '');
begin
  if role_ is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  staff := role_ in ('owner', 'platform_sheriff');
  return coalesce((
    select jsonb_agg(row_ order by (row_->>'joinedAt') desc)
    from (
      select jsonb_build_object(
        'publicId', p.public_id,
        'displayName', p.display_name,
        'email', case when staff then u.email end,
        'joinedAt', p.created_at,
        'emailVerified', u.email_confirmed_at is not null,
        'institution', (
          select jsonb_build_object('id', i.id, 'name', i.name, 'state', m.verification_state)
          from public.institution_memberships m
          join public.institutions i on i.id = m.institution_id
          where m.user_id = p.user_id
          order by m.updated_at desc
          limit 1
        ),
        'roles', coalesce((
          select jsonb_agg(r.role::text) from public.platform_role_assignments r where r.user_id = p.user_id
        ), '[]'::jsonb) || coalesce((
          select jsonb_agg('institution_sheriff:' || r.institution_id::text)
          from public.institution_role_assignments r where r.user_id = p.user_id
        ), '[]'::jsonb),
        'restriction', (
          select jsonb_build_object(
            'reasonCode', a.reason_code,
            'restrictedAt', a.restricted_at,
            'expiresAt', a.expires_at
          )
          from public.account_restrictions a
          where a.user_id = p.user_id and a.lifted_at is null
          limit 1
        ),
        'badge', (
          select jsonb_build_object('id', b.id, 'name', b.name)
          from public.badge_awards w join public.badges b on b.id = w.badge_id
          where w.user_id = p.user_id and w.revoked_at is null
          limit 1
        )
      ) as row_
      from public.profiles p
      join auth.users u on u.id = p.user_id
      where (
          staff
          or exists (
            select 1 from public.institution_memberships m
            where m.user_id = p.user_id
              and private.current_user_is_institution_sheriff(m.institution_id)
          )
        )
        and (
          term is null
          or p.display_name ilike '%' || replace(replace(term, '%', '\%'), '_', '\_') || '%'
          or (staff and u.email ilike '%' || replace(replace(term, '%', '\%'), '_', '\_') || '%')
          or p.public_id::text = term
        )
      order by p.created_at desc
      limit least(greatest(coalesce(max_rows, 25), 1), 100)
    ) rows_
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.console_search_members(text, integer) from public, anon;
grant execute on function public.console_search_members(text, integer) to authenticated;

create function public.console_rename_member(target_public_id uuid, new_name text, reason_code text)
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
  if char_length(trim(coalesce(new_name, ''))) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;
  update public.profiles set display_name = trim(new_name), updated_at = now() where user_id = member_id;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values ('profile.renamed_by_staff', auth.uid(), member_id, jsonb_build_object('reason_code', reason_code));
end;
$$;
revoke all on function public.console_rename_member(uuid, text, text) from public, anon;
grant execute on function public.console_rename_member(uuid, text, text) to authenticated;

create function public.console_reset_member_avatar(target_public_id uuid, reason_code text)
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
  set avatar_object_key = null, avatar_preset = null, updated_at = now()
  where user_id = member_id;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values ('profile.avatar_reset_by_staff', auth.uid(), member_id, jsonb_build_object('reason_code', reason_code));
end;
$$;
revoke all on function public.console_reset_member_avatar(uuid, text) from public, anon;
grant execute on function public.console_reset_member_avatar(uuid, text) to authenticated;

-- The Owner grants (manual method) or revokes institution verification.
create function public.console_set_institution_verification(
  target_public_id uuid,
  target_institution_id uuid,
  verified boolean,
  reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  perform private.console_write_guard(array['owner']);
  perform private.check_reason_code(reason_code);
  member_id := private.member_by_public_id(target_public_id);
  if not exists (select 1 from public.institutions where id = target_institution_id) then
    raise exception using errcode = 'P0002', message = 'INSTITUTION_NOT_FOUND';
  end if;
  if verified then
    insert into public.institution_memberships (
      user_id, institution_id, verification_state, verification_method, verified_at, verified_by
    ) values (member_id, target_institution_id, 'verified', 'manual', now(), auth.uid())
    on conflict (user_id, institution_id) do update
    set verification_state = 'verified', verification_method = 'manual',
        verified_at = now(), verified_by = auth.uid(), updated_at = now();
  else
    update public.institution_memberships
    set verification_state = 'unverified', verification_method = null,
        verified_at = null, verified_by = null, updated_at = now()
    where user_id = member_id and institution_id = target_institution_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'MEMBERSHIP_NOT_FOUND';
    end if;
  end if;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, institution_id, details)
  values (
    case when verified then 'institution.verified_by_owner' else 'institution.verification_revoked' end,
    auth.uid(), member_id, target_institution_id, jsonb_build_object('reason_code', reason_code)
  );
end;
$$;
revoke all on function public.console_set_institution_verification(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.console_set_institution_verification(uuid, uuid, boolean, text) to authenticated;

-- The Owner appoints or removes a Sheriff. A null institution means a
-- platform Sheriff; otherwise an institution Sheriff there.
create function public.console_set_sheriff(
  target_public_id uuid,
  target_institution_id uuid,
  appoint boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
begin
  perform private.console_write_guard(array['owner']);
  member_id := private.member_by_public_id(target_public_id);
  if member_id = auth.uid() then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if target_institution_id is null then
    if appoint then
      insert into public.platform_role_assignments (user_id, role, assigned_by)
      values (member_id, 'platform_sheriff', auth.uid()) on conflict do nothing;
    else
      delete from public.platform_role_assignments where user_id = member_id and role = 'platform_sheriff';
    end if;
  else
    if appoint then
      insert into public.institution_role_assignments (user_id, institution_id, role, assigned_by)
      values (member_id, target_institution_id, 'institution_sheriff', auth.uid()) on conflict do nothing;
    else
      delete from public.institution_role_assignments
      where user_id = member_id and institution_id = target_institution_id and role = 'institution_sheriff';
    end if;
  end if;
  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, institution_id, details)
  values (
    case when appoint then 'role.sheriff_appointed' else 'role.sheriff_removed' end,
    auth.uid(), member_id, target_institution_id,
    jsonb_build_object('scope', case when target_institution_id is null then 'platform' else 'institution' end)
  );
end;
$$;
revoke all on function public.console_set_sheriff(uuid, uuid, boolean) from public, anon;
grant execute on function public.console_set_sheriff(uuid, uuid, boolean) to authenticated;

-- Timeouts by public id, for the console (the functions themselves check roles).
create function public.console_timeout_member(target_public_id uuid, duration_hours integer, reason_code text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.timeout_account(private.member_by_public_id(target_public_id), duration_hours, reason_code);
$$;
revoke all on function public.console_timeout_member(uuid, integer, text) from public, anon;
grant execute on function public.console_timeout_member(uuid, integer, text) to authenticated;

create function public.console_restrict_member(target_public_id uuid, reason_code text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.restrict_account(private.member_by_public_id(target_public_id), reason_code);
$$;
revoke all on function public.console_restrict_member(uuid, text) from public, anon;
grant execute on function public.console_restrict_member(uuid, text) to authenticated;

create function public.console_lift_member_restriction(target_public_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.lift_account_restriction(private.member_by_public_id(target_public_id));
$$;
revoke all on function public.console_lift_member_restriction(uuid) from public, anon;
grant execute on function public.console_lift_member_restriction(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Moderation queue: hidden chat messages the caller may restore
-- ---------------------------------------------------------------------------

create function public.console_list_hidden_replies(max_rows integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_user_console_role() is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  return coalesce((
    select jsonb_agg(row_ order by (row_->>'hiddenAt') desc)
    from (
      select jsonb_build_object(
        'id', r.id,
        'body', r.body,
        'hiddenAt', r.hidden_at,
        'reasonCode', r.hidden_reason,
        'author', jsonb_build_object('publicId', a.public_id, 'displayName', a.display_name),
        'hiddenBy', h.display_name,
        'wanted', jsonb_build_object('id', w.public_id, 'title', w.title)
      ) as row_
      from public.wanted_replies r
      join public.wanted_requests w on w.id = r.wanted_request_id
      join public.profiles a on a.user_id = r.author_user_id
      left join public.profiles h on h.user_id = r.hidden_by
      where r.hidden_at is not null
        and private.current_user_moderates_wanted(w.id)
      order by r.hidden_at desc
      limit least(greatest(coalesce(max_rows, 50), 1), 200)
    ) rows_
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.console_list_hidden_replies(integer) from public, anon;
grant execute on function public.console_list_hidden_replies(integer) to authenticated;

-- The caller's console role, so screens offer only what the database allows.
create function public.console_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select private.current_user_console_role(); $$;
revoke all on function public.console_my_role() from public, anon;
grant execute on function public.console_my_role() to authenticated;
