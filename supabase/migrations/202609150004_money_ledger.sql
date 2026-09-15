create type public.contribution_intent_status as enum ('pending', 'paid', 'failed', 'expired');

create table public.contribution_intents (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  payer_user_id uuid not null references public.profiles (user_id) on delete restrict,
  provider text not null check (provider in ('toyyibpay')),
  provider_bill_id text not null unique check (char_length(provider_bill_id) between 1 and 160),
  amount_sen integer not null check (amount_sen between 100 and 5000),
  status public.contribution_intent_status not null default 'pending',
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'paid') = (paid_at is not null))
);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('toyyibpay')),
  provider_transaction_id text not null,
  provider_bill_id text not null,
  amount_sen integer not null check (amount_sen between 0 and 5000),
  status text not null check (status in ('successful', 'failed', 'pending')),
  payload_hash bytea not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_transaction_id)
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  contribution_intent_id uuid not null unique references public.contribution_intents (id) on delete restrict,
  wanted_request_id uuid not null references public.wanted_requests (id) on delete restrict,
  contributor_user_id uuid not null references public.profiles (user_id) on delete restrict,
  provider_event_id uuid not null unique references public.provider_events (id) on delete restrict,
  amount_sen integer not null check (amount_sen between 100 and 5000),
  created_at timestamptz not null default now()
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid unique references public.contributions (id) on delete restrict,
  kind text not null check (kind in ('contribution', 'refund', 'chargeback', 'correction')),
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_code text not null check (account_code ~ '^[a-z_]+$'),
  debit_sen integer not null default 0 check (debit_sen >= 0),
  credit_sen integer not null default 0 check (credit_sen >= 0),
  created_at timestamptz not null default now(),
  check ((debit_sen > 0 and credit_sen = 0) or (credit_sen > 0 and debit_sen = 0))
);

create table public.money_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z0-9_]+$'),
  aggregate_id uuid not null,
  payload jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wanted_duplicate_checks add column draft_updated_at timestamptz;

create or replace function private.prevent_ledger_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'ledger_rows_are_immutable';
end;
$$;

create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions
for each row execute function private.prevent_ledger_mutation();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries
for each row execute function private.prevent_ledger_mutation();
create trigger contributions_immutable before update or delete on public.contributions
for each row execute function private.prevent_ledger_mutation();

create trigger contribution_intents_set_updated_at before update on public.contribution_intents
for each row execute function private.set_updated_at();

