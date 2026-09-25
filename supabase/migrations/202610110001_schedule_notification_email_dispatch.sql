-- Notification emails were queued in private.notification_email_outbox but
-- nothing ever asked the web app to send them. Supabase Cron now does, once a
-- minute, and only when at least one job is due, so an idle minute costs no
-- request to Vercel.
--
-- The endpoint and its secret live in Supabase Vault, never in a migration:
--   select vault.create_secret('https://<origin>/api/internal/notifications/email', 'notification_dispatch_url');
--   select vault.create_secret('<32+ random characters>', 'notification_dispatch_secret');
-- The same secret is NOTIFICATION_DISPATCH_SECRET in Vercel. It is not the
-- service-role key, so nothing here can bypass RLS if it leaks.
--
-- Queued jobs older than 14 minutes are moved to manual review by the first
-- batch instead of being sent late (see claim_notification_email_batch).

create function private.request_notification_email_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint text;
  secret text;
begin
  if not exists (
    select 1
    from private.notification_email_outbox o
    where o.state in ('queued', 'leased')
      and o.available_at <= now()
      and (o.state = 'queued' or o.lease_expires_at <= now())
  ) then
    return null;
  end if;

  select s.decrypted_secret into endpoint
  from vault.decrypted_secrets s where s.name = 'notification_dispatch_url';
  select s.decrypted_secret into secret
  from vault.decrypted_secrets s where s.name = 'notification_dispatch_secret';
  if endpoint is null or secret is null then
    raise warning 'notification email dispatch is not configured in Vault';
    return null;
  end if;

  return net.http_post(
    url := endpoint,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function private.request_notification_email_dispatch() from public, anon, authenticated;

-- Every minute. Skipped where pg_cron or pg_net is absent, such as the stubbed
-- local Postgres used to check the migration chain.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create extension if not exists pg_net with schema extensions;
    execute $cron$
      select cron.schedule(
        'notification-email-dispatch',
        '* * * * *',
        'select private.request_notification_email_dispatch()'
      )
    $cron$;
  else
    raise notice 'pg_cron or pg_net is not available; notification-email-dispatch was not scheduled';
  end if;
end;
$$;
