begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- All rows are synthetic and this entire test is rolled back.
do $$
declare
  scope_id uuid := '96000000-0000-4000-8000-000000000001';
  hunter_id uuid := '96000000-0000-4000-8000-000000000002';
  sheriff_id uuid := '96000000-0000-4000-8000-000000000003';
  second_hunter_id uuid := '96000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (hunter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-hunter@example.test', now(), now(), '{}', '{}', now(), now()),
    (sheriff_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-sheriff@example.test', now(), now(), '{}', '{}', now(), now()),
    (second_hunter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-hunter-two@example.test', now(), now(), '{}', '{}', now(), now());
  insert into public.platform_role_assignments(user_id, role) values (sheriff_id, 'platform_sheriff');
  insert into public.institutions(id, slug, name) values (scope_id, 'notification-test', 'Notification Test');
  insert into public.campuses(id, institution_id, slug, name) values (scope_id, scope_id, 'notification-test', 'Notification Test');
  insert into public.faculties(id, institution_id, slug, name) values (scope_id, scope_id, 'notification-test', 'Notification Test');
  insert into public.programmes(id, institution_id, faculty_id, slug, name) values (scope_id, scope_id, scope_id, 'notification-test', 'Notification Test');
  insert into public.courses(id, institution_id, programme_id, slug, code, name) values (scope_id, scope_id, scope_id, 'notification-test', 'NT101', 'Notification Test');
  insert into public.academic_sessions(id, institution_id, slug, name) values (scope_id, scope_id, 'notification-test', 'Notification Test');
  insert into public.resource_types(id, slug, name) values (scope_id, 'notification-test', 'Notification Test');
  insert into public.languages(id, slug, name) values (scope_id, 'notification-test', 'Notification Test');
  insert into public.wanted_requests(id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id, academic_session_id, resource_type_id, language_id, title, description, requested_duration_days, policy_accepted_at)
  values (scope_id, hunter_id, scope_id, scope_id, scope_id, scope_id, scope_id, scope_id, scope_id, scope_id, 'Notification test request', 'Synthetic notification test request description.', 7, now());
  insert into public.claims(id, wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, status, rights_confirmed_at)
  values (scope_id, scope_id, hunter_id, scope_id, 'notes.pdf', 'application/pdf', 100, decode(repeat('ab', 32), 'hex'), 'notification-test/claim', 'under_review', now());
  insert into public.claims(id, wanted_request_id, hunter_user_id, institution_id, file_name, mime_type, size_bytes, sha256, object_key, status, rights_confirmed_at)
  values ('96000000-0000-4000-8000-000000000005', scope_id, second_hunter_id, scope_id, 'second-notes.pdf', 'application/pdf', 100, decode(repeat('cd', 32), 'hex'), 'notification-test/claim-two', 'under_review', now());
end;
$$;
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002'), 0::bigint, 'creating a claim does not announce approval');

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.record_claim_review('96000000-0000-4000-8000-000000000001', 'approve', 'valid', null)$$, '42501', null, 'hunter cannot publish an approval by reviewing own claim');
select is(jsonb_array_length(public.list_notifications()), 0, 'failed review produces no notification');
select throws_ok($$select private.publish_claim_review_notification()$$, '42501', null, 'browser cannot invoke publisher directly');

select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000003', true);
select public.record_claim_review('96000000-0000-4000-8000-000000000001', 'request_information', 'clarify_rights', 'PRIVATE REVIEW NOTES');
reset role;
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002' and kind = 'claim_information_requested'), 1::bigint, 'request information emits one hunter notification');
select is((select count(*) from public.notifications n join public.claim_reviews r on n.event_id = r.id where r.claim_id = '96000000-0000-4000-8000-000000000001'), 1::bigint, 'review UUID is stable event key');
select ok(not exists(select 1 from public.notifications n where to_jsonb(n)::text like '%PRIVATE REVIEW NOTES%'), 'review notes never enter notifications');

savepoint rejected_review;
set local role authenticated;
select public.record_claim_review('96000000-0000-4000-8000-000000000001', 'reject', 'invalid', null);
reset role;
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002' and kind = 'claim_rejected'), 1::bigint, 'reject emits notification in the review transaction');
-- Preserve pgTAP results across the savepoint by checking rollback in a separate
-- subtransaction below rather than rolling back pgTAP's own result state.
release savepoint rejected_review;
do $$
begin
  begin
    insert into public.claim_reviews(claim_id, reviewer_user_id, decision, reason_code)
    values ('96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000003', 'approve', 'valid');
    raise exception 'rollback probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback probe' then raise; end if;
  end;
end;
$$;
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002' and kind = 'claim_approved'), 0::bigint, 'rolled back approval cannot leave notification');

set local role authenticated;
select public.restrict_account('96000000-0000-4000-8000-000000000002', 'test_restriction');
select public.restrict_account('96000000-0000-4000-8000-000000000002', 'test_restriction');
reset role;
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002' and kind = 'account_restricted'), 1::bigint, 'restriction retries produce one notification');
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000003'), 0::bigint, 'notifications go to the subject, not the actor');
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true);
select is(jsonb_array_length(public.list_notifications()), 3, 'restricted recipient can still read their notices');
reset role;

update public.claims set status = 'not_selected'
where id = '96000000-0000-4000-8000-000000000005';
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000004' and kind = 'claim_not_selected'), 1::bigint, 'not-selected claim emits one notification to its hunter');

insert into public.institution_verification_requests(id, user_id, institution_id, evidence_object_path, evidence_delete_after)
values
  ('96000000-0000-4000-8000-000000000006', '96000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000002/evidence.pdf', now() + interval '30 days'),
  ('96000000-0000-4000-8000-000000000007', '96000000-0000-4000-8000-000000000004', '96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000004/evidence.pdf', now() + interval '30 days');
update public.institution_verification_requests
set state = 'approved', decision_reason_code = 'valid_evidence', reviewed_by = '96000000-0000-4000-8000-000000000003', reviewed_at = now()
where id = '96000000-0000-4000-8000-000000000006';
update public.institution_verification_requests
set state = 'rejected', decision_reason_code = 'invalid_evidence', reviewed_by = '96000000-0000-4000-8000-000000000003', reviewed_at = now()
where id = '96000000-0000-4000-8000-000000000007';
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000002' and kind = 'institution_verification_approved'), 1::bigint, 'approved institution request notifies the applicant');
select is((select count(*) from public.notifications where recipient_user_id = '96000000-0000-4000-8000-000000000004' and kind = 'institution_verification_rejected'), 1::bigint, 'rejected institution request notifies its applicant');
select is((select count(*) from private.notification_email_outbox where notification_id in (select id from public.notifications where event_id in ('96000000-0000-4000-8000-000000000005', '96000000-0000-4000-8000-000000000006', '96000000-0000-4000-8000-000000000007'))), 3::bigint, 'critical identity and claim notices each enqueue one email');
select * from finish(true);
rollback;
