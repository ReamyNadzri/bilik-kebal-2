create type public.claim_screening_job_state as enum ('queued', 'processing', 'completed', 'failed');

create table public.claim_screening_jobs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete restrict,
  bucket text not null check (bucket = 'quarantine'),
  object_key text not null,
  sha256 bytea not null check (octet_length(sha256) = 32),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 52428800),
  state public.claim_screening_job_state not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index claim_screening_jobs_queue on public.claim_screening_jobs (state, available_at, created_at);

create table public.claim_screening_results (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete restrict,
  scanner_name text not null check (char_length(scanner_name) between 1 and 100),
  scanner_version text not null check (char_length(scanner_version) between 1 and 100),
  status text not null check (status in ('clean', 'blocked', 'needs_review', 'error')),
  reason_codes text[] not null default '{}',
  result_hash bytea not null check (octet_length(result_hash) = 32),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (claim_id, scanner_name, scanner_version, result_hash)
);

alter table public.claim_screening_jobs enable row level security;
alter table public.claim_screening_results enable row level security;

revoke all on public.claim_screening_jobs from anon, authenticated;
revoke all on public.claim_screening_results from anon, authenticated;
