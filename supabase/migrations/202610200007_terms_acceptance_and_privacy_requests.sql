-- Migration: 202610200007_terms_acceptance_and_privacy_requests.sql
--
-- Request of 2026-10-03:
--
--   1. Every member accepts the Terms of Use and the Privacy Notice, and
--      confirms they are 18 or older: once at sign-up, and again whenever the
--      Terms change. Each acceptance is a permanent record.
--   2. Members ask for a copy of their data, a correction or a deletion from
--      inside VAULTIX. Only the Owner reads and answers those requests; the
--      member reads their own and the answer.


-- ---------------------------------------------------------------------------
-- 1. Terms versions and acceptances
-- ---------------------------------------------------------------------------

-- One row per published version of the Terms of Use and Privacy Notice. A new
-- version is a new migration inserting a row; the latest one is current.
create table public.terms_versions (
  version text primary key check (version ~ '^\d{4}-\d{2}-\d{2}(\.\d+)?$'),
  effective_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.terms_versions enable row level security;
revoke all on public.terms_versions from public, anon, authenticated;
grant select on public.terms_versions to anon, authenticated;

create policy terms_versions_read on public.terms_versions
  for select to anon, authenticated
  using (true);

insert into public.terms_versions (version, effective_at)
values ('2026-10-03', '2026-10-03T00:00:00+08:00');

-- Never edited or deleted: written only by accept_terms(), kept as evidence of
-- what each member agreed to and when. Profiles are anonymised, never deleted.
create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id),
  terms_version text not null references public.terms_versions (version),
  confirmed_adult boolean not null check (confirmed_adult),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version)
);

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from public, anon, authenticated;
grant select on public.terms_acceptances to authenticated;

create policy terms_acceptances_read_own on public.terms_acceptances
  for select to authenticated
  using (user_id = private.current_user_id());

-- Returns 'accepted' or 'already_accepted'. Refusals are errors:
--   terms_auth_required    no signed-in member with a profile
--   terms_version_stale    not the current version
--   terms_adult_required   the member did not confirm they are 18 or older
create function public.accept_terms(target_version text, confirmed_adult boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  inserted uuid;
begin
  if actor_id is null or not exists (select 1 from public.profiles p where p.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'terms_auth_required';
  end if;
  if target_version is distinct from (
    select v.version from public.terms_versions v order by v.effective_at desc limit 1
  ) then
    raise exception using errcode = '22023', message = 'terms_version_stale';
  end if;
  if confirmed_adult is not true then
    raise exception using errcode = '22023', message = 'terms_adult_required';
  end if;

  insert into public.terms_acceptances (user_id, terms_version, confirmed_adult)
  values (actor_id, target_version, true)
  on conflict (user_id, terms_version) do nothing
  returning id into inserted;

  return case when inserted is null then 'already_accepted' else 'accepted' end;
end;
$$;
revoke all on function public.accept_terms(text, boolean) from public, anon;
grant execute on function public.accept_terms(text, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. The account read names the latest version the member accepted
-- ---------------------------------------------------------------------------

create or replace function public.current_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'public_id', p.public_id,
    'email', i.email,
    'email_verified_at', i.email_verified_at,
    'created_at', p.created_at,
    'display_name', p.display_name,
    'avatar_object_key', p.avatar_object_key,
    'avatar_preset', p.avatar_preset,
    'external_avatar_url', p.external_avatar_url,
    'membership', (
      select jsonb_build_object(
        'institution_id', m.institution_id,
        'verification_state', m.verification_state,
        'institution_name', inst.name
      )
      from public.institution_memberships m
      left join public.institutions inst on inst.id = m.institution_id
      where m.user_id = p.user_id
      order by (m.verification_state = 'verified') desc, m.updated_at desc
      limit 1
    ),
    'restriction', (
      select jsonb_build_object('id', r.id, 'expires_at', r.expires_at)
      from public.account_restrictions r
      where r.user_id = p.user_id
        and r.lifted_at is null
      limit 1
    ),
    'latest_request', (
      select jsonb_build_object(
        'id', q.id,
        'state', q.state,
        'created_at', q.created_at,
        'reviewed_at', q.reviewed_at,
        'decision_reason_code', q.decision_reason_code,
        'evidence_delete_after', q.evidence_delete_after
      )
      from public.institution_verification_requests q
      where q.user_id = p.user_id
      order by q.created_at desc
      limit 1
    ),
    'has_console_access', (
      exists (select 1 from public.platform_role_assignments a where a.user_id = p.user_id)
      or exists (
        select 1
        from public.institution_role_assignments a
        where a.user_id = p.user_id
          and a.role = 'institution_sheriff'
      )
    ),
    'terms_accepted_version', (
      select t.terms_version
      from public.terms_acceptances t
      join public.terms_versions v on v.version = t.terms_version
      where t.user_id = p.user_id
      order by v.effective_at desc
      limit 1
    )
  )
  from public.profiles p
  left join private.user_identities i on i.user_id = p.user_id
  where p.user_id = private.current_user_id();
$$;
revoke all on function public.current_account() from public, anon;
grant execute on function public.current_account() to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Privacy requests
-- ---------------------------------------------------------------------------

-- Kept 7 years, like the other audit records; never deleted with the account.
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id),
  kind text not null check (kind in ('access', 'correction', 'deletion', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'answered')),
  answer text check (answer is null or char_length(answer) between 1 and 2000),
  answered_by uuid references public.profiles (user_id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'answered') = (answer is not null and answered_at is not null))
);
create index privacy_requests_open on public.privacy_requests (created_at) where status = 'open';
create index privacy_requests_user on public.privacy_requests (user_id, created_at desc);

alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from public, anon, authenticated;
grant select on public.privacy_requests to authenticated;

create policy privacy_requests_read_own on public.privacy_requests
  for select to authenticated
  using (user_id = private.current_user_id());

create policy privacy_requests_read_owner on public.privacy_requests
  for select to authenticated
  using (private.current_user_has_platform_role('owner'));

-- Returns the new request's id. Refusals are errors:
--   privacy_request_auth_required   no signed-in member with a profile
--   privacy_request_invalid         unknown kind, or details not 10 to 2000 characters
--   privacy_request_limit           3 requests already waiting for an answer
create function public.submit_privacy_request(target_kind text, target_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  cleaned text := trim(coalesce(target_details, ''));
  created uuid;
begin
  if actor_id is null or not exists (select 1 from public.profiles p where p.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'privacy_request_auth_required';
  end if;
  if target_kind is null
    or target_kind not in ('access', 'correction', 'deletion', 'other')
    or char_length(cleaned) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'privacy_request_invalid';
  end if;
  -- One member's queue at a time, so the check and the insert cannot race.
  perform pg_advisory_xact_lock(hashtextextended('privacy_request:' || actor_id::text, 0));
  if (
    select count(*) from public.privacy_requests r
    where r.user_id = actor_id and r.status = 'open'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'privacy_request_limit';
  end if;

  insert into public.privacy_requests (user_id, kind, details)
  values (actor_id, target_kind, cleaned)
  returning id into created;
  return created;
end;
$$;
revoke all on function public.submit_privacy_request(text, text) from public, anon;
grant execute on function public.submit_privacy_request(text, text) to authenticated;

-- The Owner's queue, with the member's public name so the answer can be checked
-- against their profile. No email: the answer is given inside VAULTIX.
create function public.list_privacy_requests(target_status text default 'open')
returns table (
  id uuid,
  kind text,
  details text,
  status text,
  answer text,
  created_at timestamptz,
  answered_at timestamptz,
  member_public_id uuid,
  member_display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'privacy_requests_owner_only';
  end if;
  return query
  select r.id, r.kind, r.details, r.status, r.answer, r.created_at, r.answered_at,
    p.public_id, p.display_name
  from public.privacy_requests r
  join public.profiles p on p.user_id = r.user_id
  where r.status = target_status
  order by case when r.status = 'open' then r.created_at end asc,
    r.answered_at desc
  limit 200;
end;
$$;
revoke all on function public.list_privacy_requests(text) from public, anon;
grant execute on function public.list_privacy_requests(text) to authenticated;

-- Refusals are errors:
--   privacy_requests_owner_only   not the Owner
--   privacy_request_invalid       answer not 1 to 2000 characters
--   privacy_request_not_open      no such request, or already answered
create function public.answer_privacy_request(target_request_id uuid, target_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  cleaned text := trim(coalesce(target_answer, ''));
begin
  if not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'privacy_requests_owner_only';
  end if;
  if char_length(cleaned) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'privacy_request_invalid';
  end if;
  update public.privacy_requests
  set status = 'answered', answer = cleaned, answered_by = actor_id, answered_at = now()
  where id = target_request_id and status = 'open';
  if not found then
    raise exception using errcode = 'P0002', message = 'privacy_request_not_open';
  end if;
end;
$$;
revoke all on function public.answer_privacy_request(uuid, text) from public, anon;
grant execute on function public.answer_privacy_request(uuid, text) to authenticated;
