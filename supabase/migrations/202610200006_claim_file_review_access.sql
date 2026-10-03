-- Migration: 202610200006_claim_file_review_access.sql
--
-- Sheriffs and the Owner could not open a claim's file while reviewing it: the
-- quarantine bucket has no read policy and the review panel offered no file.
-- Decided with the user (2026-10-03): while the scanner that would make safe
-- previews is not deployed, a reviewer may open the raw quarantined file through
-- a five-minute signed URL served from the Storage domain, never the app origin.
--
-- This function is the authorisation and the audit. The server calls it with the
-- member's own session; only when it returns does the server sign the object with
-- the service role. It never reads, copies or returns file content.
--
-- Reviewer scope is the one public.approve_winning_claim_and_fulfill and
-- public.record_claim_review use: Owner, Platform Sheriff, or an Institution
-- Sheriff of the claim's institution, and never the claim's own Hunter. Restricted
-- claims stay openable: a Sheriff handling a report needs the file as evidence.

create function public.review_claim_file_access(target_claim_id uuid, target_purpose text)
returns table (bucket text, object_key text, file_name text, mime_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  v_claim public.claims%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if target_purpose is null or target_purpose not in ('view', 'download') then
    raise exception using errcode = '22023', message = 'claim_file_purpose_invalid';
  end if;

  select * into v_claim
  from public.claims c
  where c.id = target_claim_id
    and c.status in (
      'screening', 'needs_information', 'under_review', 'approved', 'rejected', 'not_selected'
    );

  if not found then
    raise exception using errcode = 'P0002', message = 'claim_file_not_found';
  end if;

  if v_claim.hunter_user_id = actor_id or not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(v_claim.institution_id)
  ) then
    raise exception using errcode = '42501', message = 'claim_file_reviewer_not_authorized';
  end if;

  insert into public.identity_audit_events (
    event_type, actor_user_id, subject_user_id, institution_id, details
  )
  values (
    case target_purpose when 'view' then 'claim.file_viewed' else 'claim.file_downloaded' end,
    actor_id,
    v_claim.hunter_user_id,
    v_claim.institution_id,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'purpose', target_purpose,
      'claim_status', v_claim.status::text
    )
  );

  return query
  select v_claim.bucket, v_claim.object_key, v_claim.file_name, v_claim.mime_type;
end;
$$;

revoke all on function public.review_claim_file_access(uuid, text) from public, anon;
grant execute on function public.review_claim_file_access(uuid, text) to authenticated;
