\set ON_ERROR_STOP 1
begin;
-- A Clerk account has a profile and an identity row but no auth.users row.
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000c1','Clerk Hunter'),
 ('00000000-0000-0000-0000-0000000000c2','Clerk Unverified');
insert into private.user_identities (user_id, clerk_user_id, email, email_verified_at) values
 ('00000000-0000-0000-0000-0000000000c1','user_2ClerkHunter','hunter@student.uitm.edu.my',now()),
 ('00000000-0000-0000-0000-0000000000c2','user_2ClerkUnverified','late@student.uitm.edu.my',null);
-- A Supabase Auth account, provisioned and synced by the auth.users triggers.
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
 ('00000000-0000-0000-0000-0000000000c3','legacy@x.test',now(),now());
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-0000000000c9','uitm-clerk','UiTM Clerk');
insert into public.institution_email_domains (domain, institution_id) values ('student.uitm.edu.my','10000000-0000-0000-0000-0000000000c9');
do $$
declare
  changed integer;
begin
  -- nothing depends on auth.uid() any more
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.prosrc ~ 'auth\.uid\s*\('), 'auth.uid() in a function';
  assert not exists (select 1 from pg_policies where schemaname in ('public','storage')
    and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\.uid\s*\('), 'auth.uid() in a policy';

  -- the mapping table is private
  assert not has_table_privilege('authenticated', 'private.user_identities', 'select'), 'authenticated reads identities';
  assert not has_table_privilege('anon', 'private.user_identities', 'select'), 'anon reads identities';

  -- subject resolution
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","role":"authenticated"}', true);
  assert private.current_user_id() = '00000000-0000-0000-0000-0000000000c1', 'clerk subject';
  perform set_config('request.jwt.claims', '{"sub":"user_2NotProvisioned","role":"authenticated"}', true);
  assert private.current_user_id() is null, 'unprovisioned clerk subject';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  assert private.current_user_id() = '00000000-0000-0000-0000-0000000000c3', 'supabase auth subject';
  perform set_config('request.jwt.claims', '{"sub":"not-a-uuid","role":"authenticated"}', true);
  assert private.current_user_id() is null, 'malformed subject';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert private.current_user_id() is null, 'no subject';

  -- email verification comes from the identity row, for both kinds of account
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter"}', true);
  assert private.current_user_is_email_verified(), 'clerk verified';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkUnverified"}', true);
  assert not private.current_user_is_email_verified(), 'clerk unverified';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
  assert private.current_user_is_email_verified(), 'legacy verified via sync trigger';

  -- the 15-minute step-up window reads Clerk fva
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","fva":[3,-1]}', true);
  assert private.current_user_recently_authenticated(), 'fva 3';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","fva":[14,-1]}', true);
  assert private.current_user_recently_authenticated(), 'fva 14';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","fva":[15,-1]}', true);
  assert not private.current_user_recently_authenticated(), 'fva 15';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","fva":[-1,-1]}', true);
  assert not private.current_user_recently_authenticated(), 'fva never';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter"}', true);
  assert not private.current_user_recently_authenticated(), 'fva missing';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","fva":["3",-1]}', true);
  assert not private.current_user_recently_authenticated(), 'fva not a number';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
  assert private.current_user_recently_authenticated(), 'legacy last_sign_in_at';

  -- RLS: a Clerk caller changes only their own profile
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  update public.profiles set display_name = 'Renamed' where user_id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics changed = row_count;
  assert changed = 1, 'own profile update';
  update public.profiles set display_name = 'Hijacked' where user_id = '00000000-0000-0000-0000-0000000000c2';
  get diagnostics changed = row_count;
  assert changed = 0, 'other profile update';
  perform set_config('request.jwt.claims', '{"sub":"user_2NotProvisioned","role":"authenticated"}', true);
  update public.profiles set display_name = 'Nobody' where user_id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics changed = row_count;
  assert changed = 0, 'unprovisioned update';
  perform set_config('role', 'none', true);
  assert (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c2') = 'Clerk Unverified', 'other profile unchanged';

  -- domain verification reads the identity email
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkHunter","role":"authenticated"}', true);
  assert public.verify_own_institution_by_domain() = '10000000-0000-0000-0000-0000000000c9', 'domain verification';
  assert exists (select 1 from public.institution_memberships where user_id = '00000000-0000-0000-0000-0000000000c1'
    and verification_state = 'verified' and verification_method = 'domain'), 'membership verified';
  assert exists (select 1 from public.identity_audit_events where actor_user_id = '00000000-0000-0000-0000-0000000000c1'
    and event_type = 'institution_verification.domain_verified'), 'audit actor';
  perform set_config('request.jwt.claims', '{"sub":"user_2ClerkUnverified","role":"authenticated"}', true);
  begin
    perform public.verify_own_institution_by_domain();
    raise exception 'unverified email verified an institution';
  exception when insufficient_privilege then
    assert sqlerrm = 'EMAIL_NOT_VERIFIED', sqlerrm;
  end;

  -- the transitional sync follows Supabase Auth email changes
  update auth.users set email = 'moved@x.test', email_confirmed_at = null where id = '00000000-0000-0000-0000-0000000000c3';
  assert (select email = 'moved@x.test' and email_verified_at is null from private.user_identities
    where user_id = '00000000-0000-0000-0000-0000000000c3'), 'sync on update';

  perform set_config('request.jwt.claims', '', true);
  raise notice 'ALL CLERK IDENTITY BRIDGE ASSERTIONS PASSED';
end $$;
rollback;
