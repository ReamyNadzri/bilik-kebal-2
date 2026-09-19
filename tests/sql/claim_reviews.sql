begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select has_table('public', 'claim_reviews', 'claim reviews table exists');
select is((select relrowsecurity from pg_class where oid = 'public.claim_reviews'::regclass), true, 'claim reviews have RLS enabled');
select has_function('public', 'record_claim_review', ARRAY['uuid', 'text', 'text', 'text'], 'review operation exists');

set local role anon;
select throws_ok($$ select count(*) from public.claim_reviews $$, '42501', 'permission denied for table claim_reviews', 'anonymous users cannot read reviews');
select throws_ok($$ select public.record_claim_review('00000000-0000-4000-8000-000000000001', 'approve', 'valid', null) $$, '42501', null, 'anonymous users cannot execute review operation');

reset role;
select is((select count(*) from pg_indexes where indexname = 'claim_reviews_one_winner_per_wanted'), 1::bigint, 'one-winner unique index exists');

select * from finish();
rollback;
