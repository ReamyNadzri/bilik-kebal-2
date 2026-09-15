do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.record_verified_contribution(text,text,text,integer,text,text)'::regprocedure
  ) into function_definition;
  execute regexp_replace(
    function_definition,
    'on conflict \(provider, provider_transaction_id\) do nothing',
    'on conflict do nothing',
    'i'
  );
end;
$$;
