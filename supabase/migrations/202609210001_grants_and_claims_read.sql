-- Grants for service_role, authenticated, and anon across public schema
grant usage on schema public to anon, authenticated, service_role;

-- Ensure service_role has full access for admin and background operations
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Allow reading public wanted requests and taxonomy
grant select on public.wanted_requests to authenticated, anon;
grant select on public.wanted_request_tags to authenticated, anon;
grant select on public.campuses to authenticated, anon;
grant select on public.faculties to authenticated, anon;
grant select on public.programmes to authenticated, anon;
grant select on public.courses to authenticated, anon;
grant select on public.academic_sessions to authenticated, anon;
grant select on public.resource_types to authenticated, anon;
grant select on public.languages to authenticated, anon;
grant select on public.tags to authenticated, anon;

-- Claims permissions for authenticated hunters
grant select, insert on public.claims to authenticated;
grant select, insert on public.claim_upload_sessions to authenticated;

-- RLS policies for reading own claims
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'claims' and policyname = 'claims_read_own'
  ) then
    create policy claims_read_own on public.claims for select to authenticated
    using (hunter_user_id = auth.uid());
  end if;
end $$;
