create function public.list_unresolved_provider_events(max_rows integer default 100)
returns table (
  id uuid,
  provider text,
  provider_bill_id text,
  provider_transaction_id text,
  received_at timestamptz,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pe.id,
    pe.provider,
    pe.provider_bill_id,
    pe.provider_transaction_id,
    pe.received_at,
    case
      when ci.id is null then 'unknown_bill'
      when pe.amount_sen <> ci.amount_sen then 'amount_mismatch'
      else 'invalid_state'
    end as reason
  from public.provider_events as pe
  left join public.contribution_intents as ci
    on ci.provider = pe.provider and ci.provider_bill_id = pe.provider_bill_id
  where pe.processed_at is null
  order by pe.received_at, pe.id
  limit greatest(1, least(coalesce(max_rows, 100), 500));
$$;

revoke all on function public.list_unresolved_provider_events(integer) from public;
grant execute on function public.list_unresolved_provider_events(integer) to service_role;
