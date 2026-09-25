\set ON_ERROR_STOP 1
begin;
-- Stand-ins for Supabase Vault and pg_net: record the request instead of sending it.
create schema if not exists vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
create schema if not exists net;
create table net.sent (url text, body jsonb, headers jsonb, timeout_milliseconds integer);
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer)
returns bigint language sql as $$
  insert into net.sent values (url, body, headers, timeout_milliseconds);
  select count(*) from net.sent;
$$;
-- Unconfirmed, so the welcome trigger queues nothing before the test starts.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a','a@x.test');
insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000000a','Member') on conflict do nothing;
do $$
begin
  assert (select count(*) = 0 from private.notification_email_outbox), 'starts empty';
  -- Nothing due: no request, even before Vault is configured.
  assert private.request_notification_email_dispatch() is null, 'idle minute sends nothing';
  assert (select count(*) = 0 from net.sent), 'no request when idle';

  perform public.enqueue_notification(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'welcome', gen_random_uuid());
  assert (select count(*) = 1 from private.notification_email_outbox), 'queued';

  -- Due but not configured: no request.
  assert private.request_notification_email_dispatch() is null, 'unconfigured';
  assert (select count(*) = 0 from net.sent), 'no request without Vault secrets';

  insert into vault.decrypted_secrets values
    ('notification_dispatch_url', 'https://vaultix.example/api/internal/notifications/email'),
    ('notification_dispatch_secret', 'a-dispatch-secret-of-at-least-32-characters');
  assert private.request_notification_email_dispatch() is not null, 'dispatched';
  assert (select url = 'https://vaultix.example/api/internal/notifications/email'
            and headers ->> 'Authorization' = 'Bearer a-dispatch-secret-of-at-least-32-characters'
          from net.sent), 'bearer secret sent to the configured endpoint';

  -- A job leased by a running batch is not due again until its lease lapses.
  update private.notification_email_outbox
  set state = 'leased', lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes';
  assert private.request_notification_email_dispatch() is null, 'leased job is not due';

  -- Members cannot trigger it.
  assert not has_function_privilege('authenticated', 'private.request_notification_email_dispatch()', 'execute'),
    'members cannot dispatch';
  raise notice 'ALL DISPATCH ASSERTIONS PASSED';
end $$;
rollback;
