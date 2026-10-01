-- Migration: 202610190002_uitm_campuses_trimmed.sql
--
-- UiTM lists five campuses (request, 2026-10-02): Kuala Terengganu, Dungun,
-- Bukit Besi, Shah Alam and Puncak Alam. The others are switched off rather
-- than deleted, so the change is reversible and nothing that references a
-- campus breaks; none of them had a Wanted request on 2026-10-02. Every read
-- (Post a Wanted, Board filters, the Explore Map) lists active campuses only.

update public.campuses c
set active = false
from public.institutions i
where i.id = c.institution_id
  and i.slug = 'uitm'
  and c.slug not in (
    'kuala-terengganu', 'dungun', 'bukit-besi', 'uitm-shah-alam', 'uitm-puncak-alam'
  )
  and c.active;

update public.campuses c
set active = true
from public.institutions i
where i.id = c.institution_id
  and i.slug = 'uitm'
  and c.slug in (
    'kuala-terengganu', 'dungun', 'bukit-besi', 'uitm-shah-alam', 'uitm-puncak-alam'
  )
  and not c.active;
