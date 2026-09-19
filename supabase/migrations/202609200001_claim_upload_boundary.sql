create type public.claim_status as enum (
  'uploading',
  'screening',
  'needs_information',
  'under_review',
  'approved',
  'not_selected',
  'rejected',
  'withdrawn'
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  hunter_user_id uuid not null references public.profiles (user_id) on delete restrict,
  institution_id uuid not null references public.institutions (id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 255 and file_name !~ '[\\/\\x00]'),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 bytea not null check (octet_length(sha256) = 32),
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'r2')),
  bucket text not null default 'quarantine' check (bucket = 'quarantine'),
  object_key text not null unique check (char_length(object_key) between 3 and 512 and object_key !~ '(^/|\.\.)'),
  status public.claim_status not null default 'uploading',
  rights_confirmed_at timestamptz not null,
  free_release_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index claims_one_exact_checksum_per_wanted
on public.claims (wanted_request_id, sha256)
where status <> 'withdrawn';

create index claims_review_queue on public.claims (institution_id, status, created_at);

create table public.claim_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete cascade,
  object_key text not null unique,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (completed_at is null or completed_at >= created_at)
);

create trigger claims_set_updated_at before update on public.claims
for each row execute function private.set_updated_at();

alter table public.claims enable row level security;
alter table public.claim_upload_sessions enable row level security;

create policy claims_read_own on public.claims for select to authenticated
using (hunter_user_id = auth.uid());

create policy claims_read_authorised_reviewers on public.claims for select to authenticated
using (
  private.current_user_is_platform_staff()
  or private.current_user_is_institution_sheriff(institution_id)
);

create policy claim_upload_sessions_read_own on public.claim_upload_sessions for select to authenticated
using (
  exists (
    select 1 from public.claims
    where claims.id = claim_id and claims.hunter_user_id = auth.uid()
  )
);

grant select on public.claims to authenticated;
grant select on public.claim_upload_sessions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('quarantine', 'quarantine', false, 52428800)
on conflict (id) do nothing;

-- No authenticated storage policy is intentional. Only the server-side upload gateway
-- may create short-lived signed upload URLs for this private quarantine bucket.
