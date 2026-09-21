create or replace function public.complete_claim_upload_session(
  target_claim_id uuid
)
returns table (
  claim_id uuid,
  wanted_id uuid,
  status public.claim_status,
  file_name text,
  size_bytes bigint,
  mime_type text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_session public.claim_upload_sessions%rowtype;
  v_claim public.claims%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_claim
  from public.claims
  where id = target_claim_id;

  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;

  if v_claim.hunter_user_id <> actor_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_session
  from public.claim_upload_sessions
  where claim_id = target_claim_id;

  if not found then
    raise exception 'upload session not found' using errcode = 'P0002';
  end if;

  if v_session.expires_at < now() and v_session.completed_at is null then
    raise exception 'upload session expired' using errcode = 'P0001';
  end if;

  if v_session.completed_at is null then
    update public.claim_upload_sessions
    set completed_at = now()
    where claim_id = target_claim_id
    returning completed_at into v_session.completed_at;

    update public.claims
    set status = 'screening',
        updated_at = now()
    where id = target_claim_id
    returning * into v_claim;
  end if;

  return query
  select
    v_claim.id,
    v_claim.wanted_request_id,
    v_claim.status,
    v_claim.file_name,
    v_claim.size_bytes,
    v_claim.mime_type,
    v_session.completed_at;
end;
$$;

revoke all on function public.complete_claim_upload_session(uuid) from public;
grant execute on function public.complete_claim_upload_session(uuid) to authenticated;
