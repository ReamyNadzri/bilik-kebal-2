-- The caller's own identity (docs/superpowers/plans/2026-09-29-clerk-auth-migration.md, slice 3).
--
-- A Supabase client that sends a Clerk token has no Supabase Auth API, so the server reads the
-- signed-in member here instead of from auth.getUser(). Works for Clerk and transitional
-- Supabase Auth sessions alike (private.current_user_id). No row means signed out or a Clerk
-- account the webhook has not provisioned yet.

create function public.current_identity()
returns table (
  user_id uuid,
  public_id uuid,
  email text,
  email_verified_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.public_id, i.email, i.email_verified_at, p.created_at
  from public.profiles p
  left join private.user_identities i on i.user_id = p.user_id
  where p.user_id = private.current_user_id();
$$;

revoke all on function public.current_identity() from public, anon;
grant execute on function public.current_identity() to authenticated;
