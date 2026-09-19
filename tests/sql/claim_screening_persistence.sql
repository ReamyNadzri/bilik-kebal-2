begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select has_table('public', 'claim_screening_jobs', 'screening jobs table exists');
select has_table('public', 'claim_screening_results', 'screening results table exists');
select has_type('public', 'claim_screening_job_state', 'screening job state exists');
select is((select relrowsecurity from pg_class where oid = 'public.claim_screening_jobs'::regclass), true, 'jobs have RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.claim_screening_results'::regclass), true, 'results have RLS enabled');

set local role anon;
select throws_ok($$ select count(*) from public.claim_screening_jobs $$, '42501', 'permission denied for table claim_screening_jobs', 'anonymous users cannot read jobs');
select throws_ok($$ select count(*) from public.claim_screening_results $$, '42501', 'permission denied for table claim_screening_results', 'anonymous users cannot read results');

select * from finish();
rollback;
