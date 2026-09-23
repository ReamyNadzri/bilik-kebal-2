-- Publish only non-payment, user-facing decision events. The event UUID is the
-- originating claim/request ID, making trigger retries naturally idempotent.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'claim_approved', 'claim_rejected', 'claim_information_requested', 'claim_not_selected',
  'institution_verification_approved', 'institution_verification_rejected',
  'payout_recorded', 'refund_recorded', 'account_restricted', 'appeal_updated'
));

create function private.publish_claim_not_selected_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status::text is distinct from 'not_selected'
    and new.status::text = 'not_selected' then
    perform public.enqueue_notification(new.id, new.hunter_user_id, 'claim_not_selected', new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.publish_claim_not_selected_notification() from public, anon, authenticated;
create trigger claim_not_selected_notification
after update of status on public.claims
for each row execute function private.publish_claim_not_selected_notification();

create function private.publish_institution_verification_notification()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_kind text;
begin
  if old.state::text = 'pending' and new.state::text in ('approved', 'rejected') then
    event_kind := case new.state::text
      when 'approved' then 'institution_verification_approved'
      when 'rejected' then 'institution_verification_rejected'
    end;
    perform public.enqueue_notification(new.id, new.user_id, event_kind, new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.publish_institution_verification_notification() from public, anon, authenticated;
create trigger institution_verification_notification
after update of state on public.institution_verification_requests
for each row execute function private.publish_institution_verification_notification();
