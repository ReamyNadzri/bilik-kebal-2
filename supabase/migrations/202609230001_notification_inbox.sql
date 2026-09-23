-- Payloads contain identifiers only; presentation copy lives in the contract.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  recipient_user_id uuid not null references public.profiles(user_id) on delete restrict,
  kind text not null check (kind in (
    'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
    'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated'
  )),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (event_id, recipient_user_id)
);

create index notifications_recipient_cursor
  on public.notifications (recipient_user_id, created_at desc, id desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_recipient_read on public.notifications
  for select to authenticated using (recipient_user_id = (select auth.uid()));

-- Called by an owning domain's committed event consumer, never a browser.
create function public.enqueue_notification(
  target_event_id uuid, target_recipient_id uuid, target_kind text, target_subject_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  stored public.notifications;
begin
  insert into public.notifications(event_id, recipient_user_id, kind, subject_id)
  values (target_event_id, target_recipient_id, target_kind, target_subject_id)
  on conflict (event_id, recipient_user_id) do nothing;

  select * into strict stored from public.notifications
  where event_id = target_event_id and recipient_user_id = target_recipient_id;
  if stored.kind is distinct from target_kind or stored.subject_id is distinct from target_subject_id then
    raise exception 'NOTIFICATION_EVENT_CONFLICT' using errcode = '22023';
  end if;
  return stored.id;
end;
$$;
revoke all on function public.enqueue_notification(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_notification(uuid, uuid, text, uuid) to service_role;

-- Security invoker preserves RLS even if a caller bypasses the HTTP endpoint.
create function public.list_notifications(
  page_size integer default 20, before_created_at timestamptz default null, before_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if page_size is null or page_size < 1 or page_size > 50
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc, n.id desc), '[]'::jsonb)
  into result from (
    select id, kind, subject_id, created_at, read_at from public.notifications
    where recipient_user_id = auth.uid()
      and (before_created_at is null or (created_at, id) < (before_created_at, before_id))
    order by created_at desc, id desc limit page_size + 1
  ) n;
  return result;
end;
$$;
revoke all on function public.list_notifications(integer, timestamptz, uuid) from public, anon;
grant execute on function public.list_notifications(integer, timestamptz, uuid) to authenticated;

-- Only this operation may update read_at; recipients cannot rewrite inbox content.
create function public.mark_notification_read(target_notification_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where id = target_notification_id and recipient_user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