create or replace function public.record_wanted_duplicate_check(
  draft_id uuid,
  token_hash_hex text,
  criteria_hash_hex text,
  expires_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare current_updated_at timestamptz;
begin
  if token_hash_hex !~ '^[0-9a-f]{64}$' or criteria_hash_hex !~ '^[0-9a-f]{64}$' or expires_at <= now() then
    raise exception using errcode = '22023', message = 'wanted_duplicate_check_invalid';
  end if;
  select updated_at into current_updated_at from public.wanted_requests
  where id = draft_id and commissioner_user_id = auth.uid() and status = 'draft'
    and private.current_user_can_transact_at(institution_id);
  if current_updated_at is null then
    raise exception using errcode = '42501', message = 'wanted_editable_draft_not_found';
  end if;
  insert into public.wanted_duplicate_checks (wanted_request_id, token_hash, criteria_hash, expires_at, draft_updated_at)
  values (draft_id, decode(token_hash_hex, 'hex'), decode(criteria_hash_hex, 'hex'), expires_at, current_updated_at);
end;
$$;

create function public.create_contribution_intent(
  draft_id uuid,
  token_hash_hex text,
  provider text,
  provider_bill_id text,
  amount_sen integer,
  intent_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  draft public.wanted_requests%rowtype;
  check_row public.wanted_duplicate_checks%rowtype;
  intent_id uuid := gen_random_uuid();
begin
  if actor_id is null or amount_sen not between 100 and 5000 or token_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '42501', message = 'contribution_not_eligible';
  end if;
  select * into draft from public.wanted_requests
  where id = draft_id and commissioner_user_id = actor_id and status = 'draft'
    and private.current_user_can_transact_at(institution_id) for update;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'wanted_editable_draft_not_found'; end if;
  select * into check_row from public.wanted_duplicate_checks
  where wanted_request_id = draft_id and token_hash = decode(token_hash_hex, 'hex')
    and consumed_at is null for update;
  if check_row.id is null then raise exception using errcode = '22023', message = 'wanted_duplicate_check_required'; end if;
  if check_row.expires_at <= now() then raise exception using errcode = '22023', message = 'wanted_duplicate_check_expired'; end if;
  if check_row.draft_updated_at is distinct from draft.updated_at then raise exception using errcode = '22023', message = 'wanted_duplicate_check_required'; end if;
  update public.wanted_duplicate_checks set consumed_at = now() where id = check_row.id;
  update public.wanted_requests set status = 'awaiting_payment', duration_days_snapshot = requested_duration_days,
    fee_rate_basis_points_snapshot = 1000, policy_version_snapshot = '2026-09-15.1', access_basis_snapshot = 'contributors_only'
  where id = draft_id;
  insert into public.contribution_intents (id, wanted_request_id, payer_user_id, provider, provider_bill_id, amount_sen, expires_at)
  values (intent_id, draft_id, actor_id, provider, provider_bill_id, amount_sen, intent_expires_at);
  return intent_id;
end;
$$;

create function public.record_verified_contribution(
  provider_name text,
  provider_transaction_id text,
  provider_bill_id text,
  amount_sen integer,
  provider_status text,
  payload_hash_hex text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  intent public.contribution_intents%rowtype;
  existing_event public.provider_events%rowtype;
  event_id uuid := gen_random_uuid();
  contribution_id uuid := gen_random_uuid();
  ledger_transaction_id uuid := gen_random_uuid();
begin
  select * into existing_event from public.provider_events
  where provider = provider_name and provider_transaction_id = record_verified_contribution.provider_transaction_id;
  if existing_event.id is not null then return 'duplicate'; end if;
  select * into intent from public.contribution_intents where provider = provider_name
    and provider_bill_id = record_verified_contribution.provider_bill_id for update;
  if intent.id is null then return 'unknown'; end if;
  insert into public.provider_events (id, provider, provider_transaction_id, provider_bill_id, amount_sen, status, payload_hash, processed_at)
  values (event_id, provider_name, record_verified_contribution.provider_transaction_id, provider_bill_id, amount_sen, provider_status, decode(payload_hash_hex, 'hex'), now());
  if provider_status <> 'successful' or amount_sen <> intent.amount_sen then
    update public.contribution_intents set status = 'failed' where id = intent.id;
    return 'rejected';
  end if;
  insert into public.contributions (id, contribution_intent_id, wanted_request_id, contributor_user_id, provider_event_id, amount_sen)
  values (contribution_id, intent.id, intent.wanted_request_id, intent.payer_user_id, event_id, amount_sen);
  insert into public.ledger_transactions (id, contribution_id, kind) values (ledger_transaction_id, contribution_id, 'contribution');
  insert into public.ledger_entries (transaction_id, account_code, debit_sen) values (ledger_transaction_id, 'platform_cash', amount_sen);
  insert into public.ledger_entries (transaction_id, account_code, credit_sen) values (ledger_transaction_id, 'wanted_escrow', amount_sen);
  if (select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0) from public.ledger_entries where ledger_entries.transaction_id = ledger_transaction_id) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;
  update public.contribution_intents set status = 'paid', paid_at = now() where id = intent.id;
  update public.wanted_requests set status = 'open', published_at = coalesce(published_at, now()),
    closes_at = coalesce(closes_at, now() + make_interval(days => duration_days_snapshot))
  where id = intent.wanted_request_id and status = 'awaiting_payment';
  insert into public.money_outbox (event_type, aggregate_id, payload)
  values ('contribution_confirmed', intent.wanted_request_id, jsonb_build_object('contributionId', contribution_id));
  return 'accepted';
end;
$$;

revoke all on function public.record_wanted_duplicate_check(uuid, text, text, timestamptz) from public;
grant execute on function public.record_wanted_duplicate_check(uuid, text, text, timestamptz) to authenticated;
revoke all on function public.create_contribution_intent(uuid, text, text, text, integer, timestamptz) from public;
grant execute on function public.create_contribution_intent(uuid, text, text, text, integer, timestamptz) to authenticated;
revoke all on function public.record_verified_contribution(text, text, text, integer, text, text) from public;
grant execute on function public.record_verified_contribution(text, text, text, integer, text, text) to service_role;

alter table public.contribution_intents enable row level security;
alter table public.provider_events enable row level security;
alter table public.contributions enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.money_outbox enable row level security;
create policy contribution_intents_read_own on public.contribution_intents for select to authenticated using (payer_user_id = auth.uid());
create policy contributions_read_own on public.contributions for select to authenticated using (contributor_user_id = auth.uid());
grant usage on type public.contribution_intent_status to authenticated;
grant select on public.contribution_intents, public.contributions to authenticated;
grant select on public.provider_events, public.ledger_transactions, public.ledger_entries, public.money_outbox to service_role;
