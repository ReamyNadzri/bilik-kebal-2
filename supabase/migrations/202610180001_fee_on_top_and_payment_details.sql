-- Migration: 202610180001_fee_on_top_and_payment_details.sql
--
-- Real payment flow with a replaceable gateway (request, 2026-09-30):
--
--   * The platform fee is charged ON TOP of a contribution, not taken out of
--     the bounty. A payer is billed contribution + fee; the whole contribution
--     goes to the bounty and the Hunter is paid the whole bounty. The fee rate
--     is still the one snapshotted when the Wanted was published, and each
--     contribution's fee is rounded down to the sen.
--   * The fee is held (platform_fee_held) until the bounty is paid out, when
--     it becomes revenue. A refund returns contribution + fee in full.
--   * 'mock' is a second provider beside 'toyyibpay': a test gateway inside
--     VAULTIX whose events go through the same verified, exactly-once path.
--     No real money moves through it, and its rows say so.
--   * Backing an open Wanted gets its own intent (create_backing_intent).
--   * Every payer and Hunter keeps a phone number and one bank account on
--     file (private.member_payment_details) for refunds and payouts: paying,
--     and claiming a Wanted with a bounty, both require it. The member reads
--     it back masked; only the Owner reads it in full, and only for a pending
--     payout or refund task.
--
-- No contribution, intent, provider event, payout, refund or ledger row
-- existed on Supabase Cloud when this was written (checked 2026-09-30), so no
-- money recorded under the old "fee inside the bounty" rule is re-priced.

-- ---------------------------------------------------------------------------
-- 1. Money columns
-- ---------------------------------------------------------------------------

alter table public.contribution_intents
  drop constraint if exists contribution_intents_provider_check,
  add constraint contribution_intents_provider_check check (provider in ('toyyibpay', 'mock')),
  add column fee_sen integer not null default 0 check (fee_sen between 0 and 5000);

alter table public.provider_events
  drop constraint if exists provider_events_provider_check,
  add constraint provider_events_provider_check check (provider in ('toyyibpay', 'mock')),
  drop constraint if exists provider_events_amount_sen_check,
  add constraint provider_events_amount_sen_check check (amount_sen between 0 and 10000);

-- Adding a column rewrites no row, so the immutability trigger is not fired.
alter table public.contributions
  add column fee_sen integer not null default 0 check (fee_sen between 0 and 5000);

alter table public.refund_tasks
  add column fee_sen bigint not null default 0 check (fee_sen >= 0),
  add column test_money boolean not null default false;

alter table public.payout_tasks
  add column test_money boolean not null default false;

comment on column public.contribution_intents.amount_sen is
  'The contribution to the bounty. The payer is billed amount_sen + fee_sen.';
comment on column public.contributions.fee_sen is
  'Platform fee paid on top of amount_sen; held until payout, refunded with the contribution.';
comment on column public.refund_tasks.fee_sen is
  'Fee paid on top of amount_sen; the Owner refunds amount_sen + fee_sen.';
comment on column public.refund_tasks.test_money is
  'The contribution was paid through the test gateway: no money was received, so none is refunded.';
comment on column public.payout_tasks.test_money is
  'Some of the bounty was paid through the test gateway: that money was never received.';
comment on column public.payout_tasks.platform_fee_sen is
  'Sum of the fees paid on top of the contributions. Not deducted: net_payout_sen = gross_bounty_sen.';

