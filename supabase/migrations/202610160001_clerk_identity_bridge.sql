-- Clerk identity bridge (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md, slice 1).
--
-- Supabase trusts Clerk session tokens as a third-party auth provider. A Clerk subject is a
-- `user_…` string, so auth.uid() (a uuid cast of `sub`) cannot identify the caller. Internal
-- user ids stay uuid; private.user_identities maps Clerk subjects to them and holds the email
-- facts that used to be read from auth.users. Email lives here, not on profiles, because
-- Institution Sheriffs can read profile rows.
--
-- Supabase Auth sessions keep working (uuid subjects) until the sign-in slices land; the
-- transitional branches below are removed with them.

create table private.user_identities (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  clerk_user_id text unique check (clerk_user_id ~ '^user_[A-Za-z0-9]+$'),
  email text check (email is null or char_length(email) <= 320),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.user_identities enable row level security;
revoke all on private.user_identities from public, anon, authenticated;

create trigger user_identities_set_updated_at
before update on private.user_identities
for each row execute function private.set_updated_at();

insert into private.user_identities (user_id, email, email_verified_at)
select p.user_id, u.email::text, u.email_confirmed_at
from public.profiles p
join auth.users u on u.id = p.user_id;

-- Transitional: keeps email facts current for Supabase Auth accounts. Runs inside Supabase
-- Auth's transaction, so it must never raise. Same-event triggers fire in name order, so
-- auth_user_created_create_profile has made the profile before this runs.
create function private.sync_identity_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into private.user_identities (user_id, email, email_verified_at)
    select new.id, new.email::text, new.email_confirmed_at
    where exists (select 1 from public.profiles where user_id = new.id)
    on conflict (user_id) do update
    set email = excluded.email,
        email_verified_at = excluded.email_verified_at;
  exception when others then
    null; -- A missed sync must not block sign-up or verification.
  end;
  return new;
end;
$$;
revoke all on function private.sync_identity_from_auth_user() from public, anon, authenticated;

create trigger auth_user_sync_identity
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.sync_identity_from_auth_user();

-- The caller's internal user id, or null. Clerk subjects resolve through the mapping; an
-- unprovisioned Clerk user is nobody. Clerk never issues uuid subjects, so the transitional
-- Supabase Auth branch cannot be reached with a Clerk token.
create function private.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject text := auth.jwt() ->> 'sub';
begin
  if subject is null or subject = '' then
    return null;
  end if;

  if subject like 'user\_%' then
    return (
      select identity.user_id
      from private.user_identities identity
      where identity.clerk_user_id = subject
    );
  end if;

  if subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return subject::uuid;
  end if;

  return null;
end;
$$;
revoke all on function private.current_user_id() from public;
grant execute on function private.current_user_id() to anon, authenticated, service_role;

-- Rewrite every auth.uid() in functions and policies from their live definitions, so the
-- latest version of each is the one changed. CREATE OR REPLACE and ALTER POLICY keep owners,
-- grants and policy roles. An empty search_path makes the deparsed text fully qualified.
do $$
declare
  target record;
  new_using text;
  new_check text;
begin
  perform set_config('search_path', '', true);

  for target in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind in ('f', 'p')
      and p.prosrc like '%auth.uid()%'
  loop
    execute replace(pg_get_functiondef(target.oid), 'auth.uid()', 'private.current_user_id()');
  end loop;

  for target in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
  loop
    new_using := replace(target.qual, 'auth.uid()', 'private.current_user_id()');
    new_check := replace(target.with_check, 'auth.uid()', 'private.current_user_id()');
    execute format('alter policy %I on %I.%I', target.policyname, target.schemaname, target.tablename)
      || case when new_using is not null then format(' using (%s)', new_using) else '' end
      || case when new_check is not null then format(' with check (%s)', new_check) else '' end;
  end loop;
end;
$$;

-- Functions that read auth.users directly. Clerk accounts never appear there.

create or replace function private.current_user_is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_identities
    where user_id = private.current_user_id()
      and email_verified_at is not null
  );
$$;

-- The 15-minute step-up window. Clerk's `fva` claim holds whole minutes since the first
-- factor was last verified (-1 when never), so 0–14 is inside the window.
create or replace function private.current_user_recently_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (auth.jwt() ->> 'sub') like 'user\_%' then coalesce(
      case
        when jsonb_typeof(auth.jwt() -> 'fva' -> 0) = 'number'
          then (auth.jwt() -> 'fva' ->> 0)::integer between 0 and 14
      end,
      false
    )
    else exists (
      select 1
      from auth.users
      where id = private.current_user_id()
        and last_sign_in_at >= now() - interval '15 minutes'
    )
  end;
$$;

create or replace function public.verify_own_institution_by_domain()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  matched_institution_id uuid;
  membership_change_count integer := 0;
