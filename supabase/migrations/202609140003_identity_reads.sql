create function public.authorise_identity_evidence_read(target_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.institution_verification_requests%rowtype;
begin
  select *
  into request_record
  from public.institution_verification_requests
  where id = target_request_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;

  if not (
    private.current_user_is_platform_staff()
    or private.current_user_is_institution_sheriff(request_record.institution_id)
  ) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;

  if request_record.evidence_delete_after <= now() then
    raise exception using errcode = 'P0001', message = 'EVIDENCE_EXPIRED';
  end if;

  insert into public.identity_audit_events (
    event_type,
    actor_user_id,
    subject_user_id,
    institution_id,
    details
  )
  values (
    'institution_verification.evidence_viewed',
    auth.uid(),
    request_record.user_id,
    request_record.institution_id,
    jsonb_build_object('request_id', target_request_id)
  );

  return request_record.evidence_object_path;
end;
$$;

revoke all on function public.authorise_identity_evidence_read(uuid) from public;
grant execute on function public.authorise_identity_evidence_read(uuid) to authenticated;
