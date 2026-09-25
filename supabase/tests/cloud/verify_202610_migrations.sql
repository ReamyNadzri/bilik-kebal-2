with checks(check_name, ok, detail) as (
  select 'migrations recorded',
    count(*) = 4,
    string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations
  where version in ('202610100001', '202610100002', '202610100003', '202610100004')

  union all
  select 'pg_cron installed',
    exists (select 1 from pg_extension where extname = 'pg_cron'),
    null

  union all
  select 'cron: wanted-thread-retention (daily)',
    exists (select 1 from cron.job where jobname = 'wanted-thread-retention' and active),
    (select schedule from cron.job where jobname = 'wanted-thread-retention')

  union all
  select 'cron: account-timeout-lift (every minute)',
    exists (select 1 from cron.job where jobname = 'account-timeout-lift' and active),
    (select schedule from cron.job where jobname = 'account-timeout-lift')

  union all
  select 'cron: last runs succeeded',
    not exists (
      select 1 from cron.job_run_details d
      join cron.job j on j.jobid = d.jobid
      where j.jobname in ('wanted-thread-retention', 'account-timeout-lift')
        and d.status = 'failed'
        and d.start_time > now() - interval '1 day'
    ),
    (select string_agg(distinct d.return_message, ' | ')
     from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where j.jobname in ('wanted-thread-retention', 'account-timeout-lift')
       and d.status = 'failed' and d.start_time > now() - interval '1 day')

  union all
  select 'wanted_requests thread columns',
    (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'wanted_requests'
       and column_name in ('thread_closed_at', 'thread_last_activity_at', 'thread_reply_count',
                           'thread_auto_closed', 'thread_purged_at', 'vanished_at')) = 6,
    null

  union all
  select 'wanted_replies edit/delete/hide columns',
    (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'wanted_replies'
       and column_name in ('parent_reply_id', 'edited_at', 'deleted_at', 'hidden_by', 'hidden_reason')) = 5,
    null

  union all
  select 'account_restrictions.expires_at',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'account_restrictions'
              and column_name = 'expires_at'),
    null

  union all
  select 'badges tables',
    to_regclass('public.badges') is not null and to_regclass('public.badge_awards') is not null,
    null

  union all
  select 'badges bucket (public, png/webp, 256 KB)',
    exists (select 1 from storage.buckets
            where id = 'badges' and public and file_size_limit = 262144),
    null

  union all
  select 'service_role can read wanted_replies (the "Replies could not be loaded" fix)',
    has_table_privilege('service_role', 'public.wanted_replies', 'select'),
    null

  union all
  select 'RLS on new tables',
    (select bool_and(relrowsecurity) from pg_class
     where oid in ('public.badges'::regclass, 'public.badge_awards'::regclass,
                   'public.wanted_replies'::regclass)),
    null

  union all
  select 'new functions exist',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'post_wanted_reply', 'edit_own_wanted_reply', 'delete_own_wanted_reply',
       'set_wanted_reply_hidden', 'reopen_own_community_wanted', 'timeout_account',
       'lift_account_restriction', 'console_my_role', 'console_search_members',
       'console_rename_member', 'console_reset_member_avatar', 'console_set_sheriff',
       'console_set_institution_verification', 'console_timeout_member',
       'console_restrict_member', 'console_lift_member_restriction',
       'console_list_hidden_replies', 'create_badge', 'retire_badge', 'set_member_badge'
     )) = 20,
    null

  union all
  select 'old 2-argument post_wanted_reply removed',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'post_wanted_reply' and p.pronargs = 2),
    null

  union all
  select 'anon cannot run console functions',
    not has_function_privilege('anon', 'public.console_search_members(text, integer)', 'execute'),
    null

  union all
  select 'academic link rule blocks a URL',
    private.text_contains_contact_or_link('see https://drive.google.com/x')
      and not private.text_contains_contact_or_link('Which chapter, part 3.2?'),
    null

  union all
  select 'an Owner is assigned',
    exists (select 1 from public.platform_role_assignments where role = 'owner'),
    (select string_agg(u.email, ', ') from public.platform_role_assignments r
     join auth.users u on u.id = r.user_id where r.role = 'owner')

  union all
  select 'backfill: closed Wanteds have a thread clock',
    not exists (select 1 from public.wanted_requests
                where status in ('closed', 'fulfilled', 'expired') and thread_closed_at is null),
    (select count(*)::text || ' closed Wanteds' from public.wanted_requests
     where status in ('closed', 'fulfilled', 'expired'))
)
select case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
from checks
order by ok, check_name;

-- Read-only check for migrations 202610100001, 202610100002, 202610100003 and
-- 202610100004. Paste the whole file into the Supabase SQL editor, click in
-- the editor without selecting any text, and press Run. It changes nothing.
