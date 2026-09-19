create table public.claim_reviews (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete restrict,
  reviewer_user_id uuid not null references public.profiles (user_id) on delete restrict,
  decision text not null check (decision in ('approve', 'reject', 'request_information')),
  reason_code text not null check (reason_code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index claim_reviews_claim on public.claim_reviews (claim_id, created_at desc);
create unique index claim_reviews_one_winner_per_wanted
on public.claims (wanted_request_id)
where status = 'approved';

alter table public.claim_reviews enable row level security;
revoke all on public.claim_reviews from anon, authenticated;

create or replace function public.record_claim_review(
  target_claim_id uuid,
  target_decision text,
  target_reason_code text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  review_id uuid;
  target_institution_id uuid;
  target_hunter_id uuid;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '28000'; end if;

  select c.institution_id, c.hunter_user_id into target_institution_id, target_hunter_id
  from public.claims c where c.id = target_claim_id and c.status in ('screening', 'needs_information', 'under_review');
  if target_institution_id is null then raise exception 'claim is not reviewable' using errcode = 'P0001'; end if;
  if target_hunter_id = actor_id then raise exception 'claim owner cannot review own claim' using errcode = '42501'; end if;
  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
    or private.current_user_is_institution_sheriff(target_institution_id)
  ) then raise exception 'reviewer not authorized' using errcode = '42501'; end if;

  if target_decision = 'approve' then
    update public.claims set status = 'not_selected', updated_at = now()
    where wanted_request_id = (select wanted_request_id from public.claims where id = target_claim_id)
      and id <> target_claim_id and status in ('screening', 'needs_information', 'under_review');
    update public.claims set status = 'approved', updated_at = now() where id = target_claim_id;
  elsif target_decision = 'reject' then
    update public.claims set status = 'rejected', updated_at = now() where id = target_claim_id;
  elsif target_decision = 'request_information' then
    update public.claims set status = 'needs_information', updated_at = now() where id = target_claim_id;
  else
    raise exception 'invalid review decision' using errcode = '22023';
  end if;

  insert into public.claim_reviews (claim_id, reviewer_user_id, decision, reason_code, notes)
  values (target_claim_id, actor_id, target_decision, target_reason_code, target_notes)
  returning id into review_id;
  return review_id;
end;
$$;

revoke all on function public.record_claim_review(uuid, text, text, text) from public;
grant execute on function public.record_claim_review(uuid, text, text, text) to authenticated;
