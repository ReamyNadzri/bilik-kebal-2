-- Domain-owned publishers call the notification contract, inside the originating
-- transaction. They do not change claim/identity authorization or settlement.
create function private.publish_claim_review_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient_id uuid;
  event_kind text;
begin
  select hunter_user_id into strict recipient_id
  from public.claims where id = new.claim_id;
  event_kind := case new.decision
    when 'approve' then 'claim_approved'
    when 'reject' then 'claim_rejected'
    when 'request_information' then 'claim_information_requested'
  end;
  if event_kind is null then
    raise exception 'UNSUPPORTED_REVIEW_NOTIFICATION' using errcode = '22023';
  end if;
  perform public.enqueue_notification(new.id, recipient_id, event_kind, new.claim_id);
  return new;
end;
$$;
revoke all on function private.publish_claim_review_notification() from public, anon, authenticated;
create trigger claim_review_notification
after insert on public.claim_reviews
for each row execute function private.publish_claim_review_notification();

create function private.publish_account_restriction_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.lifted_at is null then
    perform public.enqueue_notification(new.id, new.user_id, 'account_restricted', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.publish_account_restriction_notification() from public, anon, authenticated;
create trigger account_restriction_notification
after insert on public.account_restrictions
for each row execute function private.publish_account_restriction_notification();
