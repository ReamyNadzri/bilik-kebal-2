with checks(check_name, ok, detail) as (
  select 'migration recorded',
    exists (select 1 from supabase_migrations.schema_migrations where version = '202610160001'),
    null

  union all
  select 'no function depends on auth.uid()',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname in ('public', 'private') and p.prosrc ~ 'auth\.uid\s*\('),
    (select string_agg(n.nspname || '.' || p.proname, ', ') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosrc ~ 'auth\.uid\s*\(')

  union all
  select 'no policy depends on auth.uid()',
    not exists (select 1 from pg_policies where schemaname in ('public', 'storage')
                and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\s*\('),
    (select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ') from pg_policies
     where schemaname in ('public', 'storage')
       and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\s*\(')

  union all
  select 'every profile has an identity row',
    not exists (select 1 from public.profiles p
                where not exists (select 1 from private.user_identities i where i.user_id = p.user_id)),
    (select count(*)::text || ' profiles without one' from public.profiles p
     where not exists (select 1 from private.user_identities i where i.user_id = p.user_id))

  union all
  select 'identities are private',
    not has_table_privilege('authenticated', 'private.user_identities', 'select')
      and not has_table_privilege('anon', 'private.user_identities', 'select'),
    null

  union all
  select 'profiles no longer reference auth.users',
    not exists (select 1 from pg_constraint where conname = 'profiles_user_id_fkey'),
    null

  union all
  select 'sync trigger on auth.users',
    exists (select 1 from pg_trigger where tgname = 'auth_user_sync_identity' and not tgisinternal),
    null
)
select case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
from checks
order by ok, check_name;

-- Read-only check for migration 202610160001 (Clerk identity bridge). Paste the whole file
-- into the Supabase SQL editor, click in the editor without selecting any text, and press
-- Run. It changes nothing.
