\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000d1','uitm@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d2','umpsa@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d3','moved@x.test',now()),
 ('00000000-0000-0000-0000-0000000000d4','unverified@x.test',null);
insert into public.profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-0000000000d1','UiTM member'),('00000000-0000-0000-0000-0000000000d2','UMPSA member'),
 ('00000000-0000-0000-0000-0000000000d3','Moved member'),('00000000-0000-0000-0000-0000000000d4','Unverified')
 on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.institutions (id, slug, name, short_name) values
 ('10000000-0000-0000-0000-0000000000d1','uitm-wall','Universiti Teknologi MARA (UiTM)','UiTM'),
 ('10000000-0000-0000-0000-0000000000d2','umpsa-wall','Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)','UMPSA');
insert into public.institution_memberships (user_id, institution_id, verification_state, verification_method, verified_at) values
 ('00000000-0000-0000-0000-0000000000d1','10000000-0000-0000-0000-0000000000d1','verified','domain',now()),
 ('00000000-0000-0000-0000-0000000000d2','10000000-0000-0000-0000-0000000000d2','verified','domain',now()),
 -- verified at UiTM first, then at UMPSA: listed under the later one only
 ('00000000-0000-0000-0000-0000000000d3','10000000-0000-0000-0000-0000000000d1','verified','manual',now() - interval '2 days'),
 ('00000000-0000-0000-0000-0000000000d3','10000000-0000-0000-0000-0000000000d2','verified','manual',now());
do $$
declare
  uitm jsonb;
  umpsa jsonb;
begin
  assert not has_function_privilege('anon', 'public.list_public_hunters_at(uuid, integer, integer)', 'execute'), 'anon may call';
  assert has_function_privilege('authenticated', 'public.list_public_hunters_at(uuid, integer, integer)', 'execute'), 'authenticated may not call';

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d4', true);
  begin perform public.list_public_hunters_at('10000000-0000-0000-0000-0000000000d1', 10, 1); raise exception 'unverified listed'; exception when insufficient_privilege then assert sqlerrm = 'EMAIL_NOT_VERIFIED'; end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  begin perform public.list_public_hunters_at('10000000-0000-0000-0000-0000000000d1', 9, 1); raise exception 'size 9'; exception when invalid_parameter_value then assert sqlerrm = 'page_size_invalid'; end;
  begin perform public.list_public_hunters_at('10000000-0000-0000-0000-0000000000d1', 10, 0); raise exception 'page 0'; exception when invalid_parameter_value then assert sqlerrm = 'page_invalid'; end;

  uitm := public.list_public_hunters_at('10000000-0000-0000-0000-0000000000d1', 20, 1);
  umpsa := public.list_public_hunters_at('10000000-0000-0000-0000-0000000000d2', 20, 1);
  assert (select array_agg(item->>'displayName' order by item->>'displayName') from jsonb_array_elements(uitm->'items') item)
    = array['UiTM member'], uitm::text;
  assert (select array_agg(item->>'displayName' order by item->>'displayName') from jsonb_array_elements(umpsa->'items') item)
    = array['Moved member','UMPSA member'], umpsa::text;
  assert (uitm->>'total')::integer = 1 and (umpsa->>'total')::integer = 2, 'totals';
  assert umpsa::text not like '%@x.test%', 'email leaked';
  raise notice 'ALL LIST PUBLIC HUNTERS AT ASSERTIONS PASSED';
end $$;
rollback;
