-- Tell a member when a Sheriff hides one of their chat messages. The notice
-- says only that a message was hidden and links to the request; the message
-- text and the Sheriff who hid it are never included.

-- 1. Append the kind to the current list rather than restating it.
do $$
declare
  current_def text;
begin
  select pg_get_constraintdef(oid) into current_def
  from pg_constraint
  where conname = 'notifications_kind_check' and conrelid = 'public.notifications'::regclass;
  if current_def is null then
    raise exception 'notifications_kind_check not found';
  end if;
  if position('wanted_reply_hidden' in current_def) = 0 then
    if position('''wanted_thread_auto_closed''::text' in current_def) = 0 then
      raise exception 'unexpected notifications_kind_check: %', current_def;
    end if;
    alter table public.notifications drop constraint notifications_kind_check;
    execute 'alter table public.notifications add constraint notifications_kind_check '
      || replace(current_def, '''wanted_thread_auto_closed''::text',
                 '''wanted_thread_auto_closed''::text, ''wanted_reply_hidden''::text');
  end if;
end;
$$;

-- 2. Hiding now also notifies the writer. Restoring does not.
create or replace function public.set_wanted_reply_hidden(
  target_reply_id uuid,
  hide boolean,
  reason_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reply public.wanted_replies%rowtype;
  changed boolean;
  wanted_public_id uuid;
begin
  select * into reply from public.wanted_replies where id = target_reply_id for update;
  if not found or not private.current_user_moderates_wanted(reply.wanted_request_id) then
    raise exception using errcode = '42501', message = 'wanted_reply_moderator_required';
  end if;
  if hide then
    if reason_code is null or reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
      raise exception using errcode = '22023', message = 'wanted_reply_reason_invalid';
    end if;
    update public.wanted_replies
    set hidden_at = now(), hidden_by = auth.uid(), hidden_reason = reason_code
    where id = reply.id and hidden_at is null;
  else
    update public.wanted_replies
    set hidden_at = null, hidden_by = null, hidden_reason = null
    where id = reply.id and hidden_at is not null;
  end if;
  changed := found;
  if changed then
    insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
    values (
      case when hide then 'chat.reply_hidden' else 'chat.reply_restored' end,
      auth.uid(),
      reply.author_user_id,
      jsonb_build_object('reply_id', reply.id, 'reason_code', reason_code)
    );
  end if;
  if changed and hide and reply.author_user_id is distinct from auth.uid() then
    select w.public_id into wanted_public_id
    from public.wanted_requests w where w.id = reply.wanted_request_id;
    -- Each hide is its own event, so hiding again after a restore notifies again.
    perform public.enqueue_notification(
      gen_random_uuid(), reply.author_user_id, 'wanted_reply_hidden', wanted_public_id
    );
  end if;
end;
$$;
revoke all on function public.set_wanted_reply_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.set_wanted_reply_hidden(uuid, boolean, text) to authenticated;
