\set ON_ERROR_STOP 1
-- Migration 202610200006: the Owner, a Platform Sheriff and an Institution Sheriff
-- of the claim's institution may open a claim's file for review, and each opening
-- is audited. A Sheriff of another institution, the Hunter, the poster and a
-- signed-out caller may not; anon cannot execute the function at all.
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','poster@x.test',now()),
 ('00000000-0000-0000-0000-00000000000b','hunter@x.test',now()),
 ('00000000-0000-0000-0000-00000000000c','owner@x.test',now()),
 ('00000000-0000-0000-0000-00000000000d','platform@x.test',now()),
 ('00000000-0000-0000-0000-00000000000e','local@x.test',now()),
 ('00000000-0000-0000-0000-00000000000f','other@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000000a','Poster'),('00000000-0000-0000-0000-00000000000b','Hunter'),
 ('00000000-0000-0000-0000-00000000000c','Owner'),('00000000-0000-0000-0000-00000000000d','Platform Sheriff'),
 ('00000000-0000-0000-0000-00000000000e','Local Sheriff'),('00000000-0000-0000-0000-00000000000f','Other Sheriff')
 on conflict do nothing;
insert into public.platform_role_assignments (user_id, role) values
 ('00000000-0000-0000-0000-00000000000c','owner'),
 ('00000000-0000-0000-0000-00000000000d','platform_sheriff');
insert into public.institutions (id, slug, name) values
 ('10000000-0000-0000-0000-000000000001','uitm','UiTM'),
 ('10000000-0000-0000-0000-000000000002','um','UM');
insert into public.campuses (id, institution_id, slug, name) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','shah-alam','UiTM Shah Alam');
insert into public.institution_role_assignments (user_id, institution_id, role) values
 ('00000000-0000-0000-0000-00000000000e','10000000-0000-0000-0000-000000000001','institution_sheriff'),
 ('00000000-0000-0000-0000-00000000000f','10000000-0000-0000-0000-000000000002','institution_sheriff');
-- Claiming a Wanted with a bounty needs payment details (migration 202610180001).
insert into private.member_payment_details (user_id, phone_e164, bank_code, account_holder_name, account_number)
values ('00000000-0000-0000-0000-00000000000b', '+60123456789', 'maybank', 'Hunter Test', '1234567890');
alter table public.wanted_requests drop constraint wanted_requests_kind_fields_check;
insert into public.wanted_requests (public_id, commissioner_user_id, institution_id, campus_id, kind, is_free, title, description,
  requested_duration_days, status, duration_days_snapshot, fee_rate_basis_points_snapshot, policy_version_snapshot,
  access_basis_snapshot, policy_accepted_at, published_at, closes_at)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', 'academic', false, 'Past year papers for MAT183', 'A description that is long enough.',
  14, 'open', 14, 1000, '2026-09-13', 'contributors_only', now(), now() - interval '1 hour', now() + interval '14 days');
