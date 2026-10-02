-- 202610170001 was written after the Clerk identity bridge (202610160001) and brought back
-- private.current_user_id() in two functions. Clerk session subjects look like "user_...", so private.current_user_id()'s
-- uuid cast throws: "Use my Google photo" and the Sheriff's avatar reset always answered
-- "could not be saved". Both now identify the caller with private.current_user_id().
-- Bodies are otherwise unchanged; create or replace keeps the existing grants.

create or replace function public.use_own_external_avatar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid := private.current_user_id();
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
    and member_id <> private.current_user_id() then
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
  values ('profile.avatar_reset_by_staff', private.current_user_id(), member_id, jsonb_build_object('reason_code', reason_code));
end;
$$;
