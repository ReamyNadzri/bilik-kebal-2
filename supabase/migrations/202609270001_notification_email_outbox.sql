create type private.notification_email_state as enum (
  'queued', 'leased', 'sent', 'failed', 'manual_review'
);

create table private.notification_email_outbox (
  notification_id uuid primary key references public.notifications(id) on delete restrict,
  state private.notification_email_state not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_expires_at timestamptz not null default (now() + interval '14 minutes'),
  provider_message_id text,
  last_error_code text check (last_error_code in (
    'provider_rejected', 'provider_unavailable', 'invalid_recipient', 'idempotency_window_elapsed'
  )),
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (
    (state = 'leased' and lease_token is not null and lease_expires_at is not null)
    or (state <> 'leased' and lease_token is null and lease_expires_at is null)
  ),
  check (
    (state = 'sent' and sent_at is not null and provider_message_id is not null)
    or (state <> 'sent' and sent_at is null and provider_message_id is null)
  )
);

create index notification_email_outbox_due
  on private.notification_email_outbox (available_at, created_at)
  where state in ('queued', 'leased');

revoke all on private.notification_email_outbox from public, anon, authenticated, service_role;

create function private.enqueue_notification_email()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.notification_email_outbox(notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_notification_email() from public, anon, authenticated;

create trigger notification_email_outbox_enqueue
after insert on public.notifications
for each row execute function private.enqueue_notification_email();

create function public.claim_notification_email_batch(batch_size integer default 20)
returns table (
  notification_id uuid,
  lease_token uuid,
  recipient_email text,
  notification_kind text,
  attempt integer,
  idempotency_expires_at timestamptz,
  correlation_id uuid
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
         case when u.email_confirmed_at is not null then u.email else null end,
         n.kind, l.attempt_count, l.idempotency_expires_at, l.correlation_id
  from leased l
  join public.notifications n on n.id = l.notification_id
  join auth.users u on u.id = n.recipient_user_id;
end;
$$;
revoke all on function public.claim_notification_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_email_batch(integer) to service_role;

create function public.mark_notification_email_sent(
  target_notification_id uuid, target_lease_token uuid, target_provider_message_id text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if target_provider_message_id is null or length(target_provider_message_id) not between 1 and 200 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID' using errcode = '22023';
  end if;
  update private.notification_email_outbox
  set state = 'sent', sent_at = now(), provider_message_id = target_provider_message_id,
      lease_token = null, lease_expires_at = null, last_error_code = null, last_error_at = null
  where notification_id = target_notification_id and state = 'leased' and lease_token = target_lease_token;
  return found;
end;
$$;
revoke all on function public.mark_notification_email_sent(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_notification_email_sent(uuid, uuid, text) to service_role;

create function public.record_notification_email_failure(
  target_notification_id uuid,
  target_lease_token uuid,
  safe_error_code text,
  is_retryable boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare next_state private.notification_email_state;
begin
  if safe_error_code not in ('provider_rejected', 'provider_unavailable', 'invalid_recipient') then
    raise exception 'INVALID_DELIVERY_ERROR_CODE' using errcode = '22023';
  end if;
  if is_retryable and safe_error_code <> 'provider_unavailable' then
    raise exception 'INVALID_RETRY_CLASSIFICATION' using errcode = '22023';
  end if;

  update private.notification_email_outbox o
  set state = case
        when is_retryable and o.attempt_count < 8 and now() < o.idempotency_expires_at then 'queued'::private.notification_email_state
        when is_retryable then 'manual_review'::private.notification_email_state
        else 'failed'::private.notification_email_state
      end,
      available_at = case when is_retryable then
        now() + make_interval(secs => least(21600, 30 * (2 ^ least(o.attempt_count - 1, 10)))::integer)
        else o.available_at end,
      lease_token = null, lease_expires_at = null,
      last_error_code = safe_error_code, last_error_at = now()
  where o.notification_id = target_notification_id and o.state = 'leased'
    and o.lease_token = target_lease_token
  returning o.state into next_state;
  if not found then return null; end if;
  return next_state::text;
end;
$$;
revoke all on function public.record_notification_email_failure(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_notification_email_failure(uuid, uuid, text, boolean) to service_role;

create function public.move_notification_email_to_review(
  target_notification_id uuid, target_lease_token uuid, review_reason text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if review_reason <> 'idempotency_window_elapsed' then
    raise exception 'INVALID_REVIEW_REASON' using errcode = '22023';
  end if;
  update private.notification_email_outbox
  set state = 'manual_review', lease_token = null, lease_expires_at = null,
      last_error_code = review_reason, last_error_at = now()
  where notification_id = target_notification_id and state = 'leased'
    and lease_token = target_lease_token;
  return found;
end;
$$;
revoke all on function public.move_notification_email_to_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.move_notification_email_to_review(uuid, uuid, text) to service_role;
