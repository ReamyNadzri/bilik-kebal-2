create or replace function public.record_verified_contribution(
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
  select pe.* into existing_event
  from public.provider_events as pe
  where pe.provider = record_verified_contribution.provider_name
    and pe.provider_transaction_id = record_verified_contribution.provider_transaction_id;
  if existing_event.id is not null then return 'duplicate'; end if;

  select ci.* into intent
  from public.contribution_intents as ci
  where ci.provider = record_verified_contribution.provider_name
    and ci.provider_bill_id = record_verified_contribution.provider_bill_id
  for update;
  if intent.id is null then return 'unknown'; end if;

  insert into public.provider_events (
    id, provider, provider_transaction_id, provider_bill_id,
    amount_sen, status, payload_hash, processed_at
  )
  values (
    event_id, record_verified_contribution.provider_name,
    record_verified_contribution.provider_transaction_id,
    record_verified_contribution.provider_bill_id,
    record_verified_contribution.amount_sen,
    record_verified_contribution.provider_status,
    decode(record_verified_contribution.payload_hash_hex, 'hex'), now()
  );

  if record_verified_contribution.provider_status <> 'successful'
    or record_verified_contribution.amount_sen <> intent.amount_sen then
    if record_verified_contribution.provider_status = 'failed'
      or record_verified_contribution.provider_status = 'successful' then
      update public.contribution_intents set status = 'failed' where id = intent.id;
    end if;
    return 'rejected';
  end if;

  insert into public.contributions (
    id, contribution_intent_id, wanted_request_id,
    contributor_user_id, provider_event_id, amount_sen
  )
  values (
    contribution_id, intent.id, intent.wanted_request_id,
    intent.payer_user_id, event_id, record_verified_contribution.amount_sen
  );
  insert into public.ledger_transactions (id, contribution_id, kind)
  values (ledger_transaction_id, contribution_id, 'contribution');
  insert into public.ledger_entries (transaction_id, account_code, debit_sen)
  values (ledger_transaction_id, 'platform_cash', record_verified_contribution.amount_sen);
  insert into public.ledger_entries (transaction_id, account_code, credit_sen)
  values (ledger_transaction_id, 'wanted_escrow', record_verified_contribution.amount_sen);

  if (
    select coalesce(sum(le.debit_sen), 0) <> coalesce(sum(le.credit_sen), 0)
    from public.ledger_entries as le
    where le.transaction_id = ledger_transaction_id
  ) then
    raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
  end if;

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

revoke all on function public.record_verified_contribution(text, text, text, integer, text, text) from public;
grant execute on function public.record_verified_contribution(text, text, text, integer, text, text) to service_role;
