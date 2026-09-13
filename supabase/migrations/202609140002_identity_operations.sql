create table public.institution_email_domains (
  domain text primary key check (
    domain = lower(domain)
    and domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.identity_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type ~ '^[a-z0-9]+(?:[._][a-z0-9]+)*$'),
  actor_user_id uuid not null references public.profiles (user_id) on delete restrict,
  subject_user_id uuid references public.profiles (user_id) on delete restrict,
  institution_id uuid references public.institutions (id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index identity_audit_events_subject_history
on public.identity_audit_events (subject_user_id, occurred_at desc);

create index identity_audit_events_institution_history
on public.identity_audit_events (institution_id, occurred_at desc);

alter table public.institution_email_domains enable row level security;
alter table public.identity_audit_events enable row level security;

create policy identity_audit_events_read
on public.identity_audit_events for select
to authenticated
using (
  private.current_user_is_platform_staff()
  or (
    institution_id is not null
    and private.current_user_is_institution_sheriff(institution_id)
  )
);

grant select on public.identity_audit_events to authenticated;

create function private.current_user_recently_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and last_sign_in_at >= now() - interval '15 minutes'
  );
$$;

create function private.current_user_owns_identity_evidence(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(object_path, '/', 1) = auth.uid()::text
    and exists (
      select 1
      from storage.objects
      where bucket_id = 'identity-evidence'
        and name = object_path
    );
$$;

create function private.identity_evidence_is_unattached(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.institution_verification_requests
    where evidence_object_path = object_path
  );
$$;

revoke all on function private.current_user_recently_authenticated() from public;
revoke all on function private.current_user_owns_identity_evidence(text) from public;
revoke all on function private.identity_evidence_is_unattached(text) from public;
grant execute on function private.current_user_recently_authenticated() to authenticated;
grant execute on function private.current_user_owns_identity_evidence(text) to authenticated;
grant execute on function private.identity_evidence_is_unattached(text) to authenticated;

drop policy institution_verification_requests_insert_own
on public.institution_verification_requests;

create policy institution_verification_requests_insert_own
on public.institution_verification_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and state = 'pending'
  and private.current_user_is_email_verified()
  and private.current_user_owns_identity_evidence(evidence_object_path)
  and evidence_delete_after between now() + interval '29 days' and now() + interval '31 days'
);

drop policy identity_evidence_delete_own_pending on storage.objects;

create policy identity_evidence_delete_own_unattached
on storage.objects for delete
to authenticated
using (
  bucket_id = 'identity-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
  and private.identity_evidence_is_unattached(name)
);

create function public.verify_own_institution_by_domain()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  matched_institution_id uuid;
  membership_change_count integer := 0;
begin
  select lower(email)
  into current_email
  from auth.users
  where id = auth.uid()
    and email_confirmed_at is not null;

  if current_email is null then
    raise exception using errcode = '42501', message = 'EMAIL_NOT_VERIFIED';
  end if;

  select institution_id
  into matched_institution_id
  from public.institution_email_domains
  where domain = split_part(current_email, '@', 2)
    and active;

  if matched_institution_id is null then
    raise exception using errcode = 'P0001', message = 'EMAIL_DOMAIN_NOT_APPROVED';
  end if;

  insert into public.institution_memberships (
    user_id,
    institution_id,
    verification_state,
    verification_method,
    verified_at
  )
  values (
    auth.uid(),
    matched_institution_id,
    'verified',
    'domain',
    now()
  )
  on conflict (user_id, institution_id) do update
  set
    verification_state = 'verified',
    verification_method = 'domain',
    verified_at = excluded.verified_at,
    verified_by = null
  where
    institution_memberships.verification_state <> 'verified'
    or institution_memberships.verification_method is distinct from 'domain';

  get diagnostics membership_change_count = row_count;

  if membership_change_count > 0 then
    insert into public.identity_audit_events (
      event_type,
      actor_user_id,
      subject_user_id,
      institution_id,
      details
    )
    values (
      'institution_verification.domain_verified',
      auth.uid(),
      auth.uid(),
      matched_institution_id,
      jsonb_build_object('method', 'domain')
    );
  end if;

  return matched_institution_id;
end;
$$;

create function public.review_institution_verification_request(
  target_request_id uuid,
  decision public.verification_request_state,
  reason_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.institution_verification_requests%rowtype;
  reviewed_instant timestamptz := now();
begin
  if decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_DECISION';
  end if;

  if reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_REASON_CODE';
  end if;

  select *
  into request_record
  from public.institution_verification_requests
  where id = target_request_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if request_record.state <> 'pending' then
    return 'conflict';
  end if;

  if not (
    private.current_user_is_platform_staff()
    or private.current_user_is_institution_sheriff(request_record.institution_id)
  ) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;

  update public.institution_verification_requests
  set
    state = decision,
    decision_reason_code = reason_code,
    reviewed_by = auth.uid(),
    reviewed_at = reviewed_instant,
    evidence_delete_after = reviewed_instant + interval '30 days'
  where id = target_request_id;

  if decision = 'approved' then
    insert into public.institution_memberships (
      user_id,
      institution_id,
      verification_state,
      verification_method,
      verified_at,
      verified_by
    )
    values (
      request_record.user_id,
      request_record.institution_id,
      'verified',
      'manual',
      reviewed_instant,
      auth.uid()
    )
    on conflict (user_id, institution_id) do update
    set
      verification_state = 'verified',
      verification_method = 'manual',
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by;
  else
    insert into public.institution_memberships (
      user_id,
      institution_id,
      verification_state
    )
    values (
      request_record.user_id,
      request_record.institution_id,
      'rejected'
    )
    on conflict (user_id, institution_id) do update
    set
      verification_state = 'rejected',
      verification_method = null,
      verified_at = null,
      verified_by = null
    where institution_memberships.verification_state <> 'verified';
  end if;

  insert into public.identity_audit_events (
    event_type,
    actor_user_id,
    subject_user_id,
    institution_id,
    details
  )
  values (
    'institution_verification.' || decision::text,
    auth.uid(),
    request_record.user_id,
    request_record.institution_id,
    jsonb_build_object('reason_code', reason_code, 'request_id', target_request_id)
  );

  return 'updated';
end;
$$;

create function public.restrict_account(target_user_id uuid, reason_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  restriction_id uuid;
begin
  if not private.current_user_is_platform_staff() then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  if not private.current_user_recently_authenticated() then
    raise exception using errcode = '42501', message = 'RECENT_AUTH_REQUIRED';
  end if;

  if reason_code !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'INVALID_REASON_CODE';
  end if;

  select id
  into restriction_id
  from public.account_restrictions
  where user_id = target_user_id
    and lifted_at is null
  for update;

  if restriction_id is not null then
    return restriction_id;
  end if;

  insert into public.account_restrictions (user_id, reason_code, restricted_by)
  values (target_user_id, reason_code, auth.uid())
  returning id into restriction_id;

  insert into public.identity_audit_events (
    event_type,
    actor_user_id,
    subject_user_id,
    details
  )
  values (
    'account.restricted',
    auth.uid(),
    target_user_id,
    jsonb_build_object('reason_code', reason_code, 'restriction_id', restriction_id)
  );

  return restriction_id;
end;
$$;

revoke all on function public.verify_own_institution_by_domain() from public;
revoke all on function public.review_institution_verification_request(
  uuid,
  public.verification_request_state,
  text
) from public;
revoke all on function public.restrict_account(uuid, text) from public;

grant execute on function public.verify_own_institution_by_domain() to authenticated;
grant execute on function public.review_institution_verification_request(
  uuid,
  public.verification_request_state,
  text
) to authenticated;
grant execute on function public.restrict_account(uuid, text) to authenticated;
