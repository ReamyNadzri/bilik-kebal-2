-- Migration: 202609250001_fulfilment_entitlements_and_payouts.sql
-- Description: Fulfilment, contributor entitlements, private approved bucket, payout & refund tasks, and compensating ledger entries.

-- 1. Extend wanted_status enum
alter type public.wanted_status add value if not exists 'fulfilled';
alter type public.wanted_status add value if not exists 'closed';

-- 2. Allow approved bucket on claims
alter table public.claims drop constraint if exists claims_bucket_check;
alter table public.claims add constraint claims_bucket_check check (bucket in ('quarantine', 'approved'));

-- 3. Create approved private storage bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('approved', 'approved', false, 52428800)
on conflict (id) do nothing;

-- 4. Extend ledger_transactions for payouts & refunds
alter table public.ledger_transactions drop constraint if exists ledger_transactions_kind_check;
alter table public.ledger_transactions add constraint ledger_transactions_kind_check
  check (kind in ('contribution', 'refund', 'chargeback', 'correction', 'payout'));

alter table public.ledger_transactions drop constraint if exists ledger_transactions_contribution_id_key;
create unique index if not exists ledger_transactions_contribution_uniq
  on public.ledger_transactions (contribution_id)
  where (kind = 'contribution');

alter table public.ledger_transactions
  add column if not exists payout_task_id uuid,
  add column if not exists refund_task_id uuid;

-- 5. Create Payout & Refund Task Status Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_task_status') then
    create type public.payout_task_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'refund_task_status') then
    create type public.refund_task_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;
end $$;

-- 6. Entitlements Table (One Entitlement Per Contributor)
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  claim_id uuid not null references public.claims (id) on delete restrict,
  user_id uuid not null references public.profiles (user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  is_revoked boolean not null default false,
  revoked_at timestamptz,
  revocation_reason text,
  unique (wanted_request_id, user_id)
);

create index if not exists entitlements_user on public.entitlements (user_id);
create index if not exists entitlements_wanted on public.entitlements (wanted_request_id);

