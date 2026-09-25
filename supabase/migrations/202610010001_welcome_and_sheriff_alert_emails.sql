-- Welcome email + WELCOME reward code, Sheriff alert on institution verification
-- submission, and allow-listed per-kind context for the email dispatcher.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
  'institution_verification_approved', 'institution_verification_rejected',
  'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated',
  'wanted_reply',
  'taxonomy_request_approved', 'taxonomy_request_rejected',
  'community_payout_approved', 'community_payout_rejected', 'community_bounty_awarded',
  'institution_verification_submitted', 'welcome'
));

-- Matches the Owner-created production code (2 free requests, 50 redemptions).
-- An existing WELCOME is never overwritten; the Owner manages it.
insert into public.reward_codes (code, credits_per_redemption, max_redemptions, active, expires_at, created_by)
values ('WELCOME', 2, 50, true, null, null)
on conflict ((upper(code))) do nothing;

create function private.publish_institution_verification_submitted_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  for recipient in
    select user_id from public.platform_role_assignments where role = 'platform_sheriff'
    union
    select user_id from public.institution_role_assignments
    where role = 'institution_sheriff' and institution_id = new.institution_id
  loop
    if recipient <> new.user_id then
      perform public.enqueue_notification(new.id, recipient, 'institution_verification_submitted', new.id);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.publish_institution_verification_submitted_notification() from public, anon, authenticated;
create trigger institution_verification_submitted_notification
after insert on public.institution_verification_requests
for each row execute function private.publish_institution_verification_submitted_notification();

-- Runs inside Supabase Auth's transaction: it must never raise. Same-event triggers fire
-- in name order, so auth_user_created_create_profile has made the profile before
-- welcome_notification_on_insert runs for users confirmed at creation.
create function private.publish_welcome_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
    and (tg_op = 'INSERT' or old.email_confirmed_at is null)
    and exists (select 1 from public.profiles where user_id = new.id)
  then
    begin
      perform public.enqueue_notification(new.id, new.id, 'welcome', new.id);
    exception when others then
      null; -- A missed welcome must not block sign-up or verification.
    end;
  end if;
  return new;
end;
$$;
revoke all on function private.publish_welcome_notification() from public, anon, authenticated;
create trigger welcome_notification_on_confirm
after update of email_confirmed_at on auth.users
for each row execute function private.publish_welcome_notification();
create trigger welcome_notification_on_insert
after insert on auth.users
for each row execute function private.publish_welcome_notification();

create function private.notification_email_context(target_kind text, target_subject_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select case target_kind
    when 'institution_verification_submitted' then coalesce((
      select jsonb_build_object(
        'requesterDisplayName', left(p.display_name, 80),
        'institutionName', left(i.name, 80))
      from public.institution_verification_requests r
      join public.profiles p on p.user_id = r.user_id
      join public.institutions i on i.id = r.institution_id
      where r.id = target_subject_id), '{}'::jsonb)
    -- The welcome email offers WELCOME only while it can still be redeemed.
    when 'welcome' then coalesce((
      select jsonb_build_object('welcomeCodeCredits', c.credits_per_redemption)
      from public.reward_codes c
      where upper(c.code) = 'WELCOME' and c.active
        and (c.expires_at is null or c.expires_at > now())
        and c.redemption_count < c.max_redemptions), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;
revoke all on function private.notification_email_context(text, uuid) from public, anon, authenticated;

-- Return shape changes, so drop and recreate with the same grants.
drop function public.claim_notification_email_batch(integer);
create function public.claim_notification_email_batch(batch_size integer default 20)
returns table (
  notification_id uuid,
  lease_token uuid,
  recipient_email text,
  notification_kind text,
  attempt integer,
  idempotency_expires_at timestamptz,
  correlation_id uuid,
  notification_context jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if batch_size is null or batch_size < 1 or batch_size > 50 then
    raise exception 'INVALID_BATCH_SIZE' using errcode = '22023';
  end if;

  update private.notification_email_outbox o
  set state = 'manual_review', lease_token = null, lease_expires_at = null,
      last_error_code = 'idempotency_window_elapsed', last_error_at = now()
  where o.state in ('queued', 'leased')
    and o.idempotency_expires_at <= now()
    and (o.state = 'queued' or o.lease_expires_at <= now());

  return query
  with candidates as (
    select o.notification_id
    from private.notification_email_outbox o
    where o.state in ('queued', 'leased')
      and o.available_at <= now()
      and o.idempotency_expires_at > now()
      and (o.state = 'queued' or o.lease_expires_at <= now())
    order by o.available_at, o.created_at, o.notification_id
    limit batch_size
    for update skip locked
  ), leased as (
    update private.notification_email_outbox o
    set state = 'leased', attempt_count = o.attempt_count + 1,
        lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes'
    from candidates c
    where o.notification_id = c.notification_id
    returning o.notification_id, o.lease_token, o.attempt_count, o.idempotency_expires_at, o.correlation_id
  )
  select l.notification_id, l.lease_token,
         -- auth.users.email is varchar; the declared column is text.
         case when u.email_confirmed_at is not null then u.email::text else null end,
         n.kind, l.attempt_count, l.idempotency_expires_at, l.correlation_id,
         private.notification_email_context(n.kind, n.subject_id)
  from leased l
  join public.notifications n on n.id = l.notification_id
  join auth.users u on u.id = n.recipient_user_id;
end;
$$;
revoke all on function public.claim_notification_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_email_batch(integer) to service_role;
