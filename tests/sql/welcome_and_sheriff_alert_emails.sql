begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Synthetic rows only; the whole test is rolled back.
do $$
declare
  inst_a uuid := '97000000-0000-4000-8000-00000000000a';
  inst_b uuid := '97000000-0000-4000-8000-00000000000b';
  student uuid := '97000000-0000-4000-8000-000000000001';
  platform_sheriff uuid := '97000000-0000-4000-8000-000000000002';
  sheriff_a uuid := '97000000-0000-4000-8000-000000000003';
  sheriff_b uuid := '97000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-student@example.test', now(), '{}', '{"display_name":"Aina"}', now(), now()),
    (platform_sheriff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-ps@example.test', now(), '{}', '{"display_name":"PS"}', now(), now()),
    (sheriff_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-sa@example.test', now(), '{}', '{"display_name":"SA"}', now(), now()),
    (sheriff_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-sb@example.test', now(), '{}', '{"display_name":"SB"}', now(), now());
  insert into public.profiles(user_id, display_name) values
    (student, 'Aina'), (platform_sheriff, 'PS'), (sheriff_a, 'SA'), (sheriff_b, 'SB')
  on conflict (user_id) do update set display_name = excluded.display_name;
  insert into public.institutions(id, slug, name) values
    (inst_a, 'welcome-test-a', 'Welcome Test A'), (inst_b, 'welcome-test-b', 'Welcome Test B');
  insert into public.platform_role_assignments(user_id, role) values (platform_sheriff, 'platform_sheriff');
  insert into public.institution_role_assignments(user_id, institution_id, role) values
    (sheriff_a, inst_a, 'institution_sheriff'), (sheriff_b, inst_b, 'institution_sheriff');
end;
$$;

-- WELCOME seed
select is((select count(*) from public.reward_codes where upper(code) = 'WELCOME'), 1::bigint, 'exactly one WELCOME code exists');
select ok((select credits_per_redemption between 1 and 20 from public.reward_codes where upper(code) = 'WELCOME'), 'WELCOME grants free requests');
select ok((select active from public.reward_codes where upper(code) = 'WELCOME'), 'WELCOME is active');

-- Sheriff alert fan-out
insert into public.institution_verification_requests(id, user_id, institution_id, evidence_object_path, evidence_delete_after)
values ('97000000-0000-4000-8000-0000000000e1', '97000000-0000-4000-8000-000000000001', '97000000-0000-4000-8000-00000000000a', 'welcome-test/evidence', now() + interval '30 days');

-- Real platform Sheriffs may already exist, so the expected count includes them.
select is(
  (select count(*) from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and kind = 'institution_verification_submitted'),
  (select count(*) from (
     select user_id from public.platform_role_assignments where role = 'platform_sheriff'
     union
     select user_id from public.institution_role_assignments where role = 'institution_sheriff' and institution_id = '97000000-0000-4000-8000-00000000000a'
   ) s where s.user_id <> '97000000-0000-4000-8000-000000000001'),
  'every platform Sheriff and each matching institution Sheriff is alerted once');
select ok(exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000003'), 'institution A Sheriff alerted');
select ok(not exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000004'), 'other institution Sheriff not alerted');
select ok(not exists(select 1 from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1' and recipient_user_id = '97000000-0000-4000-8000-000000000001'), 'requester is never alerted');
select is(
  (select count(*) from private.notification_email_outbox o join public.notifications n on n.id = o.notification_id where n.event_id = '97000000-0000-4000-8000-0000000000e1'),
  (select count(*) from public.notifications where event_id = '97000000-0000-4000-8000-0000000000e1'),
  'each alert is queued for email');

-- Welcome on first confirmation only. A fresh, unconfirmed user: the profile is
-- created by auth_user_created_create_profile, and nothing is welcomed yet.
insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('97000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'welcome-new@example.test', null, '{}', '{"display_name":"New"}', now(), now());
update auth.users set email_confirmed_at = now() where id = '97000000-0000-4000-8000-000000000005';
select is((select count(*) from public.notifications where kind = 'welcome' and recipient_user_id = '97000000-0000-4000-8000-000000000005'), 1::bigint, 'welcome enqueued on first confirmation');
update auth.users set email_confirmed_at = now() + interval '1 second', updated_at = now() where id = '97000000-0000-4000-8000-000000000005';
select is((select count(*) from public.notifications where kind = 'welcome' and recipient_user_id = '97000000-0000-4000-8000-000000000005'), 1::bigint, 'later updates do not re-welcome');

-- Batch context is allow-listed. Claim once into a temp table so every row is seen.
create temp table claimed on commit drop as select * from public.claim_notification_email_batch(50);
select is(
  (select notification_context from claimed where notification_kind = 'institution_verification_submitted' limit 1),
  '{"requesterDisplayName":"Aina","institutionName":"Welcome Test A"}'::jsonb,
  'alert context carries only display name and institution name');
select ok(
  not exists(select 1 from claimed where notification_context::text like '%evidence%'),
  'no evidence path in any context');
select is(
  (select notification_context from claimed where notification_kind = 'welcome' limit 1),
  (select jsonb_build_object('welcomeCodeCredits', credits_per_redemption) from public.reward_codes
   where upper(code) = 'WELCOME' and active and (expires_at is null or expires_at > now()) and redemption_count < max_redemptions),
  'welcome context carries the live WELCOME credits, or null when the code cannot be redeemed');

set local role authenticated;
select throws_ok($$select * from public.claim_notification_email_batch(1)$$, '42501', null, 'browsers cannot claim email jobs');
reset role;

select * from finish();
rollback;