begin
  select lower(email)
  into current_email
  from private.user_identities
  where user_id = private.current_user_id()
    and email_verified_at is not null;

  if current_email is null then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;

  select institution_id
  into matched_institution_id
  from public.institution_email_domains
  where domain = split_part(current_email, '@', 2)
    and active;

  if matched_institution_id is null then
    raise exception using errcode = 'P0001', message = 'EMAIL_DOMAIN_NOT_APPROVED';
  end if;

  insert into public.institution_memberships (
    user_id,
    institution_id,
    verification_state,
    verification_method,
    verified_at
  )
  values (
    private.current_user_id(),
    matched_institution_id,
    'verified',
    'domain',
    now()
  )
  on conflict (user_id, institution_id) do update
  set
    verification_state = 'verified',
    verification_method = 'domain',
    verified_at = excluded.verified_at,
    verified_by = null
  where
    institution_memberships.verification_state <> 'verified'
    or institution_memberships.verification_method is distinct from 'domain';

  get diagnostics membership_change_count = row_count;

  if membership_change_count > 0 then
    insert into public.identity_audit_events (
      event_type,
      actor_user_id,
      subject_user_id,
      institution_id,
      details
    )
    values (
      'institution_verification.domain_verified',
      private.current_user_id(),
      private.current_user_id(),
      matched_institution_id,
      jsonb_build_object('method', 'domain')
    );
  end if;

  return matched_institution_id;
end;
$$;

-- A recipient without an identity row gets a null address, the same outcome as an
-- unverified email, instead of leaving a leased row out of the batch.
create or replace function public.claim_notification_email_batch(batch_size integer default 20)
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
         case when ui.email_verified_at is not null then ui.email else null end,
         n.kind, l.attempt_count, l.idempotency_expires_at, l.correlation_id,
         private.notification_email_context(n.kind, n.subject_id)
  from leased l
  join public.notifications n on n.id = l.notification_id
  left join private.user_identities ui on ui.user_id = n.recipient_user_id;
end;
$$;

create or replace function public.console_search_members(search text default null, max_rows integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  role_ text := private.current_user_console_role();
  staff boolean;
  term text := nullif(trim(coalesce(search, '')), '');
begin
  if role_ is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  staff := role_ in ('owner', 'platform_sheriff');
  return coalesce((
    select jsonb_agg(row_ order by (row_->>'joinedAt') desc)
    from (
      select jsonb_build_object(
        'publicId', p.public_id,
        'displayName', p.display_name,
        'email', case when staff then u.email end,
        'joinedAt', p.created_at,
        'emailVerified', u.email_verified_at is not null,
        'institution', (
          select jsonb_build_object('id', i.id, 'name', i.name, 'state', m.verification_state)
          from public.institution_memberships m
          join public.institutions i on i.id = m.institution_id
          where m.user_id = p.user_id
          order by m.updated_at desc
          limit 1
        ),
        'roles', coalesce((
          select jsonb_agg(r.role::text) from public.platform_role_assignments r where r.user_id = p.user_id
        ), '[]'::jsonb) || coalesce((
          select jsonb_agg('institution_sheriff:' || r.institution_id::text)
          from public.institution_role_assignments r where r.user_id = p.user_id
        ), '[]'::jsonb),
        'restriction', (
          select jsonb_build_object(
            'reasonCode', a.reason_code,
            'restrictedAt', a.restricted_at,
            'expiresAt', a.expires_at
          )
          from public.account_restrictions a
          where a.user_id = p.user_id and a.lifted_at is null
          limit 1
        ),
        'badge', (
          select jsonb_build_object('id', b.id, 'name', b.name)
          from public.badge_awards w join public.badges b on b.id = w.badge_id
          where w.user_id = p.user_id and w.revoked_at is null
          limit 1
        )
      ) as row_
      from public.profiles p
      join private.user_identities u on u.user_id = p.user_id
      where (
          staff
          or exists (
            select 1 from public.institution_memberships m
            where m.user_id = p.user_id
              and private.current_user_is_institution_sheriff(m.institution_id)
          )
        )
        and (
          term is null
          or p.display_name ilike '%' || replace(replace(term, '%', '\%'), '_', '\_') || '%'
          or (staff and u.email ilike '%' || replace(replace(term, '%', '\%'), '_', '\_') || '%')
          or p.public_id::text = term
        )
      order by p.created_at desc
      limit least(greatest(coalesce(max_rows, 25), 1), 100)
    ) rows_
  ), '[]'::jsonb);
end;
$$;

-- Clerk-provisioned profiles have no auth.users row. Deleting a Supabase Auth account no
-- longer cascades; account deletion is an open question in the migration plan.
alter table public.profiles drop constraint profiles_user_id_fkey;
alter table public.profiles alter column user_id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosrc ~ 'auth\.uid\s*\('
  ) then
    raise exception 'auth.uid() remains in a public or private function';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\s*\('
  ) then
    raise exception 'auth.uid() remains in a policy';
  end if;
end;
$$;