-- 7. Payout Tasks Table
create table if not exists public.payout_tasks (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null unique references public.wanted_requests (id) on delete restrict,
  claim_id uuid not null references public.claims (id) on delete restrict,
  hunter_user_id uuid not null references public.profiles (user_id) on delete restrict,
  gross_bounty_sen bigint not null check (gross_bounty_sen > 0),
  fee_rate_basis_points integer not null check (fee_rate_basis_points between 0 and 10000),
  platform_fee_sen bigint not null check (platform_fee_sen >= 0),
  net_payout_sen bigint not null check (net_payout_sen > 0),
  status public.payout_task_status not null default 'pending',
  external_reference text,
  payout_method text,
  evidence_notes text check (evidence_notes is null or char_length(evidence_notes) <= 2000),
  completed_at timestamptz,
  owner_user_id uuid references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_tasks_status on public.payout_tasks (status, created_at desc);
create index if not exists payout_tasks_hunter on public.payout_tasks (hunter_user_id);

-- 8. Refund Tasks Table
create table if not exists public.refund_tasks (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  contribution_id uuid not null unique references public.contributions (id) on delete restrict,
  contributor_user_id uuid not null references public.profiles (user_id) on delete restrict,
  amount_sen bigint not null check (amount_sen > 0),
  status public.refund_task_status not null default 'pending',
  external_reference text,
  refund_method text,
  evidence_notes text check (evidence_notes is null or char_length(evidence_notes) <= 2000),
  completed_at timestamptz,
  owner_user_id uuid references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists refund_tasks_status on public.refund_tasks (status, created_at desc);
create index if not exists refund_tasks_contributor on public.refund_tasks (contributor_user_id);
create index if not exists refund_tasks_wanted on public.refund_tasks (wanted_request_id);

alter table public.ledger_transactions drop constraint if exists ledger_transactions_payout_task_fk;
alter table public.ledger_transactions
  add constraint ledger_transactions_payout_task_fk
  foreign key (payout_task_id) references public.payout_tasks (id) on delete restrict;

alter table public.ledger_transactions drop constraint if exists ledger_transactions_refund_task_fk;
alter table public.ledger_transactions
  add constraint ledger_transactions_refund_task_fk
  foreign key (refund_task_id) references public.refund_tasks (id) on delete restrict;

-- 9. Enable RLS
alter table public.entitlements enable row level security;
alter table public.payout_tasks enable row level security;
alter table public.refund_tasks enable row level security;

-- Entitlements RLS
create policy entitlements_read_own on public.entitlements for select to authenticated
using (user_id = auth.uid());

create policy entitlements_read_authorised_staff on public.entitlements for select to authenticated
using (
  private.current_user_has_platform_role('owner')
  or private.current_user_has_platform_role('platform_sheriff')
  or exists (
    select 1 from public.claims c
    where c.id = claim_id and private.current_user_is_institution_sheriff(c.institution_id)
  )
);

-- Payout Tasks RLS
create policy payout_tasks_read_own on public.payout_tasks for select to authenticated
using (hunter_user_id = auth.uid());

create policy payout_tasks_read_staff on public.payout_tasks for select to authenticated
using (
  private.current_user_has_platform_role('owner')
  or private.current_user_has_platform_role('platform_sheriff')
);

-- Refund Tasks RLS
create policy refund_tasks_read_own on public.refund_tasks for select to authenticated
using (contributor_user_id = auth.uid());

create policy refund_tasks_read_staff on public.refund_tasks for select to authenticated
using (
  private.current_user_has_platform_role('owner')
  or private.current_user_has_platform_role('platform_sheriff')
);

-- 10. Atomic PostgreSQL Functions

-- 10.1 Winning Claim Approval & Fulfilment
create or replace function public.approve_winning_claim_and_fulfill(
  target_claim_id uuid,
  target_reason_code text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_claim public.claims%rowtype;
  v_wanted public.wanted_requests%rowtype;
  v_payout_id uuid;
  v_gross_sen bigint;
  v_fee_bps integer;
  v_fee_sen bigint;
  v_net_sen bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_claim
  from public.claims
  where id = target_claim_id and status in ('screening', 'needs_information', 'under_review');

  if not found then
    raise exception 'claim is not in reviewable state' using errcode = 'P0001';
  end if;

  if v_claim.is_restricted then
    raise exception 'restricted claim cannot be approved' using errcode = '42501';
  end if;

  if v_claim.hunter_user_id = actor_id then
    raise exception 'claim owner cannot review own claim' using errcode = '42501';
  end if;

  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(v_claim.institution_id)
  ) then
    raise exception 'reviewer not authorized' using errcode = '42501';
  end if;

  select * into v_wanted
  from public.wanted_requests
  where id = v_claim.wanted_request_id;

  if not found then
    raise exception 'wanted request not found' using errcode = 'P0002';
  end if;

  -- 1. Set other competing claims to not_selected
  update public.claims
  set status = 'not_selected',
      updated_at = now()
  where wanted_request_id = v_claim.wanted_request_id
    and id <> target_claim_id
    and status in ('screening', 'needs_information', 'under_review');

  -- 2. Approve winning claim and promote bucket to approved
  update public.claims
  set status = 'approved',
      bucket = 'approved',
      updated_at = now()
  where id = target_claim_id;

  -- 3. Record review
  insert into public.claim_reviews (claim_id, reviewer_user_id, decision, reason_code, notes)
  values (target_claim_id, actor_id, 'approve', target_reason_code, target_notes);

  -- 4. Mark wanted request as fulfilled
  update public.wanted_requests
  set status = 'fulfilled',
      updated_at = now()
  where id = v_claim.wanted_request_id;

  -- 5. Generate exactly one entitlement per contributor
  insert into public.entitlements (wanted_request_id, claim_id, user_id)
  select distinct c.wanted_request_id, target_claim_id, c.contributor_user_id
  from public.contributions c
  where c.wanted_request_id = v_claim.wanted_request_id
  on conflict (wanted_request_id, user_id) do nothing;

  -- 6. Calculate integer sen bounty & platform fee snapshot
  select coalesce(sum(amount_sen), 0) into v_gross_sen
  from public.contributions
  where wanted_request_id = v_claim.wanted_request_id;

  v_fee_bps := coalesce(v_wanted.fee_rate_basis_points_snapshot, 1000);
  v_fee_sen := (v_gross_sen * v_fee_bps) / 10000;
  v_net_sen := v_gross_sen - v_fee_sen;

  -- 7. Create single payout task for winning hunter
  insert into public.payout_tasks (
    wanted_request_id,
    claim_id,
    hunter_user_id,
    gross_bounty_sen,
    fee_rate_basis_points,
    platform_fee_sen,
    net_payout_sen,
    status
  )
  values (
    v_claim.wanted_request_id,
    target_claim_id,
    v_claim.hunter_user_id,
    v_gross_sen,
    v_fee_bps,
    v_fee_sen,
    v_net_sen,
    'pending'
  )
  on conflict (wanted_request_id) do update
  set updated_at = now()
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

-- 10.2 Record Owner Payout Completion with Balanced Compensating Ledger
create or replace function public.record_owner_payout_completion(
  target_payout_task_id uuid,
  target_external_ref text,
  target_method text,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_payout public.payout_tasks%rowtype;
  v_tx_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.current_user_has_platform_role('owner') then
    raise exception 'only platform owner may record payout completion' using errcode = '42501';
  end if;

  select * into v_payout
  from public.payout_tasks
  where id = target_payout_task_id and status = 'pending';

  if not found then
    raise exception 'pending payout task not found' using errcode = 'P0002';
  end if;

  -- Update payout task
  update public.payout_tasks
  set status = 'completed',
      external_reference = target_external_ref,
      payout_method = target_method,
      evidence_notes = target_notes,
      owner_user_id = actor_id,
      completed_at = now(),
      updated_at = now()
  where id = target_payout_task_id;

  -- Create compensating ledger transaction
  insert into public.ledger_transactions (kind, payout_task_id)
  values ('payout', target_payout_task_id)
  returning id into v_tx_id;

  -- Balanced double-entry entries:
  -- Debit wanted escrow (clear liability)
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'wanted_escrow', v_payout.gross_bounty_sen::integer, 0);

  -- Credit net payout disbursement
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'payout_disbursement', 0, v_payout.net_payout_sen::integer);

  -- Credit platform fee revenue
  if v_payout.platform_fee_sen > 0 then
    insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
    values (v_tx_id, 'platform_fee_revenue', 0, v_payout.platform_fee_sen::integer);
  end if;

  if (select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0) from public.ledger_entries where ledger_entries.transaction_id = v_tx_id) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;
