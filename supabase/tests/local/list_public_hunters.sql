\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000a1','viewer@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a2','unverified@x.test',null),
 ('00000000-0000-0000-0000-0000000000a3','pending@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a4','restricted@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a5','lifted@x.test',now()),
 ('00000000-0000-0000-0000-0000000000a6','expired@x.test',now());
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000a1','Viewer'),('00000000-0000-0000-0000-0000000000a2','Unverified'),
 ('00000000-0000-0000-0000-0000000000a3','Pending'),('00000000-0000-0000-0000-0000000000a4','Restricted'),
 ('00000000-0000-0000-0000-0000000000a5','Lifted'),('00000000-0000-0000-0000-0000000000a6','Expired')
 on conflict (user_id) do update set display_name = excluded.display_name;
update public.profiles set avatar_preset = 3 where user_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.institutions (id, slug, name) values ('10000000-0000-0000-0000-0000000000f1','uitm-hunters','UiTM Shah Alam');
insert into public.institution_memberships (user_id, institution_id, verification_state, verification_method, verified_at) values
 ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000f1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000a4','10000000-0000-0000-0000-0000000000f1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000a5','10000000-0000-0000-0000-0000000000f1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000a6','10000000-0000-0000-0000-0000000000f1','verified','domain',now());
insert into public.institution_memberships (user_id, institution_id, verification_state) values
 ('00000000-0000-0000-0000-0000000000a3','10000000-0000-0000-0000-0000000000f1','pending');
insert into public.account_restrictions (user_id, reason_code, restricted_by) values
 ('00000000-0000-0000-0000-0000000000a4','spam','00000000-0000-0000-0000-0000000000a1');
insert into public.account_restrictions (user_id, reason_code, restricted_by, lifted_by, lifted_at) values
 ('00000000-0000-0000-0000-0000000000a5','spam','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1',now());
insert into public.account_restrictions (user_id, reason_code, restricted_by, restricted_at, expires_at) values
 ('00000000-0000-0000-0000-0000000000a6','spam','00000000-0000-0000-0000-0000000000a1',now() - interval '2 hours',now() - interval '1 hour');
-- 24 more verified members, so paging has two full pages of ten and a third.
insert into auth.users (id, email, email_confirmed_at)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'bulk' || n || '@x.test', now()
  from generate_series(1, 24) n;
insert into public.profiles (user_id, display_name, created_at)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'Bulk ' || n, now() - n * interval '1 day'
  from generate_series(1, 24) n
  on conflict (user_id) do update set display_name = excluded.display_name, created_at = excluded.created_at;
insert into public.institution_memberships (user_id, institution_id, verification_state, verification_method, verified_at)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, '10000000-0000-0000-0000-0000000000f1', 'verified', 'manual', now()
  from generate_series(1, 24) n;
do $$
declare
  res jsonb;
  second jsonb;
  third jsonb;
  ids text[];
  names text[];
begin
  assert not has_function_privilege('anon', 'public.list_public_hunters(integer, integer)', 'execute'), 'anon may call';
  assert has_function_privilege('authenticated', 'public.list_public_hunters(integer, integer)', 'execute'), 'authenticated may not call';

  -- signed out, then signed in without a verified email
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.list_public_hunters(10, 1); raise exception 'signed out listed'; exception when insufficient_privilege then assert sqlerrm = 'EMAIL_NOT_VERIFIED'; end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  begin perform public.list_public_hunters(10, 1); raise exception 'unverified listed'; exception when insufficient_privilege then assert sqlerrm = 'EMAIL_NOT_VERIFIED'; end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  -- page size and page are validated, never clamped
  begin perform public.list_public_hunters(9, 1); raise exception 'size 9'; exception when invalid_parameter_value then assert sqlerrm = 'page_size_invalid'; end;
  begin perform public.list_public_hunters(25, 1); raise exception 'size 25'; exception when invalid_parameter_value then assert sqlerrm = 'page_size_invalid'; end;
  begin perform public.list_public_hunters(null, 1); raise exception 'size null'; exception when invalid_parameter_value then assert sqlerrm = 'page_size_invalid'; end;
  begin perform public.list_public_hunters(10, 0); raise exception 'page 0'; exception when invalid_parameter_value then assert sqlerrm = 'page_invalid'; end;
  begin perform public.list_public_hunters(10, null); raise exception 'page null'; exception when invalid_parameter_value then assert sqlerrm = 'page_invalid'; end;
  perform public.list_public_hunters(15, 1);
  perform public.list_public_hunters(20, 1);

  -- verified, unrestricted members only: viewer, lifted, expired and the 24
  res := public.list_public_hunters(10, 1);
  assert (res->>'total')::integer = 27, res->>'total';
  select array_agg(item->>'displayName') into names
    from jsonb_array_elements((public.list_public_hunters(20, 1)->'items') || (public.list_public_hunters(20, 2)->'items')) item;
  assert 'Viewer' = any(names) and 'Lifted' = any(names) and 'Expired' = any(names), names::text;
  assert not ('Pending' = any(names) or 'Restricted' = any(names) or 'Unverified' = any(names)), names::text;
  assert cardinality(names) = 27, cardinality(names)::text;

  -- public fields only; the drawn preset and institution name come through
  assert (select bool_and((select array_agg(k order by k) from jsonb_object_keys(item) k)
            = array['avatarObjectKey','avatarPreset','displayName','institutionName','joinedAt','publicId'])
          from jsonb_array_elements(res->'items') item), res::text;
  assert res::text not like '%@x.test%', 'email leaked';
  assert res::text not like '%00000000-0000-0000-0000-0000000000a%', 'user id leaked';
  assert (select item->>'avatarPreset' = '3' and item->>'institutionName' = 'UiTM Shah Alam'
          from jsonb_array_elements(public.list_public_hunters(20, 1)->'items') item
          where item->>'displayName' = 'Viewer'), 'viewer avatar/institution';

  -- stable order, pages disjoint, the last page short, past the end empty
  second := public.list_public_hunters(10, 2);
  third := public.list_public_hunters(10, 3);
  assert jsonb_array_length(res->'items') = 10 and jsonb_array_length(second->'items') = 10
    and jsonb_array_length(third->'items') = 7, 'page lengths';
  select array_agg(item->>'publicId') into ids
    from jsonb_array_elements((res->'items') || (second->'items') || (third->'items')) item;
  assert (select count(distinct x) from unnest(ids) x) = 27, 'pages overlap';
  assert public.list_public_hunters(10, 1) = res, 'order not stable';
  assert (select min((item->>'joinedAt')::timestamptz) from jsonb_array_elements(second->'items') item)
      >= (select max((item->>'joinedAt')::timestamptz) from jsonb_array_elements(third->'items') item), 'not newest first';
  assert jsonb_array_length(public.list_public_hunters(10, 4)->'items') = 0, 'past the end';
  raise notice 'ALL LIST PUBLIC HUNTERS ASSERTIONS PASSED';
end $$;
rollback;
