-- Chat messages: quote replies, 15-minute edits, deletes, and moderator hides.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-25):
-- * A message may quote (answer) another message in the same thread.
-- * The author may edit a message for 15 minutes after posting, while the
--   thread is open; an edited message is marked "edited". No edit history is
--   kept.
-- * The author may delete a message at any time. Its text is erased at once
--   and the thread shows "Message deleted" in its place, so answers to it
--   still make sense.
-- * A Sheriff (platform, or institution Sheriff for the Wanted's institution)
--   or the Owner may hide any message with a reason, and restore it. Hidden
--   messages keep their text for moderation, are unreadable to members, and
--   survive the 7-day thread purge. Every hide and restore is audited.

alter table public.wanted_replies
  add column if not exists parent_reply_id uuid references public.wanted_replies (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles (user_id) on delete restrict,
  add column if not exists hidden_reason text
    check (hidden_reason is null or hidden_reason ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  add constraint wanted_replies_hidden_fields_check check (
    (hidden_at is null and hidden_by is null and hidden_reason is null)
    or (hidden_at is not null and hidden_by is not null and hidden_reason is not null)
  );

create index if not exists wanted_replies_parent on public.wanted_replies (parent_reply_id)
  where parent_reply_id is not null;

-- The placeholder a deleted message keeps; the original text is gone.
create function private.deleted_reply_body()
returns text language sql immutable set search_path = '' as $$ select 'deleted'::text $$;
revoke all on function private.deleted_reply_body() from public, anon, authenticated;

-- Moderators of a Wanted: the Owner, a platform Sheriff, or an institution
-- Sheriff of the Wanted's institution.
create function private.current_user_moderates_wanted(target_wanted_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wanted_requests w
    where w.id = target_wanted_id
      and (
        private.current_user_has_platform_role('owner')
        or private.current_user_has_platform_role('platform_sheriff')
        or private.current_user_is_institution_sheriff(w.institution_id)
      )
  );
$$;
revoke all on function private.current_user_moderates_wanted(uuid) from public, anon;
grant execute on function private.current_user_moderates_wanted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Posting, now with an optional quoted message
-- ---------------------------------------------------------------------------

drop function if exists public.post_wanted_reply(uuid, text);

create function public.post_wanted_reply(
  target_public_id uuid,
  reply_body text,
  parent_reply uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.wanted_requests%rowtype;
  new_id uuid;
begin
  select * into target from public.wanted_requests
  where public_id = target_public_id and status = 'open' and vanished_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_not_found';
  end if;
  if not private.current_user_can_transact_at(target.institution_id) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if target.kind = 'academic' and private.text_contains_contact_or_link(reply_body) then
    raise exception using errcode = '22023', message = 'wanted_reply_link_not_allowed';
  end if;
  if parent_reply is not null and not exists (
    select 1 from public.wanted_replies p
    where p.id = parent_reply
      and p.wanted_request_id = target.id
      and p.deleted_at is null
      and p.hidden_at is null
  ) then
    raise exception using errcode = '22023', message = 'wanted_reply_parent_invalid';
  end if;
  insert into public.wanted_replies (wanted_request_id, author_user_id, body, parent_reply_id)
  values (target.id, auth.uid(), trim(reply_body), parent_reply)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.post_wanted_reply(uuid, text, uuid) from public, anon;
grant execute on function public.post_wanted_reply(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Edit (author, 15 minutes, open thread) and delete (author, any time)
-- ---------------------------------------------------------------------------

create function public.edit_own_wanted_reply(target_reply_id uuid, new_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reply public.wanted_replies%rowtype;
  target public.wanted_requests%rowtype;
begin
  select * into reply from public.wanted_replies
  where id = target_reply_id and author_user_id = auth.uid()
  for update;
  if not found or reply.deleted_at is not null or reply.hidden_at is not null then
    raise exception using errcode = '42501', message = 'wanted_reply_not_editable';
  end if;
  select * into strict target from public.wanted_requests where id = reply.wanted_request_id;
  if target.status <> 'open' or reply.created_at <= now() - interval '15 minutes' then
    raise exception using errcode = '42501', message = 'wanted_reply_edit_window_closed';
  end if;
  if target.kind = 'academic' and private.text_contains_contact_or_link(new_body) then
    raise exception using errcode = '22023', message = 'wanted_reply_link_not_allowed';
  end if;
  update public.wanted_replies
  set body = trim(new_body), edited_at = now()
  where id = reply.id;
end;
$$;
revoke all on function public.edit_own_wanted_reply(uuid, text) from public, anon;
grant execute on function public.edit_own_wanted_reply(uuid, text) to authenticated;

create function public.delete_own_wanted_reply(target_reply_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wanted_replies
  set body = private.deleted_reply_body(), deleted_at = now(), edited_at = null
  where id = target_reply_id
    and author_user_id = auth.uid()
    and deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'wanted_reply_not_deletable';
  end if;
end;
$$;
revoke all on function public.delete_own_wanted_reply(uuid) from public, anon;
grant execute on function public.delete_own_wanted_reply(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderator hide and restore, audited
-- ---------------------------------------------------------------------------

create function public.set_wanted_reply_hidden(
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
  if found then
    insert into public.identity_audit_events (event_type, actor_user_id, subject_user_id, details)
    values (
      case when hide then 'chat.reply_hidden' else 'chat.reply_restored' end,
      auth.uid(),
      reply.author_user_id,
      jsonb_build_object('reply_id', reply.id, 'reason_code', reason_code)
    );
  end if;
end;
$$;
revoke all on function public.set_wanted_reply_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.set_wanted_reply_hidden(uuid, boolean, text) to authenticated;

-- Moderators read hidden messages (with their text); members never do.
create policy wanted_replies_read_moderators on public.wanted_replies for select to authenticated
using (hidden_at is not null and private.current_user_moderates_wanted(wanted_request_id));
