-- Sessions name the semester only (user, 2 October 2026): Semester 1 to Semester 6, no year.
-- Existing rows are renamed in place, so the three Wanteds on Semester 1 keep their session id.

update public.academic_sessions
set name = 'Semester 1', slug = 'semester-1', sort_order = 1, active = true, updated_at = now()
where slug = 'sem-1-2024-2025';

update public.academic_sessions
set name = 'Semester 2', slug = 'semester-2', sort_order = 2, active = true, updated_at = now()
where slug = 'sem-2-2024-2025';

-- Every institution gets all six; existing slugs are left alone.
insert into public.academic_sessions (institution_id, slug, name, sort_order)
select i.id, 'semester-' || n, 'Semester ' || n, n
from public.institutions i
cross join generate_series(1, 6) as n
on conflict (institution_id, slug) do nothing;

-- Any other year-named session is switched off, not deleted (Wanteds may point at it).
update public.academic_sessions
set active = false, updated_at = now()
where slug !~ '^semester-[1-6]$';
