-- Read-only export for scripts/import-users-to-clerk.mjs (Clerk migration, slice 5).
--
-- The result contains bcrypt password hashes. Treat the downloaded file as a secret: keep it
-- outside the repository, never commit or share it, and delete it once the import is done.
--
-- Supabase SQL editor: run, then copy the single `users` cell into a .json file.
select coalesce(json_agg(row_to_json(export) order by export.created_at), '[]'::json) as users
from (
  select
    u.id,
    u.email::text as email,
    u.encrypted_password::text as encrypted_password,
    u.email_confirmed_at,
    p.display_name,
    u.created_at
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where u.deleted_at is null
) export;
