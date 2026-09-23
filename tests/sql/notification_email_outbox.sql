begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('97000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outbox-hunter@example.test', '', now(), '{}', '{}', now(), now());

set local role service_role;
select public.enqueue_notification('98000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000001', 'claim_approved', '99000000-0000-4000-8000-000000000001');
select public.enqueue_notification('98000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-000000000001', 'claim_approved', '99000000-0000-4000-8000-000000000001');
reset role;
select is((select count(*) from private.notification_email_outbox), 1::bigint, 'notification insert creates one idempotent email job');

set local role anon;
select throws_ok($$select * from public.claim_notification_email_batch()$$, '42501', null, 'anonymous cannot lease email work');
select throws_ok($$select public.mark_notification_email_sent('98000000-0000-4000-8000-000000000001', gen_random_uuid(), 'fake')$$, '42501', null, 'anonymous cannot acknowledge email work');
reset role;

set local role service_role;
create temporary table first_claim on commit drop as
select * from public.claim_notification_email_batch(10);
select is((select count(*) from first_claim), 1::bigint, 'worker leases a due notification');
select is((select recipient_email from first_claim), 'outbox-hunter@example.test', 'worker resolves recipient only at delivery boundary');
select is((select count(*) from public.claim_notification_email_batch(10)), 0::bigint, 'active lease prevents duplicate worker delivery');
select is(public.record_notification_email_failure(
  '98000000-0000-4000-8000-000000000001',
  (select lease_token from first_claim),
  'provider_unavailable', true
), 'queued', 'transient failure is scheduled for bounded retry');
reset role;

update private.notification_email_outbox set available_at = now() where notification_id = '98000000-0000-4000-8000-000000000001';
set local role service_role;
create temporary table second_claim on commit drop as
select * from public.claim_notification_email_batch(10);
select is((select attempt from second_claim), 2, 'retry increments the attempt number');
select is(public.mark_notification_email_sent(
  '98000000-0000-4000-8000-000000000001',
  (select lease_token from second_claim),
  'resend_test_123'
), true, 'matching lease can record provider acceptance');
select is(public.mark_notification_email_sent(
  '98000000-0000-4000-8000-000000000001',
  (select lease_token from second_claim),
  'resend_test_456'
), false, 'replayed acknowledgement cannot rewrite a sent job');
reset role;
select is((select state::text from private.notification_email_outbox), 'sent', 'successful job is terminal');

select * from finish();
rollback;
