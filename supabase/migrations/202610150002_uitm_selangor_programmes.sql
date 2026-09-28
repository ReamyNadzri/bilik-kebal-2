-- Migration: 202610150002_uitm_selangor_programmes.sql
-- Description: faculties and programmes offered at UiTM Puncak Alam and
-- UiTM Shah Alam, and one alphabetical order for every faculty and programme.
--
-- Decisions recorded in context/progress-tracker.md (2026-09-28):
-- * Source: the Owner's list compiled from UiTM pages in September 2026. Names
--   the list gave in English were put into Malay here; they are not UiTM's
--   published Malay names and may need correcting. Where the list gave only a
--   field (for example "Journalism"), the name stays that short.
-- * Same rules as 202610150001: Malay names, institution-wide faculties and
--   programmes, code first, newer code leading and older in brackets.
-- * Programmes already present under another campus's list (BA264, BA272,
--   BA274, CS230, CS264, CS267) are not added twice.
-- * UiTM is replacing HM240/HM241/HM242/HM245 with HM260/HM261/HM262/HM265.
--   The HM240 and HM242 rows take the new codes, the old ones in brackets, so a
--   search for either code finds them.
-- * Left out until confirmed: AS290/AS291 (both listed only as "double degree,
--   textile/fashion related") and EM242-EM246 (no campus or name given).
-- * Every faculty and programme now has sort order 0, so lists read
--   alphabetically: faculties by name, programmes by the code their name
--   starts with.

update public.programmes p
set name = v.new_name, updated_at = now()
from public.institutions i,
  (values
    ('hm240', 'HM240 Sarjana Muda Sains (Kepujian) Pengurusan Hotel',
              'HM260 (HM240) Sarjana Muda Sains (Kepujian) Pengurusan Hospitaliti'),
    ('hm242', 'HM242 Sarjana Muda Sains (Kepujian) Pengurusan Perkhidmatan Makanan',
              'HM262 (HM242) Sarjana Muda Sains (Kepujian) Pengurusan Perkhidmatan Makanan')
  ) as v(slug, old_name, new_name)
where p.institution_id = i.id
  and i.slug = 'uitm'
  and p.slug = v.slug
  and p.name = v.old_name;

insert into public.faculties (institution_id, slug, name)
select i.id, v.slug, v.name
from public.institutions i
cross join (values
  ('sains-kesihatan',            'Fakulti Sains Kesihatan'),
  ('farmasi',                    'Fakulti Farmasi'),
  ('pendidikan',                 'Fakulti Pendidikan'),
  ('alam-bina',                  'Fakulti Alam Bina'),
  ('seni-lukis-seni-reka',       'Fakulti Seni Lukis dan Seni Reka'),
  ('komunikasi-pengajian-media', 'Fakulti Komunikasi dan Pengajian Media'),
  ('kejuruteraan-awam',          'Fakulti Kejuruteraan Awam'),
  ('undang-undang',              'Fakulti Undang-Undang'),
  ('sains-sukan-rekreasi',       'Fakulti Sains Sukan dan Rekreasi'),
  ('muzik',                      'Fakulti Muzik'),
  ('acis',                       'Akademi Pengajian Islam Kontemporari'),
  ('pengajian-bahasa',           'Akademi Pengajian Bahasa')
) as v(slug, name)
where i.slug = 'uitm'
  and not exists (
    select 1 from public.faculties f
    where f.institution_id = i.id and lower(f.name) = lower(v.name)
  )
on conflict (institution_id, slug) do nothing;

insert into public.programmes (institution_id, faculty_id, slug, name)
select f.institution_id, f.id, v.slug, v.name
from (values
  -- Puncak Alam
  ('perakaunan', 'ac240', 'AC240 Sarjana Muda Perakaunan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba262', 'BA262 Sarjana Muda Pengurusan Teknologi Perniagaan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba263', 'BA263 Sarjana Muda Keusahawanan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba265', 'BA265 Sarjana Muda Pentadbiran Kesihatan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba266', 'BA266 Sarjana Muda Pengurusan Acara (Kepujian)'),
  ('pengurusan-perniagaan', 'ba270', 'BA270 Sarjana Muda Pemasaran (Kepujian)'),
  ('pengurusan-perniagaan', 'ba271', 'BA271 Sarjana Muda Insurans (Kepujian)'),
  ('pengurusan-perniagaan', 'ba273', 'BA273 Sarjana Muda Pengurusan Sumber Manusia (Kepujian)'),
  ('pengurusan-perniagaan', 'ba275', 'BA275 Sarjana Muda Pengurusan Peruncitan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba276', 'BA276 Sarjana Muda Perniagaan Antarabangsa (Kepujian)'),
  ('pengurusan-perniagaan', 'ba277', 'BA277 Sarjana Muda Pengangkutan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba279', 'BA279 Sarjana Muda Perbankan Islam (Kepujian)'),
  ('pengurusan-perniagaan', 'ba280', 'BA280 Sarjana Muda Ekonomi Perniagaan (Kepujian)'),
  ('pengurusan-perniagaan', 'ba290', 'BA290 Program Ijazah Berganda'),
  ('sains-kesihatan', 'hs240', 'HS240 Sarjana Muda Kejururawatan (Kepujian)'),
  ('sains-kesihatan', 'hs241', 'HS241 Sarjana Muda Teknologi Makmal Perubatan (Kepujian)'),
  ('sains-kesihatan', 'hs242', 'HS242 Sarjana Muda Pengimejan Perubatan (Kepujian)'),
  ('sains-kesihatan', 'hs243', 'HS243 Sarjana Muda Kesihatan dan Keselamatan Persekitaran (Kepujian)'),
  ('sains-kesihatan', 'hs244', 'HS244 Sarjana Muda Fisioterapi (Kepujian)'),
  ('sains-kesihatan', 'hs245', 'HS245 Sarjana Muda Terapi Cara Kerja (Kepujian)'),
  ('sains-kesihatan', 'hs246', 'HS246 Sarjana Muda Optometri (Kepujian)'),
  ('sains-kesihatan', 'hs257', 'HS257 Sarjana Muda Dietetik (Kepujian)'),
  ('farmasi', 'ph240', 'PH240 Sarjana Muda Farmasi (Kepujian)'),
  ('pendidikan', 'ece101', 'ECE101 Diploma Pendidikan Awal Kanak-Kanak'),
  ('pendidikan', 'ed241', 'ED241 Sarjana Muda Pendidikan (Kepujian) TESL'),
  ('pendidikan', 'ed242', 'ED242 Sarjana Muda Pendidikan (Kepujian) Pendidikan Seni dan Seni Reka'),
  ('pendidikan', 'ed246', 'ED246 Sarjana Muda Pendidikan (Kepujian) Pendidikan Jasmani dan Kesihatan'),
  ('pendidikan', 'ed247', 'ED247 Sarjana Muda Pendidikan Sains (Kepujian) Biologi'),
  ('pendidikan', 'ed248', 'ED248 Sarjana Muda Pendidikan Sains (Kepujian) Fizik'),
  ('pendidikan', 'ed249', 'ED249 Sarjana Muda Pendidikan Sains (Kepujian) Matematik'),
  ('pendidikan', 'ed260', 'ED260 Sarjana Muda Pendidikan Sains (Kepujian) Kimia'),
  ('alam-bina', 'be221', 'BE221 Sarjana Muda Perancangan Bandar dan Wilayah (Kepujian)'),
  ('alam-bina', 'be243', 'BE243 Sarjana Muda Sains Seni Bina (Kepujian)'),
  ('alam-bina', 'be247', 'BE247 Sarjana Muda Seni Bina Dalaman (Kepujian)'),
  ('alam-bina', 'be248', 'BE248 Sarjana Muda Seni Bina Landskap (Kepujian)'),
  ('seni-lukis-seni-reka', 'ad233', 'AD233 Reka Bentuk Permainan Kreatif'),
  ('seni-lukis-seni-reka', 'ad250', 'AD250 Teknologi Percetakan'),
  ('seni-lukis-seni-reka', 'ad252', 'AD252 Pengajian Budaya Visual'),
  ('seni-lukis-seni-reka', 'ad261', 'AD261 Reka Bentuk Grafik'),
  ('seni-lukis-seni-reka', 'ad267', 'AD267 Fotomedia Kreatif'),
  ('pengurusan-hotel-pelancongan', 'hm252', 'HM252 Sarjana Muda Sains (Kepujian) Pengurusan Perkhidmatan Makanan dengan Keusahawanan'),
  ('pengurusan-hotel-pelancongan', 'hm261', 'HM261 (HM241) Sarjana Muda Sains (Kepujian) Pengurusan Pelancongan'),
  ('pengurusan-hotel-pelancongan', 'hm265', 'HM265 (HM245) Sarjana Muda Sains (Kepujian) Pengurusan Seni Kulinari'),
  -- Shah Alam
  ('sains-gunaan', 'as211', 'AS211 Sarjana Muda Sains (Kepujian) Biologi'),
  ('sains-gunaan', 'as213', 'AS213 Sarjana Muda Sains (Kepujian) Fizik'),
  ('sains-gunaan', 'as242', 'AS242 Sarjana Muda Sains (Kepujian) Kimia'),
  ('sains-gunaan', 'as249', 'AS249 Sarjana Muda Sains (Kepujian) Teknologi Alam Sekitar'),
  ('sains-gunaan', 'as256', 'AS256 Sarjana Muda Sains (Kepujian) Teknologi Marin Lestari'),
  ('sains-gunaan', 'as260', 'AS260 Sarjana Muda Sains (Kepujian) Teknologi Tekstil dan Pakaian'),
  ('sains-gunaan', 'as263', 'AS263 Sarjana Muda Sains (Kepujian) Teknologi Polimer Kejuruteraan'),
  ('sains-gunaan', 'as265', 'AS265 Sarjana Muda Sains (Kepujian) Kimia Gunaan'),
  ('sains-gunaan', 'as266', 'AS266 Sarjana Muda Sains (Kepujian) Sains dan Teknologi Makanan'),
  ('sains-gunaan', 'as270', 'AS270 Sarjana Muda Sains (Kepujian) Teknologi Sains Bahan'),
  ('fskm', 'cs240', 'CS240 Sarjana Muda Teknologi Maklumat (Kepujian)'),
  ('fskm', 'cs253', 'CS253 Sarjana Muda Sains Komputer (Kepujian) Pengkomputeran Multimedia'),
  ('fskm', 'cs255', 'CS255 Sarjana Muda Sains Komputer (Kepujian) Rangkaian Komputer'),
  ('fskm', 'cs259', 'CS259 Sarjana Muda Sains Komputer (Kepujian) Kejuruteraan Sistem Pintar'),
  ('komunikasi-pengajian-media', 'mc241', 'MC241 Kewartawanan'),
  ('komunikasi-pengajian-media', 'mc242', 'MC242 Perhubungan Awam'),
  ('komunikasi-pengajian-media', 'mc243', 'MC243 Penyiaran'),
  ('komunikasi-pengajian-media', 'mc244', 'MC244 Pengiklanan'),
  ('komunikasi-pengajian-media', 'mc245', 'MC245 Penerbitan'),
  ('komunikasi-pengajian-media', 'mc246', 'MC246 Komunikasi Instruksional dan Latihan'),
  ('komunikasi-pengajian-media', 'mc247', 'MC247 Komunikasi Interpersonal'),
  ('komunikasi-pengajian-media', 'mc248', 'MC248 Pengurusan dan Dasar Komunikasi'),
  ('komunikasi-pengajian-media', 'mc249', 'MC249 Komunikasi Media Baharu'),
  ('alam-bina', 'be220', 'BE220 Sarjana Muda Sains Ukur dan Geomatik (Kepujian)'),
  ('alam-bina', 'be229', 'BE229 Sarjana Muda Ukur Bangunan (Kepujian)'),
  ('alam-bina', 'be246', 'BE246 Sarjana Muda Sains Pengurusan Pembinaan (Kepujian)'),
  ('alam-bina', 'be252', 'BE252 Sarjana Muda Pengurusan Taman dan Rekreasi (Kepujian)'),
  ('alam-bina', 'be254', 'BE254 Sarjana Muda Ukur Bahan (Kepujian)'),
  ('alam-bina', 'be255', 'BE255 Sarjana Muda Hartanah (Kepujian)'),
  ('kejuruteraan-awam', 'ec222', 'EC222 Sarjana Muda Kejuruteraan Awam dengan Kepujian'),
  ('kejuruteraan-awam', 'ec240', 'EC240 Sarjana Muda Teknologi Kejuruteraan Awam (Infrastruktur Kereta Api) dengan Kepujian'),
  ('kejuruteraan-elektrik', 'ceee222', 'CEEE222 Sarjana Muda Kejuruteraan Elektronik dengan Kepujian'),
  ('kejuruteraan-elektrik', 'ceee223', 'CEEE223 Sarjana Muda Kejuruteraan Elektrik dengan Kepujian'),
  ('kejuruteraan-elektrik', 'ceee260', 'CEEE260 Sarjana Muda Teknologi Kejuruteraan Elektrik dan Elektronik dengan Kepujian'),
  ('kejuruteraan-kimia', 'eh225', 'EH225 Sarjana Muda Kejuruteraan Kimia (Alam Sekitar) dengan Kepujian'),
  ('kejuruteraan-kimia', 'eh230', 'EH230 Sarjana Muda Kejuruteraan Kimia dengan Kepujian'),
  ('kejuruteraan-kimia', 'eh253', 'EH253 Sarjana Muda Kejuruteraan Minyak dan Gas dengan Kepujian'),
  ('kejuruteraan-mekanikal', 'em222', 'EM222 Sarjana Muda Kejuruteraan Mekanikal dengan Kepujian'),
  ('undang-undang', 'lw224', 'LW224 Sarjana Muda Undang-Undang (Kepujian)'),
  ('sains-sukan-rekreasi', 'sr111', 'SR111 Diploma Pengurusan Sukan dan Rekreasi'),
  ('sains-sukan-rekreasi', 'sr113', 'SR113 Diploma Pengajian Sukan'),
  ('sains-sukan-rekreasi', 'sr241', 'SR241 Sarjana Muda Pengurusan Sukan (Kepujian)'),
  ('sains-sukan-rekreasi', 'sr243', 'SR243 Sarjana Muda Sains Sukan (Kepujian)'),
  ('sains-sukan-rekreasi', 'sr245', 'SR245 Sarjana Muda Kesihatan dan Kecergasan (Kepujian)'),
  ('muzik', 'mu110', 'MU110 Diploma Muzik'),
  ('muzik', 'mu111', 'MU111 Diploma Produksi Audio Digital'),
  ('muzik', 'mu221', 'MU221 Sarjana Muda Komposisi Muzik'),
  ('muzik', 'mu222', 'MU222 Sarjana Muda Persembahan Muzik'),
  ('muzik', 'mu223', 'MU223 Sarjana Muda Perniagaan Muzik'),
  ('muzik', 'mu230', 'MU230 Sarjana Muda Pendidikan Muzik'),
  ('seni-lukis-seni-reka', 'ad264', 'AD264 Teknologi Reka Bentuk Perindustrian'),
  ('seni-lukis-seni-reka', 'ad265', 'AD265 Seramik Perindustrian'),
  ('seni-lukis-seni-reka', 'ad266', 'AD266 Teknologi Reka Bentuk Fesyen'),
  ('acis', 'ic210', 'IC210 Sarjana Muda Muamalat (Kepujian)'),
  ('acis', 'ic220', 'IC220 Sarjana Muda Pengurusan Industri Halal (Kepujian)'),
  ('pengajian-bahasa', 'lg240', 'LG240 Pengajian Bahasa Gunaan: Bahasa Inggeris untuk Komunikasi Profesional'),
  ('pengajian-bahasa', 'lg241', 'LG241 Pengajian Bahasa Gunaan: Bahasa Melayu untuk Komunikasi Profesional'),
  ('pengajian-bahasa', 'lg242', 'LG242 Pengajian Bahasa Gunaan: Bahasa Arab untuk Komunikasi Profesional')
) as v(faculty_slug, slug, name)
join public.institutions i on i.slug = 'uitm'
join public.faculties f on f.institution_id = i.id and f.slug = v.faculty_slug
where not exists (
  select 1 from public.programmes p
  where p.institution_id = i.id and lower(p.name) = lower(v.name)
)
on conflict (institution_id, slug) do nothing;

update public.faculties f
set sort_order = 0, updated_at = now()
from public.institutions i
where f.institution_id = i.id and i.slug = 'uitm' and f.sort_order <> 0;

update public.programmes p
set sort_order = 0, updated_at = now()
from public.institutions i
where p.institution_id = i.id and i.slug = 'uitm' and p.sort_order <> 0;
