\set ON_ERROR_STOP 1
begin;
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000e1','Clerk Member'),
 ('00000000-0000-0000-0000-0000000000e2','Someone Else');
insert into private.user_identities (user_id, clerk_user_id, email, email_verified_at) values
 ('00000000-0000-0000-0000-0000000000e1','user_2Member','member@x.test',now()),
 ('00000000-0000-0000-0000-0000000000e2','user_2Else','else@x.test',now());
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000e3','legacy@x.test',null);
do $$
declare
  me record;
begin
  assert not has_function_privilege('anon', 'public.current_identity()', 'execute'), 'anon may read';
  assert has_function_privilege('authenticated', 'public.current_identity()', 'execute'), 'authenticated may not read';

  perform set_config('request.jwt.claims', '{"sub":"user_2Member","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  assert (select count(*) from public.current_identity()) = 1, 'exactly one row';
  select * into me from public.current_identity();
  assert me.user_id = '00000000-0000-0000-0000-0000000000e1' and me.email = 'member@x.test'
    and me.email_verified_at is not null and me.public_id is not null, 'own identity';

  -- an unprovisioned Clerk account and a signed-out caller see nothing
  perform set_config('request.jwt.claims', '{"sub":"user_2NotYet","role":"authenticated"}', true);
  assert not exists (select 1 from public.current_identity()), 'unprovisioned';
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  assert not exists (select 1 from public.current_identity()), 'no subject';

  -- a transitional Supabase Auth session reads its synced identity
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
  select * into me from public.current_identity();
  assert me.email = 'legacy@x.test' and me.email_verified_at is null, 'legacy identity';
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', '', true);
  raise notice 'ALL CURRENT IDENTITY ASSERTIONS PASSED';
end $$;
rollback;
