-- Migration: 202610150004_umpsa_pekan_programmes.sql
-- Description: UMPSA as a second institution, with its Pekan campus, faculties
-- and programmes.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-28):
-- * The Owner added UMPSA (Universiti Malaysia Pahang Al-Sultan Abdullah).
--   Only the Pekan campus is listed; Gambang is not part of this list.
-- * Pekan is open for requests, like the open UiTM campuses. Its map position
--   is approximate, between Dungun and Raub on the east coast.
-- * No UMPSA email domain is seeded: which addresses prove UMPSA membership is
--   not confirmed, so UMPSA members verify by evidence a Sheriff reviews.
-- * Same naming rules as the UiTM lists: Malay names (translated here from the
--   Owner's English list, not UMPSA's published Malay names), the UMPSA
--   programme code first, and an older code in brackets (BTX, formerly BTR).
-- * Left out: the Centre for Modern Languages (no programme of its own) and
--   BTW (a legacy code no longer offered).
-- * Every row is added only if absent, never over an existing slug or name.

insert into public.institutions (slug, name)
values ('umpsa', 'Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA)')
on conflict (slug) do nothing;

insert into public.campuses (
  institution_id, slug, name, active, sort_order, region_open, latitude, longitude, map_x, map_y
)
select i.id, 'umpsa-pekan', 'UMPSA Pekan', true, 0, true, 3.54360, 103.42890, 42.0, 54.0
from public.institutions i
where i.slug = 'umpsa'
  and not exists (
    select 1 from public.campuses c where c.institution_id = i.id and c.name ilike '%pekan%'
  )
on conflict (institution_id, slug) do nothing;

insert into public.faculties (institution_id, slug, name)
select i.id, v.slug, v.name
from public.institutions i
cross join (values
  ('ftkee', 'Fakulti Teknologi Kejuruteraan Elektrik dan Elektronik (FTKEE)'),
  ('ftkma', 'Fakulti Teknologi Kejuruteraan Mekanikal dan Automotif (FTKMA)'),
  ('ftkpm', 'Fakulti Teknologi Kejuruteraan Pembuatan dan Mekatronik (FTKPM)'),
  ('fk',    'Fakulti Komputeran (FK)')
) as v(slug, name)
where i.slug = 'umpsa'
  and not exists (
    select 1 from public.faculties f
    where f.institution_id = i.id and lower(f.name) = lower(v.name)
  )
on conflict (institution_id, slug) do nothing;

insert into public.programmes (institution_id, faculty_id, slug, name)
select f.institution_id, f.id, v.slug, v.name
from (values
  ('ftkee', 'dre', 'DRE Diploma Kejuruteraan Elektrik dan Elektronik'),
  ('ftkee', 'bel', 'BEL Sarjana Muda Kejuruteraan Elektrik dengan Kepujian'),
  ('ftkee', 'bhe', 'BHE Sarjana Muda Kejuruteraan Elektrik (Elektronik) dengan Kepujian (Ijazah Berganda UMPSA/HKA)'),
  ('ftkee', 'bte', 'BTE Sarjana Muda Teknologi Kejuruteraan Elektrik (Tenaga) dengan Kepujian'),
  ('ftkee', 'bts', 'BTS Sarjana Muda Teknologi Kejuruteraan Elektronik (Sistem Komputer) dengan Kepujian'),
  ('ftkee', 'bve', 'BVE Sarjana Muda Teknologi Penyelenggaraan Sistem Elektrik dengan Kepujian'),
  ('ftkee', 'bvi', 'BVI Sarjana Muda Teknologi Automasi Elektronik Industri dengan Kepujian'),
  ('ftkma', 'drm', 'DRM Diploma Kejuruteraan Mekanikal'),
  ('ftkma', 'bmm', 'BMM Sarjana Muda Kejuruteraan Mekanikal dengan Kepujian'),
  ('ftkma', 'bma', 'BMA Sarjana Muda Kejuruteraan Mekanikal (Automotif) dengan Kepujian'),
  ('ftkma', 'bha', 'BHA Sarjana Muda Kejuruteraan Automotif dengan Kepujian (Ijazah Berganda UMPSA/HKA)'),
  ('ftkma', 'bta', 'BTA Sarjana Muda Teknologi Kejuruteraan Mekanikal (Automotif) dengan Kepujian'),
  ('ftkma', 'btd', 'BTD Sarjana Muda Teknologi Kejuruteraan Mekanikal (Reka Bentuk dan Analisis) dengan Kepujian'),
  ('ftkma', 'btg', 'BTG Sarjana Muda Teknologi Kejuruteraan Mekanikal (Minyak dan Gas) dengan Kepujian'),
  ('ftkma', 'bva', 'BVA Sarjana Muda Teknologi Automotif dengan Kepujian'),
  ('ftkma', 'bvw', 'BVW Sarjana Muda Teknologi Kimpalan dengan Kepujian'),
  ('ftkpm', 'drp', 'DRP Diploma Teknologi Kejuruteraan Pembuatan'),
  ('ftkpm', 'bfm', 'BFM Sarjana Muda Kejuruteraan Mekatronik dengan Kepujian'),
  ('ftkpm', 'bhm', 'BHM Sarjana Muda Kejuruteraan Mekatronik dengan Kepujian (Ijazah Berganda UMPSA/HKA)'),
  ('ftkpm', 'bfi', 'BFI Sarjana Muda Kejuruteraan Pembuatan dengan Kepujian'),
  ('ftkpm', 'btt', 'BTT Sarjana Muda Teknologi Kejuruteraan Pembuatan (Pembuatan Termaju) dengan Kepujian'),
  ('ftkpm', 'bti', 'BTI Sarjana Muda Teknologi Kejuruteraan Pembuatan (Automasi Industri) dengan Kepujian'),
  ('ftkpm', 'btx', 'BTX (BTR) Sarjana Muda Teknologi Kejuruteraan Mekatronik (Robotik) dengan Kepujian'),
  ('ftkpm', 'bvm', 'BVM Sarjana Muda Teknologi Pemesinan Industri dengan Kepujian'),
  ('fk', 'drc', 'DRC Diploma Sains Komputer'),
  ('fk', 'bcs', 'BCS Sarjana Muda Sains Komputer (Kejuruteraan Perisian) dengan Kepujian'),
  ('fk', 'bcn', 'BCN Sarjana Muda Sains Komputer (Sistem Komputer dan Rangkaian) dengan Kepujian'),
  ('fk', 'bcm', 'BCM Sarjana Muda Sains Komputer (Perisian Multimedia) dengan Kepujian'),
  ('fk', 'bcy', 'BCY Sarjana Muda Sains Komputer (Keselamatan Siber) dengan Kepujian')
) as v(faculty_slug, slug, name)
join public.institutions i on i.slug = 'umpsa'
join public.faculties f on f.institution_id = i.id and f.slug = v.faculty_slug
where not exists (
  select 1 from public.programmes p
  where p.institution_id = i.id and lower(p.name) = lower(v.name)
)
on conflict (institution_id, slug) do nothing;
