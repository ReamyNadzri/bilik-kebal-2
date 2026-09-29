\set ON_ERROR_STOP 1
begin;
-- A Supabase Auth account that the Clerk import will link through external_id.
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000d1','legacy@x.test',now());
do $$
declare
  fresh uuid;
  again uuid;
  linked uuid;
  t0 timestamptz := '2026-09-29 12:00:00+00';
begin
  assert not has_function_privilege('anon', 'public.sync_clerk_user(text, text, text, boolean, text, timestamptz)', 'execute'), 'anon may sync';
  assert not has_function_privilege('authenticated', 'public.sync_clerk_user(text, text, text, boolean, text, timestamptz)', 'execute'), 'authenticated may sync';
  assert has_function_privilege('service_role', 'public.sync_clerk_user(text, text, text, boolean, text, timestamptz)', 'execute'), 'service_role may not sync';

  -- a new Clerk account gets a profile, an identity and one welcome
  fresh := public.sync_clerk_user('user_2Fresh', null, ' Fresh@Student.UiTM.edu.my ', true, 'Fresh Hunter', t0);
  assert (select display_name from public.profiles where user_id = fresh) = 'Fresh Hunter', 'display name';
  assert (select clerk_user_id = 'user_2Fresh' and email = 'fresh@student.uitm.edu.my' and email_verified_at is not null
          from private.user_identities where user_id = fresh), 'identity row';
  assert (select count(*) from public.notifications where recipient_user_id = fresh and kind = 'welcome') = 1, 'welcome once';

  -- a replayed delivery converges on the same account and adds no second welcome
  again := public.sync_clerk_user('user_2Fresh', null, 'fresh@student.uitm.edu.my', true, 'Fresh Hunter', t0);
  assert again = fresh, 'replay made a second account';
  assert (select count(*) from public.profiles p join private.user_identities i using (user_id)
          where i.clerk_user_id = 'user_2Fresh') = 1, 'one profile';
  assert (select count(*) from public.notifications where recipient_user_id = fresh and kind = 'welcome') = 1, 'welcome replayed';

  -- a newer update changes the email; an older one arriving late does not
  perform public.sync_clerk_user('user_2Fresh', null, 'new@student.uitm.edu.my', true, null, t0 + interval '1 minute');
  perform public.sync_clerk_user('user_2Fresh', null, 'old@student.uitm.edu.my', true, null, t0 + interval '30 seconds');
  assert (select email from private.user_identities where user_id = fresh) = 'new@student.uitm.edu.my', 'stale overwrite';
  -- later profile names belong to the member, not to Clerk
  assert (select display_name from public.profiles where user_id = fresh) = 'Fresh Hunter', 'name overwritten';

  -- losing verification clears it; regaining it records a new time
  perform public.sync_clerk_user('user_2Fresh', null, 'new@student.uitm.edu.my', false, null, t0 + interval '2 minutes');
  assert (select email_verified_at is null from private.user_identities where user_id = fresh), 'unverified kept date';

  -- an unverified sign-up is not welcomed yet, and falls back to the email for a name
  again := public.sync_clerk_user('user_2Pending', null, 'pending@x.test', false, '  ', t0);
  assert (select display_name from public.profiles where user_id = again) = 'pending', 'fallback name';
  assert not exists (select 1 from public.notifications where recipient_user_id = again), 'welcomed unverified';
  perform public.sync_clerk_user('user_2Pending', null, 'pending@x.test', true, null, t0 + interval '1 minute');
  assert (select count(*) from public.notifications where recipient_user_id = again and kind = 'welcome') = 1, 'welcome on verify';

  -- an imported account links to its existing profile instead of creating one
  linked := public.sync_clerk_user('user_2Imported', '00000000-0000-0000-0000-0000000000d1', 'legacy@x.test', true, 'Other', t0);
  assert linked = '00000000-0000-0000-0000-0000000000d1', 'import not linked';
  assert (select clerk_user_id from private.user_identities where user_id = linked) = 'user_2Imported', 'clerk id not stored';
  -- and an already-linked profile cannot be claimed by a second Clerk account
  again := public.sync_clerk_user('user_2Squatter', '00000000-0000-0000-0000-0000000000d1', 'squat@x.test', true, null, t0);
  assert again <> linked, 'second clerk account took the profile';
  assert (select clerk_user_id from private.user_identities where user_id = linked) = 'user_2Imported', 'link replaced';

  -- the new account can act through RLS
  perform set_config('request.jwt.claims', '{"sub":"user_2Fresh","role":"authenticated"}', true);
  assert private.current_user_id() = fresh, 'synced account resolves';

  begin
    perform public.sync_clerk_user('not-a-clerk-id', null, 'x@x.test', true, null, t0);
    raise exception 'accepted a malformed id';
  exception when invalid_parameter_value then
    assert sqlerrm = 'CLERK_USER_ID_INVALID', sqlerrm;
  end;
  begin
    perform public.sync_clerk_user('user_2Fresh', null, 'x@x.test', true, null, null);
    raise exception 'accepted a missing timestamp';
  exception when invalid_parameter_value then
    assert sqlerrm = 'CLERK_UPDATED_AT_REQUIRED', sqlerrm;
  end;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'ALL CLERK USER SYNC ASSERTIONS PASSED';
end $$;
rollback;
