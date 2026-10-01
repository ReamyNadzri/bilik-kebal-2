-- Migration: 202610190003_profile_limits_tags_and_deletion.sql
--
-- Requests of 2026-10-02:
--
--   1. A display name can be changed twice. A reward code of kind
--      'name_change' adds more changes; the existing codes keep adding free
--      requests ('free_requests').
--   2. Tags are open: a member types any tag and it is created at once,
--      without a Sheriff. A Sheriff can still switch a tag off (active =
--      false), and a switched-off tag cannot be typed back in.
--   3. A member may delete their account once it is 30 days old. Deleting
--      anonymises the profile and restricts it for good; ledger, audit and
--      archive rows are kept, as the law requires, and keep pointing at the
--      anonymous profile. It is refused while money or a claim of theirs is
--      still in motion.

-- ---------------------------------------------------------------------------
-- 1. Display name changes
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists display_name_changes integer not null default 0
    check (display_name_changes >= 0),
  add column if not exists deleted_at timestamptz;

alter table public.reward_codes
  add column if not exists kind text not null default 'free_requests'
    check (kind in ('free_requests', 'name_change'));

alter table public.reward_code_redemptions
  add column if not exists kind text not null default 'free_requests'
    check (kind in ('free_requests', 'name_change'));

-- Free requests count only the codes that add free requests.
create or replace function private.free_request_allowance(target_user_id uuid)
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select
      3 as base,
      coalesce((
        select sum(r.credits)::integer from public.reward_code_redemptions r
        where r.user_id = target_user_id and r.kind = 'free_requests'
      ), 0) as bonus,
      (
        select count(*)::integer from public.wanted_requests w
        where w.commissioner_user_id = target_user_id and w.is_free and w.status <> 'draft'
      ) as used
  )
  select base, bonus, used, greatest(base + bonus - used, 0) from totals;
$$;

create function private.display_name_allowance(target_user_id uuid)
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select
      2 as base,
      coalesce((
        select sum(r.credits)::integer from public.reward_code_redemptions r
        where r.user_id = target_user_id and r.kind = 'name_change'
      ), 0) as bonus,
      coalesce((
        select p.display_name_changes from public.profiles p where p.user_id = target_user_id
      ), 0) as used
  )
  select base, bonus, used, greatest(base + bonus - used, 0) from totals;
$$;
revoke all on function private.display_name_allowance(uuid) from public, anon, authenticated;