end;
$$;

-- 10.3 Bounty Expiry & Refund Tasks Creation
create or replace function public.expire_wanted_and_generate_refunds(
  target_wanted_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wanted public.wanted_requests%rowtype;
  v_refunds_created integer := 0;
begin
  select * into v_wanted
  from public.wanted_requests
  where id = target_wanted_id;

  if not found then
    raise exception 'wanted request not found' using errcode = 'P0002';
  end if;

  if v_wanted.status not in ('open', 'reviewing') then
    return 0;
  end if;

  -- If paused by appeal, cannot expire
  if v_wanted.is_paused then
    raise exception 'bounty is paused by active appeal' using errcode = 'P0001';
  end if;

  if v_wanted.closes_at > now() then
    raise exception 'bounty duration has not elapsed' using errcode = 'P0001';
  end if;

  -- Mark expired
  update public.wanted_requests
  set status = 'expired',
      updated_at = now()
  where id = target_wanted_id;

  -- Generate one refund task per successful contribution
  insert into public.refund_tasks (
    wanted_request_id,
    contribution_id,
    contributor_user_id,
    amount_sen,
    status
  )
  select
    c.wanted_request_id,
    c.id,
    c.contributor_user_id,
    c.amount_sen,
    'pending'
  from public.contributions c
  where c.wanted_request_id = target_wanted_id
  on conflict (contribution_id) do nothing;

  get diagnostics v_refunds_created = row_count;
  return v_refunds_created;
end;
$$;

-- 10.4 Record Owner Refund Completion with Compensating Ledger
create or replace function public.record_owner_refund_completion(
  target_refund_task_id uuid,
  target_external_ref text,
  target_method text,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_refund public.refund_tasks%rowtype;
  v_tx_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not private.current_user_has_platform_role('owner') then
    raise exception 'only platform owner may record refund completion' using errcode = '42501';
  end if;

  select * into v_refund
  from public.refund_tasks
  where id = target_refund_task_id and status = 'pending';

  if not found then
    raise exception 'pending refund task not found' using errcode = 'P0002';
  end if;

  -- Update refund task
  update public.refund_tasks
  set status = 'completed',
      external_reference = target_external_ref,
      refund_method = target_method,
      evidence_notes = target_notes,
      owner_user_id = actor_id,
      completed_at = now(),
      updated_at = now()
  where id = target_refund_task_id;

  -- Create compensating ledger transaction
  insert into public.ledger_transactions (kind, contribution_id, refund_task_id)
  values ('refund', v_refund.contribution_id, target_refund_task_id)
  returning id into v_tx_id;

  -- Balanced double-entry entries:
  -- Debit wanted escrow (clear liability)
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'wanted_escrow', v_refund.amount_sen::integer, 0);

  -- Credit refund disbursement
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'refund_disbursement', 0, v_refund.amount_sen::integer);

  if (select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0) from public.ledger_entries where ledger_entries.transaction_id = v_tx_id) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;
end;
$$;

-- 10.5 Revoke Entitlements
create or replace function public.revoke_entitlements_for_wanted(
  target_wanted_id uuid,
  target_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_revoked_count integer := 0;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
  ) then
    raise exception 'not authorized to revoke entitlements' using errcode = '42501';
  end if;

  update public.entitlements
  set is_revoked = true,
      revoked_at = now(),
      revocation_reason = target_reason
  where wanted_request_id = target_wanted_id
    and is_revoked = false;

  get diagnostics v_revoked_count = row_count;
  return v_revoked_count;
end;
$$;

-- 11. Grants
grant select on public.entitlements to authenticated;
grant select on public.payout_tasks to authenticated;
grant select on public.refund_tasks to authenticated;

revoke all on function public.approve_winning_claim_and_fulfill(uuid, text, text) from public;
grant execute on function public.approve_winning_claim_and_fulfill(uuid, text, text) to authenticated;

revoke all on function public.record_owner_payout_completion(uuid, text, text, text) from public;
grant execute on function public.record_owner_payout_completion(uuid, text, text, text) to authenticated;

revoke all on function public.expire_wanted_and_generate_refunds(uuid) from public;
grant execute on function public.expire_wanted_and_generate_refunds(uuid) to authenticated;

revoke all on function public.record_owner_refund_completion(uuid, text, text, text) from public;
grant execute on function public.record_owner_refund_completion(uuid, text, text, text) to authenticated;

revoke all on function public.revoke_entitlements_for_wanted(uuid, text) from public;
grant execute on function public.revoke_entitlements_for_wanted(uuid, text) to authenticated;