-- The fee on one contribution: rate snapshotted at publication, rounded down.
create function private.contribution_fee_sen(amount_sen integer, fee_rate_basis_points integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (amount_sen * coalesce(fee_rate_basis_points, 0)) / 10000;
$$;
revoke all on function private.contribution_fee_sen(integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payment details: phone and bank account for refunds and payouts
-- ---------------------------------------------------------------------------

create table private.member_payment_details (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+601[0-9]{8,9}$'),
  bank_code text not null check (bank_code in (
    'affin', 'agrobank', 'alliance', 'al_rajhi', 'ambank', 'bank_islam', 'bank_muamalat',
    'bank_rakyat', 'bsn', 'cimb', 'hong_leong', 'hsbc', 'kfh', 'maybank', 'mbsb', 'ocbc',
    'public_bank', 'rhb', 'standard_chartered', 'uob', 'gxbank', 'boost_bank', 'aeon_bank'
  )),
  account_holder_name text not null
    check (char_length(account_holder_name) between 3 and 100 and account_holder_name = trim(account_holder_name)),
  account_number text not null check (account_number ~ '^[0-9]{6,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.member_payment_details enable row level security;
revoke all on private.member_payment_details from public, anon, authenticated;

create trigger member_payment_details_set_updated_at
before update on private.member_payment_details
for each row execute function private.set_updated_at();

-- Saves the caller's own details. Phone arrives already normalised to +60.
create function public.set_own_payment_details(
  new_phone_e164 text,
  new_bank_code text,
  new_account_holder_name text,
  new_account_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;
  insert into private.member_payment_details (
    user_id, phone_e164, bank_code, account_holder_name, account_number
  ) values (
    actor_id, new_phone_e164, new_bank_code, trim(new_account_holder_name), new_account_number
  )
  on conflict (user_id) do update
  set phone_e164 = excluded.phone_e164,
      bank_code = excluded.bank_code,
      account_holder_name = excluded.account_holder_name,
      account_number = excluded.account_number;
exception
  when check_violation then
    raise exception using errcode = '22023', message = 'payment_details_invalid';
end;
$$;
revoke all on function public.set_own_payment_details(text, text, text, text) from public, anon;
grant execute on function public.set_own_payment_details(text, text, text, text) to authenticated;

-- The caller's own details, with the account number masked to its last four digits.
create function public.my_payment_details()
returns table (
  phone_e164 text,
  bank_code text,
  account_holder_name text,
  account_number_last4 text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.phone_e164, d.bank_code, d.account_holder_name, right(d.account_number, 4), d.updated_at
  from private.member_payment_details d
  where d.user_id = private.current_user_id();
$$;
revoke all on function public.my_payment_details() from public, anon;
grant execute on function public.my_payment_details() to authenticated;

-- Full details for the Owner, only for members with a pending payout or refund task.
create function public.owner_payment_recipients(target_user_ids uuid[])
returns table (
  user_id uuid,
  phone_e164 text,
  bank_code text,
  account_holder_name text,
  account_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'owner_role_required';
  end if;
  return query
  select d.user_id, d.phone_e164, d.bank_code, d.account_holder_name, d.account_number
  from private.member_payment_details d
  where d.user_id = any(target_user_ids)
    and (
      exists (select 1 from public.payout_tasks p where p.hunter_user_id = d.user_id and p.status = 'pending')
      or exists (select 1 from public.refund_tasks r where r.contributor_user_id = d.user_id and r.status = 'pending')
    );
end;
$$;
revoke all on function public.owner_payment_recipients(uuid[]) from public, anon;
grant execute on function public.owner_payment_recipients(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Intents: first contribution (publish) and backing an open Wanted
-- ---------------------------------------------------------------------------

drop function public.create_contribution_intent(uuid, text, text, text, integer, timestamptz);

create function public.create_contribution_intent(
  draft_id uuid,
  token_hash_hex text,
  provider text,
  provider_bill_id text,
  amount_sen integer,
  fee_sen integer,
  intent_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  draft public.wanted_requests%rowtype;
  check_row public.wanted_duplicate_checks%rowtype;
  intent_id uuid := gen_random_uuid();
  fee_rate integer := 1000;
begin
  if actor_id is null or amount_sen not between 100 and 5000 or token_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'contribution_not_eligible';
  end if;
  if not exists (select 1 from private.member_payment_details d where d.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'payment_details_required';
  end if;
  if fee_sen is distinct from private.contribution_fee_sen(amount_sen, fee_rate) then
    raise exception using errcode = '22023', message = 'contribution_fee_mismatch';
  end if;
  select * into draft from public.wanted_requests w
  where w.id = draft_id and w.commissioner_user_id = actor_id and w.status = 'draft'
    and private.current_user_can_transact_at(w.institution_id) for update;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'wanted_editable_draft_not_found'; end if;
  select * into check_row from public.wanted_duplicate_checks c
  where c.wanted_request_id = draft_id and c.token_hash = decode(token_hash_hex, 'hex')
    and c.consumed_at is null for update;
  if check_row.id is null then raise exception using errcode = '22023', message = 'wanted_duplicate_check_required'; end if;
  if check_row.expires_at <= now() then raise exception using errcode = '22023', message = 'wanted_duplicate_check_expired'; end if;
  if check_row.draft_updated_at is distinct from draft.updated_at then raise exception using errcode = '22023', message = 'wanted_duplicate_check_required'; end if;
  update public.wanted_duplicate_checks set consumed_at = now() where id = check_row.id;
  update public.wanted_requests set status = 'awaiting_payment', duration_days_snapshot = requested_duration_days,
    fee_rate_basis_points_snapshot = fee_rate, policy_version_snapshot = '2026-09-15.1', access_basis_snapshot = 'contributors_only'
  where id = draft_id;
  insert into public.contribution_intents (id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, fee_sen, expires_at)
  values (intent_id, draft_id, actor_id, provider, provider_bill_id, amount_sen, fee_sen, intent_expires_at);
  return intent_id;
end;
$$;
revoke all on function public.create_contribution_intent(uuid, text, text, text, integer, integer, timestamptz) from public, anon;
grant execute on function public.create_contribution_intent(uuid, text, text, text, integer, integer, timestamptz) to authenticated;

-- The fee rate a Backer will be charged, read before the bill is created.
create function public.backing_fee_rate(target_public_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select w.fee_rate_basis_points_snapshot
  from public.wanted_requests w
  where w.public_id = target_public_id and w.status = 'open' and not w.is_free;
$$;
revoke all on function public.backing_fee_rate(uuid) from public, anon;
grant execute on function public.backing_fee_rate(uuid) to authenticated;

create function public.create_backing_intent(
  target_public_id uuid,
  provider text,
  provider_bill_id text,
  amount_sen integer,
  fee_sen integer,
  intent_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target public.wanted_requests%rowtype;
  intent_id uuid := gen_random_uuid();
begin
  if actor_id is null or amount_sen not between 100 and 5000 then
    raise exception using errcode = '42501', message = 'contribution_not_eligible';
  end if;
  if not exists (select 1 from private.member_payment_details d where d.user_id = actor_id) then
    raise exception using errcode = '42501', message = 'payment_details_required';
  end if;
  -- Share lock: a withdrawal or expiry waits for this intent, and vice versa.
  select * into target from public.wanted_requests w
  where w.public_id = target_public_id for share;
  if target.id is null or target.status <> 'open' or target.is_free or target.is_paused
    or target.closes_at <= now() then
    raise exception using errcode = 'P0002', message = 'wanted_not_open';
  end if;
  if not private.current_user_can_transact_at(target.institution_id) then
    raise exception using errcode = '42501', message = 'contribution_not_eligible';
  end if;
  if fee_sen is distinct from private.contribution_fee_sen(amount_sen, target.fee_rate_basis_points_snapshot) then
    raise exception using errcode = '22023', message = 'contribution_fee_mismatch';
  end if;
  insert into public.contribution_intents (id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, fee_sen, expires_at)
  values (intent_id, target.id, actor_id, provider, provider_bill_id, amount_sen, fee_sen, intent_expires_at);
  return intent_id;
end;
$$;
revoke all on function public.create_backing_intent(uuid, text, text, integer, integer, timestamptz) from public, anon;
grant execute on function public.create_backing_intent(uuid, text, text, integer, integer, timestamptz) to authenticated;

-- One bill as its payer sees it: for the checkout and the return page.
create function public.my_payment_bill(target_provider_bill_id text)
returns table (
  provider text,
  provider_bill_id text,
  status public.contribution_intent_status,
  amount_sen integer,
  fee_sen integer,
  expires_at timestamptz,
  paid_at timestamptz,
  purpose text,
  wanted_public_id uuid,
  wanted_title text,
  wanted_status public.wanted_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.provider, i.provider_bill_id, i.status, i.amount_sen, i.fee_sen, i.expires_at, i.paid_at,
    case when w.published_at is null or i.created_at < w.published_at then 'publish' else 'back' end,
    w.public_id, w.title, w.status
  from public.contribution_intents i
  join public.wanted_requests w on w.id = i.wanted_request_id
  where i.provider_bill_id = target_provider_bill_id
    and i.payer_user_id = private.current_user_id();
$$;
revoke all on function public.my_payment_bill(text) from public, anon;
grant execute on function public.my_payment_bill(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Verified provider events: billed total = contribution + fee
-- ---------------------------------------------------------------------------

create or replace function public.record_verified_contribution(
  provider_name text,
  provider_transaction_id text,
  provider_bill_id text,
  amount_sen integer,
  provider_status text,
  payload_hash_hex text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.contribution_intents%rowtype;
  event public.provider_events%rowtype;
  contribution_id uuid := gen_random_uuid();
  ledger_transaction_id uuid := gen_random_uuid();
begin
  select pe.* into event
  from public.provider_events as pe
  where pe.provider = record_verified_contribution.provider_name
    and pe.provider_transaction_id = record_verified_contribution.provider_transaction_id
  for update;

  if event.id is null then
    insert into public.provider_events (
      provider, provider_transaction_id, provider_bill_id,
      amount_sen, status, payload_hash
    )
    values (
      record_verified_contribution.provider_name,
      record_verified_contribution.provider_transaction_id,
      record_verified_contribution.provider_bill_id,
      record_verified_contribution.amount_sen,
      record_verified_contribution.provider_status,
      decode(record_verified_contribution.payload_hash_hex, 'hex')
    )
    on conflict do nothing
    returning * into event;

    if event.id is null then
      select pe.* into event
      from public.provider_events as pe
      where pe.provider = record_verified_contribution.provider_name
        and pe.provider_transaction_id = record_verified_contribution.provider_transaction_id
      for update;
    end if;
  end if;

  if event.processed_at is not null then return 'duplicate'; end if;

  select ci.* into intent
  from public.contribution_intents as ci
  where ci.provider = event.provider and ci.provider_bill_id = event.provider_bill_id
  for update;
  if intent.id is null then return 'unknown'; end if;

  if intent.status = 'paid' then
    update public.provider_events set processed_at = now() where id = event.id;
    return 'duplicate';
  end if;

  if event.status <> 'successful' or event.amount_sen <> intent.amount_sen + intent.fee_sen then
    update public.provider_events set processed_at = now() where id = event.id;
    if event.status = 'failed' or event.status = 'successful' then
      update public.contribution_intents set status = 'failed' where id = intent.id;
      -- An unpaid first contribution hands the draft back to its poster.
      update public.wanted_requests
      set status = 'draft', duration_days_snapshot = null, fee_rate_basis_points_snapshot = null,
        policy_version_snapshot = null, access_basis_snapshot = null
      where id = intent.wanted_request_id and status = 'awaiting_payment'
        and not exists (
          select 1 from public.contribution_intents other
          where other.wanted_request_id = intent.wanted_request_id
            and other.id <> intent.id and other.status = 'pending'
        );
    end if;
    return 'rejected';
  end if;

  insert into public.contributions (
    id, contribution_intent_id, wanted_request_id,
    contributor_user_id, provider_event_id, amount_sen, fee_sen
  )
  values (
    contribution_id, intent.id, intent.wanted_request_id,
    intent.payer_user_id, event.id, intent.amount_sen, intent.fee_sen
  );
  insert into public.ledger_transactions (id, contribution_id, kind)
  values (ledger_transaction_id, contribution_id, 'contribution');
  insert into public.ledger_entries (transaction_id, account_code, debit_sen)
  values (ledger_transaction_id, 'platform_cash', event.amount_sen);
  insert into public.ledger_entries (transaction_id, account_code, credit_sen)
  values (ledger_transaction_id, 'wanted_escrow', intent.amount_sen);
  if intent.fee_sen > 0 then
    insert into public.ledger_entries (transaction_id, account_code, credit_sen)
    values (ledger_transaction_id, 'platform_fee_held', intent.fee_sen);
  end if;

  if (
    select coalesce(sum(le.debit_sen), 0) <> coalesce(sum(le.credit_sen), 0)
    from public.ledger_entries as le
    where le.transaction_id = ledger_transaction_id
  ) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;

  update public.provider_events set processed_at = now() where id = event.id;
  update public.contribution_intents set status = 'paid', paid_at = now() where id = intent.id;
  update public.wanted_requests
  set status = 'open',
    published_at = coalesce(published_at, now()),
    closes_at = coalesce(closes_at, now() + make_interval(days => duration_days_snapshot))
  where id = intent.wanted_request_id and status = 'awaiting_payment';
  insert into public.money_outbox (event_type, aggregate_id, payload)
  values (
    'contribution_confirmed', intent.wanted_request_id,
    jsonb_build_object('contributionId', contribution_id)
  );
  return 'accepted';
end;
$$;
revoke all on function public.record_verified_contribution(text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_verified_contribution(text, text, text, integer, text, text) to service_role;

-- A payer who leaves the checkout without paying. Same effect as a failed
-- provider event, for the payer's own pending bill only.
create function public.cancel_own_payment(target_provider_bill_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent public.contribution_intents%rowtype;
begin
  select * into intent from public.contribution_intents i
  where i.provider_bill_id = target_provider_bill_id
    and i.payer_user_id = private.current_user_id()
  for update;
  if intent.id is null then
    raise exception using errcode = 'P0002', message = 'payment_bill_not_found';
  end if;
  if intent.status <> 'pending' then
    return;
  end if;
  update public.contribution_intents set status = 'failed' where id = intent.id;
  update public.wanted_requests
  set status = 'draft', duration_days_snapshot = null, fee_rate_basis_points_snapshot = null,
    policy_version_snapshot = null, access_basis_snapshot = null
  where id = intent.wanted_request_id and status = 'awaiting_payment'
    and not exists (
      select 1 from public.contribution_intents other
      where other.wanted_request_id = intent.wanted_request_id
        and other.id <> intent.id and other.status = 'pending'
    );
end;
$$;
revoke all on function public.cancel_own_payment(text) from public, anon;
grant execute on function public.cancel_own_payment(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Payouts: the Hunter gets the whole bounty; the held fees become revenue
-- ---------------------------------------------------------------------------

-- Whatever creates a payout task (claim approval, community payout), the fee
-- is the sum paid on top of the contributions and nothing is deducted.
create function private.payout_task_fee_on_top()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(sum(c.fee_sen), 0) into new.platform_fee_sen
  from public.contributions c
  where c.wanted_request_id = new.wanted_request_id;
  new.net_payout_sen := new.gross_bounty_sen;
  new.test_money := exists (
    select 1 from public.contributions c
    join public.contribution_intents i on i.id = c.contribution_intent_id
    where c.wanted_request_id = new.wanted_request_id and i.provider = 'mock'
  );
  return new;
end;
$$;
revoke all on function private.payout_task_fee_on_top() from public, anon, authenticated;

create trigger payout_tasks_fee_on_top
before insert on public.payout_tasks
for each row execute function private.payout_task_fee_on_top();

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
  actor_id uuid := private.current_user_id();
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
  where id = target_payout_task_id and status = 'pending'
  for update;

  if not found then
    raise exception 'pending payout task not found' using errcode = 'P0002';
  end if;

  update public.payout_tasks
  set status = 'completed',
      external_reference = target_external_ref,
      payout_method = target_method,
      evidence_notes = target_notes,
      owner_user_id = actor_id,
      completed_at = now(),
      updated_at = now()
  where id = target_payout_task_id;

  insert into public.ledger_transactions (kind, payout_task_id)
  values ('payout', target_payout_task_id)
  returning id into v_tx_id;

  -- The whole bounty leaves escrow to the Hunter.
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'wanted_escrow', v_payout.gross_bounty_sen::integer, 0);
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'payout_disbursement', 0, v_payout.net_payout_sen::integer);

  -- The fees held since each contribution are earned now.
  if v_payout.platform_fee_sen > 0 then
    insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
    values (v_tx_id, 'platform_fee_held', v_payout.platform_fee_sen::integer, 0);
    insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
    values (v_tx_id, 'platform_fee_revenue', 0, v_payout.platform_fee_sen::integer);
  end if;

  if (select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0) from public.ledger_entries where ledger_entries.transaction_id = v_tx_id) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Refunds: contribution + fee, in full
-- ---------------------------------------------------------------------------

-- Every refund task, whoever creates it (withdrawal, expiry, late payment),
-- carries the fee paid with its contribution.
create function private.refund_task_fee_on_top()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.fee_sen, i.provider = 'mock' into new.fee_sen, new.test_money
  from public.contributions c
  join public.contribution_intents i on i.id = c.contribution_intent_id
  where c.id = new.contribution_id;
  new.fee_sen := coalesce(new.fee_sen, 0);
  new.test_money := coalesce(new.test_money, false);
  return new;
end;
$$;
revoke all on function private.refund_task_fee_on_top() from public, anon, authenticated;

create trigger refund_tasks_fee_on_top
before insert on public.refund_tasks
for each row execute function private.refund_task_fee_on_top();

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
  actor_id uuid := private.current_user_id();
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
  where id = target_refund_task_id and status = 'pending'
  for update;

  if not found then
    raise exception 'pending refund task not found' using errcode = 'P0002';
  end if;

  update public.refund_tasks
  set status = 'completed',
      external_reference = target_external_ref,
      refund_method = target_method,
      evidence_notes = target_notes,
      owner_user_id = actor_id,
      completed_at = now(),
      updated_at = now()
  where id = target_refund_task_id;

  insert into public.ledger_transactions (kind, contribution_id, refund_task_id)
  values ('refund', v_refund.contribution_id, target_refund_task_id)
  returning id into v_tx_id;

  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'wanted_escrow', v_refund.amount_sen::integer, 0);
  if v_refund.fee_sen > 0 then
    insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
    values (v_tx_id, 'platform_fee_held', v_refund.fee_sen::integer, 0);
  end if;
  insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
  values (v_tx_id, 'refund_disbursement', 0, (v_refund.amount_sen + v_refund.fee_sen)::integer);

  if (select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0) from public.ledger_entries where ledger_entries.transaction_id = v_tx_id) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;
end;
$$;

-- A contribution confirmed after its Wanted stopped taking money (withdrawn,
-- expired, fulfilled or closed while the payer was at the checkout, or a
-- first contribution paid after its bill was cancelled and the Wanted went
-- back to draft) is queued for a full refund, so no money is left in escrow.
create or replace function private.refund_contribution_to_withdrawn_wanted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.wanted_requests w
    where w.id = new.wanted_request_id
      and w.status in ('draft', 'withdrawn', 'expired', 'fulfilled', 'closed')
  ) then
    insert into public.refund_tasks (
      wanted_request_id, contribution_id, contributor_user_id, amount_sen, status
    )
    values (new.wanted_request_id, new.id, new.contributor_user_id, new.amount_sen, 'pending')
    on conflict (contribution_id) do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. A Hunter needs payment details before claiming a Wanted with a bounty
-- ---------------------------------------------------------------------------

create function private.require_hunter_payment_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.wanted_requests w
    where w.id = new.wanted_request_id and not w.is_free
  ) and not exists (
    select 1 from private.member_payment_details d where d.user_id = new.hunter_user_id
  ) then
    raise exception using errcode = '42501', message = 'payment_details_required';
  end if;
  return new;
end;
$$;
revoke all on function private.require_hunter_payment_details() from public, anon, authenticated;

create trigger claims_require_hunter_payment_details
before insert on public.claims
for each row execute function private.require_hunter_payment_details();
