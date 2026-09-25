-- Timed account restrictions ("timeouts").
--
-- Decisions recorded in context/progress-tracker.md (2026-09-25):
-- * A Sheriff (platform, or institution Sheriff of the member's verified
--   institution) or the Owner may time a member out for 1 hour, 24 hours or
--   7 days, with a reason code. A timed-out member can browse but cannot post,
--   reply, claim or fund (every such check already refuses an unlifted
--   restriction). The timeout lifts itself.
-- * Only the Owner may restrict an account permanently or lift a permanent
--   restriction. This narrows restrict_account, which platform Sheriffs could
--   call before.
-- * Nobody may time out the Owner; only the Owner may time out a platform
--   Sheriff; nobody may time themselves out.
-- * Every timeout, restriction and lift needs a sign-in in the last 15
--   minutes and is written to identity_audit_events.

alter table public.account_restrictions
  add column if not exists expires_at timestamptz,
  add constraint account_restrictions_expiry_check
    check (expires_at is null or expires_at > restricted_at);

create index if not exists account_restrictions_expiring
  on public.account_restrictions (expires_at)
  where lifted_at is null and expires_at is not null;

-- Whether the caller may moderate (time out) this member.
create function private.current_user_moderates_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and auth.uid() <> target_user_id
    and not exists (
      select 1 from public.platform_role_assignments p
      where p.user_id = target_user_id and p.role = 'owner'
    )
    and (
      private.current_user_has_platform_role('owner')
      or (
        private.current_user_has_platform_role('platform_sheriff')
        and not exists (
          select 1 from public.platform_role_assignments p
          where p.user_id = target_user_id and p.role = 'platform_sheriff'
        )
      )
      or exists (
        select 1 from public.institution_memberships m
        where m.user_id = target_user_id
          and m.verification_state = 'verified'
          and private.current_user_is_institution_sheriff(m.institution_id)
          and not exists (
            select 1 from public.platform_role_assignments p where p.user_id = target_user_id
          )
      )
    );
$$;
revoke all on function private.current_user_moderates_user(uuid) from public, anon;
grant execute on function private.current_user_moderates_user(uuid) to authenticated;

-- Permanent restriction: the Owner only. An active timeout becomes permanent.
create or replace function public.restrict_account(target_user_id uuid, reason_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  restriction_id uuid;
begin
  if not private.current_user_has_platform_role('owner') or auth.uid() = target_user_id then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;
  if reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_REASON_CODE';
  end if;

  select id into restriction_id
  from public.account_restrictions
  where user_id = target_user_id and lifted_at is null
  for update;

  if restriction_id is not null then
    update public.account_restrictions set expires_at = null where id = restriction_id;
  else
    insert into public.account_restrictions (user_id, reason_code, restricted_by)
    values (target_user_id, reason_code, auth.uid())
    returning id into restriction_id;
  end if;

  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values (
    'account.restricted',
    auth.uid(),
    target_user_id,
    jsonb_build_object('reason_code', reason_code, 'restriction_id', restriction_id)
  );
  return restriction_id;
end;
$$;
revoke all on function public.restrict_account(uuid, text) from public, anon;
grant execute on function public.restrict_account(uuid, text) to authenticated;

create function public.timeout_account(
  target_user_id uuid,
  duration_hours integer,
  reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  restriction_id uuid;
begin
  if not private.current_user_moderates_user(target_user_id) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;
  if duration_hours not in (1, 24, 168) then
    raise exception using errcode = '22023', message = 'INVALID_TIMEOUT_DURATION';
  end if;
  if reason_code is null or reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_REASON_CODE';
  end if;
  if exists (
    select 1 from public.account_restrictions
    where user_id = target_user_id and lifted_at is null
  ) then
    raise exception using errcode = '23505', message = 'ACCOUNT_ALREADY_RESTRICTED';
  end if;

  insert into public.account_restrictions (user_id, reason_code, restricted_by, expires_at)
  values (target_user_id, reason_code, auth.uid(), now() + make_interval(hours => duration_hours))
  returning id into restriction_id;

  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values (
    'account.timed_out',
    auth.uid(),
    target_user_id,
    jsonb_build_object(
      'reason_code', reason_code,
      'restriction_id', restriction_id,
      'duration_hours', duration_hours
    )
  );
  return restriction_id;
end;
$$;
revoke all on function public.timeout_account(uuid, integer, text) from public, anon;
grant execute on function public.timeout_account(uuid, integer, text) to authenticated;

-- Lift early. A timeout: whoever may moderate the member. Permanent: Owner.
create function public.lift_account_restriction(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active public.account_restrictions%rowtype;
begin
  select * into active from public.account_restrictions
  where user_id = target_user_id and lifted_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESTRICTION_NOT_FOUND';
  end if;
  if active.expires_at is null and not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if active.expires_at is not null and not private.current_user_moderates_user(target_user_id) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;

  update public.account_restrictions
  set lifted_at = now(), lifted_by = auth.uid()
  where id = active.id;

  insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
  values (
    'account.restriction_lifted',
    auth.uid(),
    target_user_id,
    jsonb_build_object('restriction_id', active.id, 'timed', active.expires_at is not null)
  );
end;
$$;
revoke all on function public.lift_account_restriction(uuid) from public, anon;
grant execute on function public.lift_account_restriction(uuid) to authenticated;

-- Lifts every timeout that has run out. Idempotent: a lifted row no longer
-- matches. Recorded as lifted by whoever set it, at the moment it expired.
create function private.lift_expired_timeouts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lifted_count integer;
begin
  with lifted as (
    update public.account_restrictions
    set lifted_at = expires_at, lifted_by = restricted_by
    where lifted_at is null and expires_at is not null and expires_at <= now()
    returning id, user_id, restricted_by
  ), audited as (
    insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
    select 'account.timeout_expired', restricted_by, user_id, jsonb_build_object('restriction_id', id)
    from lifted
    returning 1
  )
  select count(*) into lifted_count from audited;
  return lifted_count;
end;
$$;
revoke all on function private.lift_expired_timeouts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$
      select cron.schedule(
        'account-timeout-lift',
        '* * * * *',
        'select private.lift_expired_timeouts()'
      )
    $cron$;
  else
    raise notice 'pg_cron is not installed; account-timeout-lift was not scheduled';
  end if;
end;
$$;
