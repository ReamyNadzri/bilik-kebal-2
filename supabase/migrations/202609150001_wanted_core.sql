create type public.wanted_status as enum (
  'draft',
  'awaiting_payment',
  'open',
  'reviewing',
  'expired'
);

create type public.wanted_access_basis as enum ('contributors_only');

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, slug),
  unique (id, institution_id)
);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, slug),
  unique (id, institution_id)
);

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  faculty_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (faculty_id, institution_id) references public.faculties (id, institution_id) on delete cascade,
  unique (institution_id, slug),
  unique (id, institution_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  programme_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (programme_id, institution_id) references public.programmes (id, institution_id) on delete cascade,
  unique (institution_id, slug),
  unique (institution_id, code),
  unique (id, institution_id)
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, slug),
  unique (id, institution_id)
);

create table public.resource_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wanted_requests (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  commissioner_user_id uuid not null references public.profiles (user_id) on delete restrict,
  institution_id uuid not null references public.institutions (id) on delete restrict,
  campus_id uuid not null,
  faculty_id uuid not null,
  programme_id uuid not null,
  course_id uuid not null,
  academic_session_id uuid not null,
  resource_type_id uuid not null references public.resource_types (id) on delete restrict,
  language_id uuid not null references public.languages (id) on delete restrict,
  title text not null check (char_length(title) between 8 and 120 and title = trim(title)),
  description text not null check (char_length(description) between 20 and 2000 and description = trim(description)),
  requested_duration_days smallint not null check (requested_duration_days in (7, 14, 30)),
  status public.wanted_status not null default 'draft',
  duration_days_snapshot smallint check (duration_days_snapshot in (7, 14, 30)),
  fee_rate_basis_points_snapshot integer check (fee_rate_basis_points_snapshot between 0 and 10000),
  policy_version_snapshot text check (
    policy_version_snapshot is null
    or policy_version_snapshot ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:\.[0-9]+)?$'
  ),
  access_basis_snapshot public.wanted_access_basis,
  policy_accepted_at timestamptz not null,
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campus_id, institution_id) references public.campuses (id, institution_id) on delete restrict,
  foreign key (faculty_id, institution_id) references public.faculties (id, institution_id) on delete restrict,
  foreign key (programme_id, institution_id) references public.programmes (id, institution_id) on delete restrict,
  foreign key (course_id, institution_id) references public.courses (id, institution_id) on delete restrict,
  foreign key (academic_session_id, institution_id) references public.academic_sessions (id, institution_id) on delete restrict,
  check (
    (
      status = 'draft'
      and duration_days_snapshot is null
      and fee_rate_basis_points_snapshot is null
      and policy_version_snapshot is null
      and access_basis_snapshot is null
      and published_at is null
      and closes_at is null
    )
    or (
      status = 'awaiting_payment'
      and duration_days_snapshot is not null
      and fee_rate_basis_points_snapshot is not null
      and policy_version_snapshot is not null
      and access_basis_snapshot is not null
      and published_at is null
      and closes_at is null
    )
    or (
      status in ('open', 'reviewing', 'expired')
      and duration_days_snapshot is not null
      and fee_rate_basis_points_snapshot is not null
      and policy_version_snapshot is not null
      and access_basis_snapshot is not null
      and published_at is not null
      and closes_at > published_at
    )
  )
);

create index wanted_requests_public_board on public.wanted_requests (status, published_at desc);
create index wanted_requests_duplicate_lookup on public.wanted_requests (institution_id, course_id, resource_type_id, academic_session_id);

