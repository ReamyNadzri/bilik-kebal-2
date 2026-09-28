-- Migration: 202610150001_uitm_terengganu_programmes.sql
-- Description: faculties and programmes offered at UiTM Cawangan Terengganu
-- (Dungun, Kuala Terengganu and Bukit Besi campuses).
--
-- Decisions recorded in context/progress-tracker.md (2026-09-28):
-- * Source: the Owner's list compiled from UiTM Cawangan Terengganu pages in
--   September 2026. It is not yet the authoritative taxonomy source the launch
--   gate asks for.
-- * Faculty and programme names are in Malay, as UiTM publishes them (Owner
--   decision). The interface itself stays English.
-- * Faculties and programmes stay institution-wide, under UiTM, with no link
--   to the campus that offers them (Owner decision).
-- * Programmes have no code column, so the UiTM programme code leads the name,
--   the way a course label leads with its code. Where UiTM lists a newer and an
--   older code, the newer code leads and the older follows in brackets.
-- * HM260, HM262 and Pra Diploma Sains are left out until confirmed:
--   HM260/HM262 duplicate HM240/HM242 by name, and the pre-diploma has no
--   faculty.
-- * The existing computer science faculty and bachelor rows keep their ids and
--   slugs, so the Wanteds that reference them are untouched; only their names
--   change.
-- * Rows are added only under the institution with slug 'uitm', never over an
--   existing slug or an existing name.

update public.faculties f
set name = 'Fakulti Sains Komputer dan Matematik',
    updated_at = now()
from public.institutions i
where f.institution_id = i.id
  and i.slug = 'uitm'
  and f.slug = 'fskm'
  and f.name = 'Faculty of Computer and Mathematical Sciences';

update public.programmes p
set name = 'CDCS230 (CS230) Sarjana Muda Sains Komputer (Kepujian)',
    sort_order = 20,
    updated_at = now()
from public.institutions i
where p.institution_id = i.id
  and i.slug = 'uitm'
  and p.slug = 'cs-bachelor'
  and p.name = 'Bachelor of Computer Science';

insert into public.faculties (institution_id, slug, name, sort_order)
select i.id, v.slug, v.name, v.sort_order
from public.institutions i
cross join (values
  ('fskm',                         'Fakulti Sains Komputer dan Matematik',    0),
  ('perakaunan',                   'Fakulti Perakaunan',                     10),
  ('pengurusan-perniagaan',        'Fakulti Pengurusan dan Perniagaan',      20),
  ('kejuruteraan-elektrik',        'Fakulti Kejuruteraan Elektrik',          30),
  ('pengurusan-hotel-pelancongan', 'Fakulti Pengurusan Hotel dan Pelancongan', 40),
  ('kejuruteraan-kimia',           'Fakulti Kejuruteraan Kimia',             50),
  ('kejuruteraan-mekanikal',       'Fakulti Kejuruteraan Mekanikal',         60),
  ('sains-gunaan',                 'Fakulti Sains Gunaan',                   70)
) as v(slug, name, sort_order)
where i.slug = 'uitm'
  and not exists (
    select 1 from public.faculties f
    where f.institution_id = i.id and lower(f.name) = lower(v.name)
  )
on conflict (institution_id, slug) do nothing;

insert into public.programmes (institution_id, faculty_id, slug, name, sort_order)
select f.institution_id, f.id, v.slug, v.name, v.sort_order
from (values
  -- Kuala Terengganu
  ('fskm', 'cdcs110', 'CDCS110 (CS110) Diploma Sains Komputer', 10),
  ('fskm', 'cdcs230', 'CDCS230 (CS230) Sarjana Muda Sains Komputer (Kepujian)', 20),
  ('fskm', 'cdcs264', 'CDCS264 (CS264) Sarjana Muda Sistem Maklumat (Kepujian) Pengkomputeran Perniagaan', 30),
  ('fskm', 'cdcs267', 'CDCS267 (CS267) Sarjana Muda Sains Matematik Pemodelan dan Analitik (Kepujian)', 40),
  ('fskm', 'cdcs270', 'CDCS270 (CS270) Sarjana Muda Sains Komputer (Kepujian) Pengkomputeran Mudah Alih', 50),
  -- Dungun
  ('perakaunan', 'ac151', 'AC151 ACCA Foundation in Accountancy', 10),
  ('perakaunan', 'ac110', 'AC110 Diploma Perakaunan', 20),
  ('perakaunan', 'ac220', 'AC220 Sarjana Muda Perakaunan (Kepujian)', 30),
  ('pengurusan-perniagaan', 'ba114', 'BA114 Diploma Analisis Pelaburan', 10),
  ('pengurusan-perniagaan', 'ba132', 'BA132 Diploma Pengurusan dan Teknologi Pejabat', 20),
  ('pengurusan-perniagaan', 'ba264', 'BA264 Sarjana Muda Pengurusan Perkhidmatan Pelanggan (Kepujian)', 30),
  ('pengurusan-perniagaan', 'ba272', 'BA272 Sarjana Muda Pentadbiran Perniagaan (Kepujian) Kewangan', 40),
  ('pengurusan-perniagaan', 'ba274', 'BA274 Sarjana Muda Pentadbiran Perniagaan (Kepujian) Pengurusan Operasi', 50),
  ('kejuruteraan-elektrik', 'ceee111', 'CEEE111 (EE111) Diploma Kejuruteraan Elektrik (Elektronik)', 10),
  ('kejuruteraan-elektrik', 'ceee112', 'CEEE112 (EE112) Diploma Kejuruteraan Elektrik (Kuasa)', 20),
  ('kejuruteraan-elektrik', 'ceee250', 'CEEE250 Sarjana Muda Teknologi Kejuruteraan Elektronik (Sistem Pintar Elektronik) dengan Kepujian', 30),
  ('pengurusan-hotel-pelancongan', 'hm110', 'HM110 Diploma Pengurusan Hotel', 10),
  ('pengurusan-hotel-pelancongan', 'hm111', 'HM111 Diploma Pengurusan Pelancongan', 20),
  ('pengurusan-hotel-pelancongan', 'hm112', 'HM112 Diploma Pengurusan Perkhidmatan Makanan', 30),
  ('pengurusan-hotel-pelancongan', 'hm115', 'HM115 Diploma Seni Kulinari', 40),
  ('pengurusan-hotel-pelancongan', 'hm240', 'HM240 Sarjana Muda Sains (Kepujian) Pengurusan Hotel', 50),
  ('pengurusan-hotel-pelancongan', 'hm242', 'HM242 Sarjana Muda Sains (Kepujian) Pengurusan Perkhidmatan Makanan', 60),
  -- Bukit Besi
  ('kejuruteraan-kimia', 'eh110', 'EH110 Diploma Kejuruteraan Kimia', 10),
  ('kejuruteraan-mekanikal', 'ceem110', 'CEEM110 Diploma Kejuruteraan Mekanikal', 10),
  ('kejuruteraan-mekanikal', 'ceem246', 'CEEM246 Sarjana Muda Teknologi Kejuruteraan Mekanikal (Kepujian)', 20),
  ('sains-gunaan', 'as124', 'AS124 Diploma Teknologi Higien Industri', 10)
) as v(faculty_slug, slug, name, sort_order)
join public.institutions i on i.slug = 'uitm'
join public.faculties f on f.institution_id = i.id and f.slug = v.faculty_slug
where not exists (
  select 1 from public.programmes p
  where p.institution_id = i.id and lower(p.name) = lower(v.name)
)
on conflict (institution_id, slug) do nothing;
