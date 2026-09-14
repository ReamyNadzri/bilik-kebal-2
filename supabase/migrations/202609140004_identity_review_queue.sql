drop policy profiles_read on public.profiles;

create policy profiles_read
on public.profiles for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_is_platform_staff()
  or exists (
    select 1
    from public.institution_memberships membership
    where membership.user_id = profiles.user_id
      and private.current_user_is_institution_sheriff(membership.institution_id)
  )
  or exists (
    select 1
    from public.institution_verification_requests request
    where request.user_id = profiles.user_id
      and request.state = 'pending'
      and private.current_user_is_institution_sheriff(request.institution_id)
  )
);
