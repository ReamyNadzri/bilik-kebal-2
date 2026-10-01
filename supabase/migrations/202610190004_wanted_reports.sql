-- Migration: 202610190004_wanted_reports.sql
--
-- Request of 2026-10-02:
--
--   Report a Wanted. An institution-verified member who is not its poster
--      may report a Wanted once, with a category and an optional note. Reports
--      are private: the reporter reads their own, and only Sheriffs and the
--      Owner read them all. A report is evidence for a human; it changes
--      nothing by itself.


-- ---------------------------------------------------------------------------
-- 1. Reports
-- ---------------------------------------------------------------------------

create table public.wanted_reports (
  id uuid primary key default gen_random_uuid(),
  wanted_request_id uuid not null references public.wanted_requests (id) on delete cascade,
  reporter_user_id uuid not null references public.profiles (user_id) on delete cascade,
  category text not null check (category in (
    'rules_breach', 'copyright', 'personal_data', 'scam_or_fraud', 'harassment', 'spam', 'other'
  )),
  details text check (details is null or char_length(details) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'actioned')),
  reviewed_by uuid references public.profiles (user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wanted_request_id, reporter_user_id)
);
create index wanted_reports_pending on public.wanted_reports (created_at) where status = 'pending';

alter table public.wanted_reports enable row level security;
revoke all on public.wanted_reports from public, anon, authenticated;
grant select on public.wanted_reports to authenticated;

create policy wanted_reports_read_own on public.wanted_reports
  for select to authenticated
  using (reporter_user_id = private.current_user_id());

create policy wanted_reports_read_reviewers on public.wanted_reports
  for select to authenticated
  using (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
  );

-- Returns 'reported' or 'already_reported'. Refusals are errors:
--   wanted_report_not_eligible   not institution verified, or the poster
--   wanted_report_not_found      no such public Wanted
--   wanted_report_rate_limited   more than 10 reports in a day
create function public.report_wanted(
  target_public_id uuid,
  target_category text,
  target_details text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  target public.wanted_requests%rowtype;
  inserted uuid;
begin
  if actor_id is null or not exists (
    select 1 from public.institution_memberships m
    where m.user_id = actor_id and m.verification_state = 'verified'
  ) then
    raise exception using errcode = '42501', message = 'wanted_report_not_eligible';
  end if;

  select * into target from public.wanted_requests
  where public_id = target_public_id
    and status in ('open', 'reviewing', 'closed', 'expired', 'fulfilled');
  if not found then
    raise exception using errcode = 'P0002', message = 'wanted_report_not_found';
  end if;
  if target.commissioner_user_id = actor_id then
    raise exception using errcode = '42501', message = 'wanted_report_not_eligible';
  end if;

  if (
    select count(*) from public.wanted_reports r
    where r.reporter_user_id = actor_id and r.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception using errcode = 'P0001', message = 'wanted_report_rate_limited';
  end if;

  insert into public.wanted_reports (wanted_request_id, reporter_user_id, category, details)
  values (
    target.id, actor_id, target_category,
    nullif(left(trim(coalesce(target_details, '')), 500), '')
  )
  on conflict (wanted_request_id, reporter_user_id) do nothing
  returning id into inserted;

  return case when inserted is null then 'already_reported' else 'reported' end;
end;
$$;
revoke all on function public.report_wanted(uuid, text, text) from public, anon;
grant execute on function public.report_wanted(uuid, text, text) to authenticated;

-- Reviewers' queue: pending reports with the Wanted they are about.
create function public.list_wanted_reports(target_status text default 'pending')
returns table (
  id uuid,
  wanted_public_id uuid,
  wanted_title text,
  wanted_status text,
  category text,
  details text,
  status text,
  created_at timestamptz,
  report_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
  ) then
    raise exception using errcode = '42501', message = 'wanted_reports_reviewers_only';
  end if;
  return query
  select r.id, w.public_id, w.title, w.status::text, r.category, r.details, r.status, r.created_at,
    count(*) over (partition by r.wanted_request_id)
  from public.wanted_reports r
  join public.wanted_requests w on w.id = r.wanted_request_id
  where r.status = target_status
  order by r.created_at
  limit 200;
end;
$$;
revoke all on function public.list_wanted_reports(text) from public, anon;
grant execute on function public.list_wanted_reports(text) to authenticated;

create function public.dismiss_wanted_report(target_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.current_user_has_platform_role('owner')
    or private.current_user_has_platform_role('platform_sheriff')
  ) then
    raise exception using errcode = '42501', message = 'wanted_reports_reviewers_only';
  end if;
  update public.wanted_reports
  set status = 'dismissed', reviewed_by = private.current_user_id(), reviewed_at = now()
  where id = target_report_id and status = 'pending';
end;
$$;
revoke all on function public.dismiss_wanted_report(uuid) from public, anon;
grant execute on function public.dismiss_wanted_report(uuid) to authenticated;

