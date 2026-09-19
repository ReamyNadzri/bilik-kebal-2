begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'claims', 'claims table exists');
select has_table('public', 'claim_upload_sessions', 'claim upload sessions exist');
select has_type('public', 'claim_status', 'claim lifecycle exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.claims'::regclass),
  true,
  'claims have RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.claim_upload_sessions'::regclass),
  true,
  'upload sessions have RLS enabled'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.claims $$,
  '42501',
  'permission denied for table claims',
  'anonymous users cannot read claims'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.claims), 0::bigint, 'a user sees no other hunters claims');
select throws_ok(
  $$
    insert into public.claims (
      wanted_request_id, hunter_user_id, institution_id, file_name, mime_type,
      size_bytes, sha256, object_key, rights_confirmed_at
    ) values (
      '74000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000001',
      '72000000-0000-0000-0000-000000000001',
      'notes.pdf', 'application/pdf', 100, repeat('a', 64)::bytea,
      'claim/object', now()
    )
  $$,
  '42501',
  null,
  'browser roles cannot insert claims directly'
);

select * from finish();
rollback;
