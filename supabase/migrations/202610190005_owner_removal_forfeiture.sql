-- Migration: 202610190005_owner_removal_forfeiture.sql
--
-- The Owner's master switch (request, 2026-10-02). The Owner may remove any
-- Wanted that has not been paid out, even one holding real money, when its
-- poster broke the rules or the terms. Decision (user, 2026-10-02): the
-- breacher forfeits. The poster's own contributions (and their fees) are moved
-- from escrow to platform_forfeit; every other Backer is queued for a full
-- refund (contribution + fee) through the usual refund queue. The removal
-- takes a written reason, is recorded on the Wanted and in its public activity
-- (without the reason), and pending reports on it are marked actioned.
--
-- Verified on Supabase Cloud in a rolled-back transaction (2026-10-02): Owner
-- only, reason required, a Backer's RM 20 queued for a RM 22 refund, reports
-- actioned, a second removal refused. The forfeiture branch (the poster's own
-- contribution) is covered by supabase/tests/local/owner_removal_forfeiture.sql
-- and was NOT run against a database before this file was written.

-- ---------------------------------------------------------------------------
-- The Owner's removal, with forfeiture
-- ---------------------------------------------------------------------------

alter table public.wanted_requests
  add column if not exists removed_by_owner uuid references public.profiles (user_id) on delete set null,
  add column if not exists removal_reason text
    check (removal_reason is null or char_length(removal_reason) between 10 and 1000);

alter table public.ledger_transactions drop constraint ledger_transactions_kind_check;
alter table public.ledger_transactions add constraint ledger_transactions_kind_check
  check (kind in ('contribution', 'refund', 'chargeback', 'correction', 'payout', 'forfeiture'));
create unique index ledger_transactions_forfeiture_uniq
  on public.ledger_transactions (contribution_id) where kind = 'forfeiture';

-- Returns { refunds, forfeitedSen }. Refusals are errors:
--   owner_removal_owner_only     not the Owner
--   owner_removal_reason         reason shorter than 10 characters
--   owner_removal_not_found      no such Wanted, or already removed
--   owner_removal_paid_out       a payout exists for it (handle that first)
create function public.owner_remove_wanted(target_public_id uuid, target_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target public.wanted_requests%rowtype;
  item record;
  tx uuid;
  refunds integer := 0;
  forfeited integer := 0;
  reason text := trim(coalesce(target_reason, ''));
begin
  if actor_id is null or not private.current_user_has_platform_role('owner') then
    raise exception using errcode = '42501', message = 'owner_removal_owner_only';
  end if;
  if char_length(reason) < 10 then
    raise exception using errcode = '22023', message = 'owner_removal_reason';
  end if;

  select * into target from public.wanted_requests
  where public_id = target_public_id
    and status not in ('draft', 'withdrawn')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'owner_removal_not_found';
  end if;
  if exists (
    select 1 from public.payout_tasks p
    where p.wanted_request_id = target.id and p.status <> 'failed'
  ) then
    raise exception using errcode = 'P0001', message = 'owner_removal_paid_out';
  end if;

  for item in
    select c.* from public.contributions c
    where c.wanted_request_id = target.id
    order by c.created_at
  loop
    if item.contributor_user_id = target.commissioner_user_id then
      -- The breacher's own money: escrow and held fee become forfeit revenue.
      if not exists (
        select 1 from public.ledger_transactions lt
        where lt.contribution_id = item.id and lt.kind in ('forfeiture', 'refund')
      ) then
        insert into public.ledger_transactions (kind, contribution_id)
        values ('forfeiture', item.id)
        returning id into tx;
        insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
        values (tx, 'wanted_escrow', item.amount_sen, 0);
        if item.fee_sen > 0 then
          insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
          values (tx, 'platform_fee_held', item.fee_sen, 0);
        end if;
        insert into public.ledger_entries (transaction_id, account_code, debit_sen, credit_sen)
        values (tx, 'platform_forfeit', 0, item.amount_sen + item.fee_sen);
        if (
          select coalesce(sum(debit_sen), 0) <> coalesce(sum(credit_sen), 0)
          from public.ledger_entries where transaction_id = tx
        ) then
          raise exception using errcode = '23514', message = 'unbalanced_ledger_transaction';
        end if;
        forfeited := forfeited + item.amount_sen + item.fee_sen;
      end if;
    else
      -- Everyone else is refunded in full, contribution + fee.
      insert into public.refund_tasks (
        wanted_request_id, contribution_id, contributor_user_id, amount_sen, status
      )
      values (target.id, item.id, item.contributor_user_id, item.amount_sen, 'pending')
      on conflict (contribution_id) do nothing;
      if found then refunds := refunds + 1; end if;
    end if;
  end loop;

  update public.wanted_requests
  set status = 'withdrawn',
      withdrawn_at = now(),
      removed_by_owner = actor_id,
      removal_reason = reason
  where id = target.id;

  insert into public.wanted_public_events (wanted_request_id, event_type, summary)
  values (target.id, 'wanted_removed', 'Removed by the Owner for breaking the rules');

  update public.wanted_reports
  set status = 'actioned', reviewed_by = actor_id, reviewed_at = now()
  where wanted_request_id = target.id and status = 'pending';

  return jsonb_build_object('refunds', refunds, 'forfeitedSen', forfeited);
end;
$$;
revoke all on function public.owner_remove_wanted(uuid, text) from public, anon;
grant execute on function public.owner_remove_wanted(uuid, text) to authenticated;
