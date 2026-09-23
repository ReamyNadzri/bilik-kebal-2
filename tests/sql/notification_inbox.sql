begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('93000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inbox-one@example.test', '', now(), '{}', '{}', now(), now()),
('93000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inbox-two@example.test', '', now(), '{}', '{}', now(), now());

select is((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), true, 'inbox RLS enabled');

set local role service_role;
select lives_ok($$select public.enqueue_notification('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'claim_approved', '95000000-0000-4000-8000-000000000001')$$, 'trusted event ingestion');
select lives_ok($$select public.enqueue_notification('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'claim_approved', '95000000-0000-4000-8000-000000000001')$$, 'repeated event is accepted');
select throws_ok($$select public.enqueue_notification('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'claim_rejected', '95000000-0000-4000-8000-000000000001')$$, '22023', 'NOTIFICATION_EVENT_CONFLICT', 'conflicting event replay rejected');
reset role;
select is((select count(*) from public.notifications), 1::bigint, 'event replay creates one notification');
insert into public.platform_role_assignments(user_id, role) values ('93000000-0000-4000-8000-000000000002', 'owner');

set local role anon;
select throws_ok($$select * from public.notifications$$, '42501', null, 'anonymous cannot read inbox');
select throws_ok($$select public.list_notifications()$$, '42501', null, 'anonymous cannot list through RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.notifications), 0::bigint, 'even Owner cannot read another recipient inbox');
select is(jsonb_array_length(public.list_notifications()), 0, 'RPC does not leak other recipients');
select throws_ok($$select public.enqueue_notification('94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', 'claim_approved', '95000000-0000-4000-8000-000000000001')$$, '42501', null, 'authenticated cannot forge events');

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
select is(jsonb_array_length(public.list_notifications()), 1, 'recipient can read inbox');
select throws_ok($$update public.notifications set kind = 'refund_recorded'$$, '42501', null, 'recipient cannot rewrite content');
select throws_ok($$select public.list_notifications(51)$$, '22023', 'VALIDATION_ERROR', 'bounded page size');
select is(public.mark_notification_read((public.list_notifications()->0->>'id')::uuid), true, 'recipient can mark read');
reset role;
create temp table first_read as select read_at from public.notifications;
set local role authenticated;
select public.mark_notification_read((public.list_notifications()->0->>'id')::uuid);
reset role;
select is((select read_at from public.notifications), (select read_at from first_read), 'mark-read retry preserves timestamp');
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
select is(public.mark_notification_read('95000000-0000-4000-8000-000000000001'), false, 'unknown identifier does not succeed');
reset role;
select set_config('test.notification_id', (select id::text from public.notifications), true);
set local role authenticated;
select is(public.mark_notification_read(current_setting('test.notification_id')::uuid), false, 'another recipient cannot mark read');

select * from finish();
rollback;
