create function public.record_wanted_duplicate_check(
  draft_id uuid,
  token_hash_hex text,
  criteria_hash_hex text,
  expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if token_hash_hex !~ '^[0-9a-f]{64}$'
    or criteria_hash_hex !~ '^[0-9a-f]{64}$'
    or expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'wanted_duplicate_check_invalid';
  end if;
  if not exists (
    select 1 from public.wanted_requests
    where id = draft_id
      and commissioner_user_id = auth.uid()
      and status = 'draft'
      and private.current_user_can_transact_at(institution_id)
  ) then
    raise exception using errcode = '42501', message = 'wanted_editable_draft_not_found';
  end if;

  insert into public.wanted_duplicate_checks (
    wanted_request_id, token_hash, criteria_hash, expires_at
  ) values (
    draft_id, decode(token_hash_hex, 'hex'), decode(criteria_hash_hex, 'hex'), expires_at
  );
end;
$$;

revoke all on function public.record_wanted_duplicate_check(uuid, text, text, timestamptz) from public;
grant execute on function public.record_wanted_duplicate_check(uuid, text, text, timestamptz) to authenticated;

create function private.prepare_wanted_publication(
  target_draft_id uuid,
  target_token_hash_hex text,
  target_criteria_hash_hex text,
  initial_contribution_sen integer,
  target_duration_days smallint,
  target_fee_rate_basis_points integer,
  target_policy_version text,
  target_access_basis public.wanted_access_basis
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_check public.wanted_duplicate_checks%rowtype;
begin
  if initial_contribution_sen not between 100 and 5000 then
    raise exception using errcode = '22023', message = 'wanted_amount_out_of_range';
  end if;
  if not exists (
    select 1 from public.wanted_requests
    where id = target_draft_id
      and commissioner_user_id = auth.uid()
      and status = 'draft'
      and requested_duration_days = target_duration_days
      and private.current_user_can_transact_at(institution_id)
    for update
  ) then
    raise exception using errcode = '42501', message = 'wanted_editable_draft_not_found';
  end if;

  select * into duplicate_check
  from public.wanted_duplicate_checks
  where wanted_request_id = target_draft_id
    and token_hash = decode(target_token_hash_hex, 'hex')
    and criteria_hash = decode(target_criteria_hash_hex, 'hex')
  order by created_at desc
  limit 1
  for update;

  if duplicate_check.id is null or duplicate_check.consumed_at is not null then
    return 'required';
  end if;
  if duplicate_check.expires_at <= now() then
    return 'expired';
  end if;

  update public.wanted_duplicate_checks set consumed_at = now() where id = duplicate_check.id;
  update public.wanted_requests set
    status = 'awaiting_payment',
    duration_days_snapshot = target_duration_days,
    fee_rate_basis_points_snapshot = target_fee_rate_basis_points,
    policy_version_snapshot = target_policy_version,
    access_basis_snapshot = target_access_basis
  where id = target_draft_id;
  return 'prepared';
end;
$$;

revoke all on function private.prepare_wanted_publication(uuid, text, text, integer, smallint, integer, text, public.wanted_access_basis) from public;