create table public.wanted_request_tags (
  wanted_request_id uuid not null references public.wanted_requests (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  primary key (wanted_request_id, tag_id)
);

create table public.wanted_duplicate_checks (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete cascade,
  token_hash bytea not null unique,
  criteria_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create table public.wanted_public_events (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  summary text not null check (char_length(summary) between 1 and 240),
  occurred_at timestamptz not null default now()
);

create function private.current_user_can_transact_at(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_user_is_email_verified()
    and exists (
      select 1
      from public.institution_memberships
      where user_id = auth.uid()
        and institution_id = target_institution_id
        and verification_state = 'verified'
    )
    and not exists (
      select 1
      from public.account_restrictions
      where user_id = auth.uid()
        and lifted_at is null
    );
$$;

revoke all on function private.current_user_can_transact_at(uuid) from public;
grant execute on function private.current_user_can_transact_at(uuid) to authenticated;

create trigger campuses_set_updated_at before update on public.campuses
for each row execute function private.set_updated_at();
create trigger faculties_set_updated_at before update on public.faculties
for each row execute function private.set_updated_at();
create trigger programmes_set_updated_at before update on public.programmes
for each row execute function private.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
for each row execute function private.set_updated_at();
create trigger academic_sessions_set_updated_at before update on public.academic_sessions
for each row execute function private.set_updated_at();
create trigger resource_types_set_updated_at before update on public.resource_types
for each row execute function private.set_updated_at();
create trigger languages_set_updated_at before update on public.languages
for each row execute function private.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function private.set_updated_at();
create trigger wanted_requests_set_updated_at before update on public.wanted_requests
for each row execute function private.set_updated_at();

alter table public.campuses enable row level security;
alter table public.faculties enable row level security;
alter table public.programmes enable row level security;
alter table public.courses enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.resource_types enable row level security;
alter table public.languages enable row level security;
alter table public.tags enable row level security;
alter table public.wanted_requests enable row level security;
alter table public.wanted_request_tags enable row level security;
alter table public.wanted_duplicate_checks enable row level security;
alter table public.wanted_public_events enable row level security;

create policy campuses_browse on public.campuses for select to authenticated
using (active and private.current_user_is_email_verified());
create policy faculties_browse on public.faculties for select to authenticated
using (active and private.current_user_is_email_verified());
create policy programmes_browse on public.programmes for select to authenticated
using (active and private.current_user_is_email_verified());
create policy courses_browse on public.courses for select to authenticated
using (active and private.current_user_is_email_verified());
create policy academic_sessions_browse on public.academic_sessions for select to authenticated
using (active and private.current_user_is_email_verified());
create policy resource_types_browse on public.resource_types for select to authenticated
using (active and private.current_user_is_email_verified());
create policy languages_browse on public.languages for select to authenticated
using (active and private.current_user_is_email_verified());
create policy tags_browse on public.tags for select to authenticated
using (active and private.current_user_is_email_verified());

create policy wanted_requests_read on public.wanted_requests for select to authenticated
using (
  commissioner_user_id = auth.uid()
  or (
    status in ('open', 'reviewing', 'expired')
    and private.current_user_is_email_verified()
  )
);

create policy wanted_requests_insert_own_draft on public.wanted_requests for insert to authenticated
with check (
  commissioner_user_id = auth.uid()
  and status = 'draft'
  and private.current_user_can_transact_at(institution_id)
);

create policy wanted_request_tags_read on public.wanted_request_tags for select to authenticated
using (
  exists (
    select 1 from public.wanted_requests
    where id = wanted_request_id
  )
);

create policy wanted_request_tags_insert_own_draft on public.wanted_request_tags for insert to authenticated
with check (
  exists (
    select 1 from public.wanted_requests
    where id = wanted_request_id
      and commissioner_user_id = auth.uid()
      and status = 'draft'
  )
);

create policy wanted_duplicate_checks_read_own on public.wanted_duplicate_checks for select to authenticated
using (
  exists (
    select 1 from public.wanted_requests
    where id = wanted_request_id
      and commissioner_user_id = auth.uid()
  )
);

create policy wanted_public_events_read on public.wanted_public_events for select to authenticated
using (
  exists (
    select 1 from public.wanted_requests
    where id = wanted_request_id
      and status in ('open', 'reviewing', 'expired')
      and private.current_user_is_email_verified()
  )
);

grant usage on type public.wanted_status to authenticated;
grant usage on type public.wanted_access_basis to authenticated;

grant select on public.campuses to authenticated;
grant select on public.faculties to authenticated;
grant select on public.programmes to authenticated;
grant select on public.courses to authenticated;
grant select on public.academic_sessions to authenticated;
grant select on public.resource_types to authenticated;
grant select on public.languages to authenticated;
grant select on public.tags to authenticated;
grant select on public.wanted_requests to authenticated;
grant insert (
  id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id,
  academic_session_id, resource_type_id, language_id, title, description,
  requested_duration_days, policy_accepted_at
) on public.wanted_requests to authenticated;
grant select, insert, delete on public.wanted_request_tags to authenticated;
grant select on public.wanted_duplicate_checks to authenticated;
grant select on public.wanted_public_events to authenticated;