insert into public.claims (id, wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
select '40000000-0000-0000-0000-000000000001', w.id, '00000000-0000-0000-0000-00000000000b', w.institution_id,
  'notes.pdf', 'application/pdf', 10, decode(repeat('aa', 32), 'hex'), 'claims/k-one', now()
from public.wanted_requests w where w.public_id = '30000000-0000-0000-0000-000000000001';
insert into public.claims (id, wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, rights_confirmed_at)
select '40000000-0000-0000-0000-000000000002', w.id, '00000000-0000-0000-0000-00000000000b', w.institution_id,
  'draft.pdf', 'application/pdf', 10, decode(repeat('bb', 32), 'hex'), 'claims/k-two', now()
from public.wanted_requests w where w.public_id = '30000000-0000-0000-0000-000000000001';
update public.claims set status = 'under_review' where id = '40000000-0000-0000-0000-000000000001';
-- The second claim stays 'uploading': no file has arrived yet.

create function pg_temp.audits(p_actor uuid) returns bigint language sql as $$
  select count(*) from public.identity_audit_events
  where actor_user_id = p_actor and event_type in ('claim.file_viewed', 'claim.file_downloaded') $$;

do $$
declare
  claim_id constant uuid := '40000000-0000-0000-0000-000000000001';
  uploading_id constant uuid := '40000000-0000-0000-0000-000000000002';
  poster constant uuid := '00000000-0000-0000-0000-00000000000a';
  hunter constant uuid := '00000000-0000-0000-0000-00000000000b';
  owner_id constant uuid := '00000000-0000-0000-0000-00000000000c';
  platform constant uuid := '00000000-0000-0000-0000-00000000000d';
  local_sheriff constant uuid := '00000000-0000-0000-0000-00000000000e';
  other_sheriff constant uuid := '00000000-0000-0000-0000-00000000000f';
  row record;
  audit record;
begin
  assert not has_function_privilege('anon', 'public.review_claim_file_access(uuid, text)', 'execute'), 'anon may execute';
  assert has_function_privilege('authenticated', 'public.review_claim_file_access(uuid, text)', 'execute'), 'members may not execute';

  -- Owner: allowed, one audit row naming the claim, purpose and institution.
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select * into row from public.review_claim_file_access(claim_id, 'view');
  assert row.bucket = 'quarantine' and row.object_key = 'claims/k-one', 'owner gets the object';
  assert row.file_name = 'notes.pdf' and row.mime_type = 'application/pdf', 'owner gets the file facts';
  select * into audit from public.identity_audit_events where actor_user_id = owner_id order by id desc limit 1;
  assert audit.event_type = 'claim.file_viewed', 'view audited: ' || audit.event_type;
  assert audit.subject_user_id = hunter, 'subject is the Hunter';
  assert audit.institution_id = '10000000-0000-0000-0000-000000000001', 'institution recorded';
  assert audit.details ->> 'claim_id' = claim_id::text and audit.details ->> 'purpose' = 'view', 'details recorded';
  assert not (audit.details ? 'object_key'), 'no object key in the audit';

  -- Platform Sheriff: allowed; a download is audited as such.
  perform set_config('request.jwt.claim.sub', platform::text, true);
  select * into row from public.review_claim_file_access(claim_id, 'download');
  assert row.object_key = 'claims/k-one', 'platform sheriff gets the object';
  assert (select event_type from public.identity_audit_events where actor_user_id = platform order by id desc limit 1)
    = 'claim.file_downloaded', 'download audited';

  -- Institution Sheriff of the claim's institution: allowed.
  perform set_config('request.jwt.claim.sub', local_sheriff::text, true);
  select * into row from public.review_claim_file_access(claim_id, 'view');
  assert row.object_key = 'claims/k-one', 'local sheriff gets the object';
  assert pg_temp.audits(local_sheriff) = 1, 'local sheriff audited once';

  -- A decided claim stays openable for its reviewers.
  update public.claims set status = 'rejected' where id = claim_id;
  select * into row from public.review_claim_file_access(claim_id, 'download');
  assert row.object_key = 'claims/k-one', 'rejected claim still openable';
  update public.claims set status = 'under_review' where id = claim_id;

  -- An unknown purpose is refused and not audited.
  begin perform public.review_claim_file_access(claim_id, 'preview'); raise exception 'odd purpose accepted';
  exception when invalid_parameter_value then assert sqlerrm = 'claim_file_purpose_invalid', sqlerrm; end;
  assert pg_temp.audits(local_sheriff) = 2, 'refusal not audited';

  -- A claim still uploading has no file to open.
  begin perform public.review_claim_file_access(uploading_id, 'view'); raise exception 'uploading claim opened';
  exception when no_data_found then assert sqlerrm = 'claim_file_not_found', sqlerrm; end;

  -- Institution Sheriff of another institution: refused, not audited.
  perform set_config('request.jwt.claim.sub', other_sheriff::text, true);
  begin perform public.review_claim_file_access(claim_id, 'view'); raise exception 'other sheriff opened';
  exception when insufficient_privilege then assert sqlerrm = 'claim_file_reviewer_not_authorized', sqlerrm; end;
  assert pg_temp.audits(other_sheriff) = 0, 'other sheriff not audited';

  -- The Hunter and the poster: refused.
  perform set_config('request.jwt.claim.sub', hunter::text, true);
  begin perform public.review_claim_file_access(claim_id, 'download'); raise exception 'hunter opened';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', poster::text, true);
  begin perform public.review_claim_file_access(claim_id, 'download'); raise exception 'poster opened';
  exception when insufficient_privilege then null; end;
  assert pg_temp.audits(hunter) = 0 and pg_temp.audits(poster) = 0, 'refusals not audited';

  -- A Sheriff who is the claim's own Hunter is refused, as in the review RPCs.
  insert into public.institution_role_assignments (user_id, institution_id, role)
  values (hunter, '10000000-0000-0000-0000-000000000001', 'institution_sheriff');
  perform set_config('request.jwt.claim.sub', hunter::text, true);
  begin perform public.review_claim_file_access(claim_id, 'view'); raise exception 'own claim opened';
  exception when insufficient_privilege then null; end;

  -- Signed out.
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.review_claim_file_access(claim_id, 'view'); raise exception 'signed out opened';
  exception when invalid_authorization_specification then null; end;

  raise notice 'claim_file_review_access: ok';
end $$;
rollback;
