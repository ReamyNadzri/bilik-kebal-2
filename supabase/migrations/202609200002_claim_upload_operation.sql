create or replace function public.create_claim_upload_session(
  target_wanted_id uuid,
  target_file_name text,
  target_mime_type text,
  target_size_bytes integer,
  target_sha256_hex text,
  target_object_key text,
  target_expires_at timestamptz,
  target_free_release_opt_in boolean
)
returns table (claim_id uuid, object_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_institution_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select w.institution_id into target_institution_id
  from public.wanted_requests w
  where w.id = target_wanted_id and w.status in ('open', 'reviewing');
  if target_institution_id is null then
    raise exception 'wanted request is not open' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.institution_memberships m
    where m.user_id = actor_id and m.institution_id = target_institution_id
      and m.verification_state = 'verified'
  ) then
    raise exception 'institution verification required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.account_restrictions r
    where r.user_id = actor_id and r.lifted_at is null
  ) then
    raise exception 'account restricted' using errcode = '42501';
  end if;

  insert into public.claims (
    wanted_request_id, hunter_user_id, institution_id, file_name, mime_type,
    size_bytes, sha256, object_key, rights_confirmed_at, free_release_opt_in
  ) values (
    target_wanted_id, actor_id, target_institution_id, target_file_name, target_mime_type,
    target_size_bytes, decode(target_sha256_hex, 'hex'), target_object_key, now(),
    target_free_release_opt_in
  ) returning id, claims.object_key into claim_id, object_key;

  insert into public.claim_upload_sessions (claim_id, object_key, expires_at)
  values (claim_id, object_key, target_expires_at);

  return next;
end;
$$;

revoke all on function public.create_claim_upload_session(uuid, text, text, integer, text, text, timestamptz, boolean) from public;
grant execute on function public.create_claim_upload_session(uuid, text, text, integer, text, text, timestamptz, boolean) to authenticated;
