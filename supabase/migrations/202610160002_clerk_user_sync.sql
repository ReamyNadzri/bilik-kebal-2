-- Clerk user sync (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md, slice 2).
--
-- Called only by the verified Clerk webhook handler (service role). Idempotent: a replayed or
-- duplicated delivery converges on the same row, and an older event never overwrites a newer
-- one (Clerk `updated_at` is kept per identity). Profiles are created here for Clerk accounts;
-- an imported Supabase Auth account is linked through the Clerk `external_id` the import sets,
-- which users cannot edit.

alter table private.user_identities add column clerk_updated_at timestamptz;

create function public.sync_clerk_user(
  target_clerk_user_id text,
  target_external_id text,
  target_email text,
  target_email_verified boolean,
  target_display_name text,
  target_clerk_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_identity private.user_identities;
  normalized_email text := nullif(lower(trim(target_email)), '');
  resolved_user_id uuid;
begin
  if target_clerk_user_id is null or target_clerk_user_id !~ '^user_[A-Za-z0-9]+$' then
    raise exception using errcode = '22023', message = 'CLERK_USER_ID_INVALID';
  end if;
  if target_clerk_updated_at is null then
    raise exception using errcode = '22023', message = 'CLERK_UPDATED_AT_REQUIRED';
  end if;

  select * into current_identity
  from private.user_identities
  where clerk_user_id = target_clerk_user_id
  for update;

  if not found
    and target_external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    select * into current_identity
    from private.user_identities
    where user_id = target_external_id::uuid
      and clerk_user_id is null
    for update;
  end if;

  if current_identity.user_id is not null then
    resolved_user_id := current_identity.user_id;

    if current_identity.clerk_updated_at is not null
      and target_clerk_updated_at < current_identity.clerk_updated_at
    then
      return resolved_user_id; -- a stale delivery
    end if;

    update private.user_identities
    set clerk_user_id = target_clerk_user_id,
        email = normalized_email,
        email_verified_at = case
          when target_email_verified then coalesce(current_identity.email_verified_at, now())
        end,
        clerk_updated_at = target_clerk_updated_at
    where user_id = resolved_user_id;
  else
    insert into public.profiles (display_name)
    values (
      left(
        coalesce(
          nullif(trim(target_display_name), ''),
          nullif(split_part(normalized_email, '@', 1), ''),
          'VAULTIX member'
        ),
        100
      )
    )
    returning user_id into resolved_user_id;

    insert into private.user_identities (
      user_id, clerk_user_id, email, email_verified_at, clerk_updated_at
    )
    values (
      resolved_user_id,
      target_clerk_user_id,
      normalized_email,
      case when target_email_verified then now() end,
      target_clerk_updated_at
    );
  end if;

  -- One welcome per account: the event id is the user id, so a replay or an imported account
  -- that was already welcomed adds nothing.
  if target_email_verified then
    perform public.enqueue_notification(resolved_user_id, resolved_user_id, 'welcome', resolved_user_id);
  end if;

  return resolved_user_id;
end;
$$;

revoke all on function public.sync_clerk_user(text, text, text, boolean, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_clerk_user(text, text, text, boolean, text, timestamptz)
  to service_role;