create function public.my_display_name_allowance()
returns table (base integer, bonus integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.display_name_allowance(private.current_user_id());
$$;
revoke all on function public.my_display_name_allowance() from public, anon;
grant execute on function public.my_display_name_allowance() to authenticated;

-- A changed name takes one change; saving the same name (or only the bio)
-- takes none. The row lock keeps two saves at once from both taking the last.
create or replace function public.update_own_profile(new_display_name text, new_bio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  current_name text;
  wanted_name text := trim(new_display_name);
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'profile_auth_required';
  end if;
  select display_name into current_name from public.profiles
  where user_id = actor_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'profile_auth_required';
  end if;

  if wanted_name is distinct from current_name then
    if (select remaining from private.display_name_allowance(actor_id)) <= 0 then
      raise exception using errcode = 'P0001', message = 'display_name_change_limit';
    end if;
    update public.profiles
    set display_name = wanted_name,
        display_name_changes = display_name_changes + 1,
        bio = nullif(trim(coalesce(new_bio, '')), '')
    where user_id = actor_id;
  else
    update public.profiles
    set bio = nullif(trim(coalesce(new_bio, '')), '')
    where user_id = actor_id;
  end if;
end;
$$;
revoke all on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;

-- The redemption records the code's kind, so each allowance sums its own.
create or replace function public.redeem_reward_code(target_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  found_code public.reward_codes%rowtype;
begin
  if actor_id is null or not private.current_user_is_email_verified() then
    raise exception using errcode = '42501', message = 'reward_code_not_eligible';
  end if;

  if (
    select count(*) from private.reward_code_attempts
    where user_id = actor_id and not succeeded and created_at > now() - interval '1 hour'
  ) >= 10 then
    return 'rate_limited';
  end if;

  select * into found_code from public.reward_codes
  where upper(code) = upper(trim(coalesce(target_code, '')))
    and active
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'invalid';
  end if;
  if exists (
    select 1 from public.reward_code_redemptions
    where reward_code_id = found_code.id and user_id = actor_id
  ) then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'already_redeemed';
  end if;
  if found_code.redemption_count >= found_code.max_redemptions then
    insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, false);
    return 'exhausted';
  end if;

  insert into public.reward_code_redemptions (reward_code_id, user_id, credits, kind)
  values (found_code.id, actor_id, found_code.credits_per_redemption, found_code.kind);
  update public.reward_codes set redemption_count = redemption_count + 1 where id = found_code.id;
  insert into private.reward_code_attempts (user_id, succeeded) values (actor_id, true);
  return 'redeemed';
end;
$$;
revoke all on function public.redeem_reward_code(text) from public, anon;
grant execute on function public.redeem_reward_code(text) to authenticated;

-- Owner-only, now with a kind. The old four-argument form is replaced.
drop function public.create_reward_code(text, integer, integer, timestamptz);
create function public.create_reward_code(
  target_code text,
  target_credits integer,
  target_max_redemptions integer,
  target_expires_at timestamptz default null,
  target_kind text default 'free_requests'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  if not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'reward_code_owner_only';
  end if;
  insert into public.reward_codes (code, credits_per_redemption, max_redemptions, expires_at, created_by, kind)
  values (
    trim(target_code), target_credits, target_max_redemptions, target_expires_at,
    private.current_user_id(), target_kind
  )
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_reward_code(text, integer, integer, timestamptz, text) from public, anon;
grant execute on function public.create_reward_code(text, integer, integer, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Open tags
-- ---------------------------------------------------------------------------

create unique index if not exists tags_name_lower_uniq on public.tags (lower(name));

-- The tag named `target_name`, created when it does not exist yet. Any member
-- verified at an institution may add one. Names are 2 to 30 characters of
-- letters, digits, spaces and . + # & -; case is ignored when matching, so
-- "Calculus" and "calculus" are one tag. A tag a Sheriff switched off stays
-- off.
create function public.ensure_tag(target_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  wanted_name text := regexp_replace(trim(coalesce(target_name, '')), '\s+', ' ', 'g');
  tag_id uuid;
  tag_active boolean;
begin
  if actor_id is null or not private.current_user_is_email_verified() or not exists (
    select 1 from public.institution_memberships m
    where m.user_id = actor_id and m.verification_state = 'verified'
  ) then
    raise exception using errcode = '42501', message = 'wanted_actor_not_eligible';
  end if;
  if char_length(wanted_name) not between 2 and 30
    or wanted_name !~ '^[[:alnum:]][[:alnum:] .+#&-]*$' then
    raise exception using errcode = '22023', message = 'tag_invalid';
  end if;

  insert into public.tags (slug, name)
  values (
    private.slugify(wanted_name, left(replace(gen_random_uuid()::text, '-', ''), 6)),
    wanted_name
  )
  on conflict ((lower(name))) do nothing;

  select id, active into tag_id, tag_active from public.tags where lower(name) = lower(wanted_name);
  if not tag_active then
    raise exception using errcode = '22023', message = 'tag_unavailable';
  end if;
  return tag_id;
end;
$$;
revoke all on function public.ensure_tag(text) from public, anon;
grant execute on function public.ensure_tag(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Account deletion
-- ---------------------------------------------------------------------------

-- Returns 'deleted'. Refusals are errors the app words for the member:
--   account_too_new           the account is less than 30 days old
--   account_has_open_items    a Wanted they posted still holds money or is
--                             under review, a claim of theirs is still being
--                             reviewed, or a payout or refund to them is not
--                             finished
create function public.delete_own_account()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  joined timestamptz;
  already_deleted timestamptz;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'profile_auth_required';
  end if;
  select created_at, deleted_at into joined, already_deleted from public.profiles
  where user_id = actor_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'profile_auth_required';
  end if;
  -- Idempotent: a retry after the sign-in provider step failed finishes it.
  if already_deleted is not null then
    return 'deleted';
  end if;
  if joined > now() - interval '30 days' then
    raise exception using errcode = 'P0001', message = 'account_too_new';
  end if;

  if exists (
    select 1 from public.wanted_requests w
    where w.commissioner_user_id = actor_id
      and w.status in ('awaiting_payment', 'open', 'reviewing')
      and not w.is_free
  ) or exists (
    select 1 from public.claims c
    where c.hunter_user_id = actor_id
      and c.status in ('uploading', 'screening', 'needs_information', 'under_review', 'appeal_pending')
  ) or exists (
    select 1 from public.payout_tasks p
    where p.hunter_user_id = actor_id and p.status in ('pending', 'processing')
  ) or exists (
    select 1 from public.refund_tasks r
    where r.contributor_user_id = actor_id and r.status in ('pending', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'account_has_open_items';
  end if;

  -- Free requests they posted stay, shown as posted by "Deleted hunter",
  -- and close the usual way (30 days without a new message).
  update public.profiles
  set display_name = 'Deleted hunter',
      bio = null,
      avatar_object_key = null,
      avatar_preset = null,
      external_avatar_url = null,
      deleted_at = now()
  where user_id = actor_id;

  delete from private.member_payment_details where user_id = actor_id;

  -- Restricted for good: off the Hunters wall, and no action is accepted.
  insert into public.account_restrictions (user_id, reason_code, restricted_by)
  values (actor_id, 'account_deleted', actor_id);

  return 'deleted';
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
