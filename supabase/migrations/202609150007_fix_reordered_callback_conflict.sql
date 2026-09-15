do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.record_verified_contribution(text,text,text,integer,text,text)'::regprocedure
  ) into function_definition;
  execute replace(
    function_definition,
    'ON CONFLICT (provider, provider_transaction_id) DO NOTHING',
    'ON CONFLICT DO NOTHING'
  );
end;
$$;
