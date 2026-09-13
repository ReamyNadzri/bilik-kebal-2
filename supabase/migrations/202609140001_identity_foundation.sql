create type public.institution_verification_state as enum (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

create type public.institution_verification_method as enum ('domain', 'manual');
create type public.verification_request_state as enum ('pending', 'approved', 'rejected');
create type public.platform_role as enum ('owner', 'platform_sheriff');
create type public.institution_role as enum ('institution_sheriff');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This is the minimal taxonomy anchor required by identity. The taxonomy module
-- owns later institution metadata and hierarchy extensions.
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_memberships (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete restrict,
  verification_state public.institution_verification_state not null default 'unverified',
  verification_method public.institution_verification_method,
  verified_at timestamptz,
  verified_by uuid references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, institution_id),
  check (
    (
      verification_state = 'verified'
      and verification_method is not null
      and verified_at is not null
    )
    or (
      verification_state <> 'verified'
      and verified_at is null
      and verified_by is null
    )
  )
);

create table public.institution_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete restrict,
  state public.verification_request_state not null default 'pending',
  evidence_object_path text not null check (
    char_length(evidence_object_path) between 3 and 512
    and evidence_object_path !~ '(^/|\.\.)'
  ),
  evidence_delete_after timestamptz not null,
  decision_reason_code text check (
    decision_reason_code is null
    or decision_reason_code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  reviewed_by uuid references public.profiles (user_id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_delete_after > created_at),
  check (
    (
      state = 'pending'
      and reviewed_by is null
      and reviewed_at is null
      and decision_reason_code is null
    )
    or (
      state in ('approved', 'rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and decision_reason_code is not null
    )
  )
);

create unique index institution_verification_requests_one_pending_per_user
on public.institution_verification_requests (user_id)
where state = 'pending';

create index institution_verification_requests_review_queue
on public.institution_verification_requests (institution_id, state, created_at);

create table public.platform_role_assignments (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.platform_role not null,
  assigned_by uuid references public.profiles (user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.institution_role_assignments (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  role public.institution_role not null,
  assigned_by uuid references public.profiles (user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (user_id, institution_id, role)
);

create index institution_role_assignments_scope
on public.institution_role_assignments (institution_id, role, user_id);

create table public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  reason_code text not null check (reason_code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  restricted_by uuid not null references public.profiles (user_id) on delete restrict,
  restricted_at timestamptz not null default now(),
  lifted_by uuid references public.profiles (user_id) on delete restrict,
  lifted_at timestamptz,
  check (
    (lifted_by is null and lifted_at is null)
    or (
      lifted_by is not null
      and lifted_at is not null
      and lifted_at >= restricted_at
    )
  )
);

create unique index account_restrictions_one_active_per_user
on public.account_restrictions (user_id)
where lifted_at is null;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.current_user_is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  );
$$;

create function private.current_user_has_platform_role(required_role public.platform_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_role_assignments
    where user_id = auth.uid()
      and role = required_role
  );
$$;

create function private.current_user_is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff');
$$;

create function private.current_user_is_institution_sheriff(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_role_assignments
    where user_id = auth.uid()
      and institution_id = target_institution_id
      and role = 'institution_sheriff'
  );
$$;

revoke all on function private.current_user_is_email_verified() from public;
revoke all on function private.current_user_has_platform_role(public.platform_role) from public;
revoke all on function private.current_user_is_platform_staff() from public;
revoke all on function private.current_user_is_institution_sheriff(uuid) from public;

grant execute on function private.current_user_is_email_verified() to anon, authenticated;
grant execute on function private.current_user_has_platform_role(public.platform_role) to authenticated;
grant execute on function private.current_user_is_platform_staff() to authenticated;
grant execute on function private.current_user_is_institution_sheriff(uuid) to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(
      coalesce(requested_display_name, nullif(split_part(new.email, '@', 1), ''), 'VAULTIX member'),
      100
    )
  );

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger institutions_set_updated_at
before update on public.institutions
for each row execute function private.set_updated_at();

create trigger institution_memberships_set_updated_at
before update on public.institution_memberships
for each row execute function private.set_updated_at();

create trigger institution_verification_requests_set_updated_at
before update on public.institution_verification_requests
for each row execute function private.set_updated_at();

create trigger auth_user_created_create_profile
after insert on auth.users
for each row execute function private.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.institution_verification_requests enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.institution_role_assignments enable row level security;
alter table public.account_restrictions enable row level security;

create policy profiles_read
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
  or exists (
    select 1
    from public.institution_memberships membership
    where membership.user_id = profiles.user_id
      and private.current_user_is_institution_sheriff(membership.institution_id)
  )
);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy institutions_browse_after_email_verification
on public.institutions for select
to authenticated
using (active and private.current_user_is_email_verified());

create policy institution_memberships_read
on public.institution_memberships for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
  or private.current_user_is_institution_sheriff(institution_id)
);

create policy institution_verification_requests_read
on public.institution_verification_requests for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
  or private.current_user_is_institution_sheriff(institution_id)
);

create policy institution_verification_requests_insert_own
on public.institution_verification_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and state = 'pending'
  and private.current_user_is_email_verified()
  and split_part(evidence_object_path, '/', 1) = auth.uid()::text
);

create policy platform_role_assignments_read
on public.platform_role_assignments for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_has_platform_role('owner')
);

create policy institution_role_assignments_read
on public.institution_role_assignments for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
  or private.current_user_is_institution_sheriff(institution_id)
);

create policy account_restrictions_read
on public.account_restrictions for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
);

grant usage on type public.institution_verification_state to anon, authenticated;
grant usage on type public.institution_verification_method to anon, authenticated;
grant usage on type public.verification_request_state to anon, authenticated;
grant usage on type public.platform_role to anon, authenticated;
grant usage on type public.institution_role to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert (user_id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.institutions to anon, authenticated;
grant select on public.institution_memberships to anon, authenticated;
grant select on public.institution_verification_requests to anon, authenticated;
grant insert (
  user_id,
  institution_id,
  evidence_object_path,
  evidence_delete_after
) on public.institution_verification_requests to authenticated;
grant select on public.platform_role_assignments to anon, authenticated;
grant select on public.institution_role_assignments to anon, authenticated;
grant select on public.account_restrictions to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-evidence',
  'identity-evidence',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy identity_evidence_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'identity-evidence'
  and private.current_user_is_email_verified()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy identity_evidence_read_own_or_authorised_reviewer
on storage.objects for select
to authenticated
using (
  bucket_id = 'identity-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.institution_verification_requests request
      where request.evidence_object_path = name
        and (
          private.current_user_is_platform_staff()
          or private.current_user_is_institution_sheriff(request.institution_id)
        )
    )
  )
);

create policy identity_evidence_delete_own_pending
on storage.objects for delete
to authenticated
using (
  bucket_id = 'identity-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1
    from public.institution_verification_requests request
    where request.evidence_object_path = name
      and request.state <> 'pending'
  )
);
