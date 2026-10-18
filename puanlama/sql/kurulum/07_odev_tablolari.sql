-- =====================================================================================
-- ODEV KONTROLU: YENI TABLOLAR (wc_odev_kontrolleri, wc_odev_duzeltmeleri)
-- =====================================================================================
-- BU DOSYA KALICI DEGISIKLIK YAPAR (iki tablo, iki tetikleyici fonksiyonu, politikalar ekler).
-- Mevcut hicbir tabloya, fonksiyona ya da veriye dokunmaz. Tek islemdedir (begin ... commit):
-- bir hata olursa hicbir sey kurulmaz. Once bu dosyayi oku, sonra Supabase SQL Editor'de calistir.
-- Calistirdiktan sonra wc_odev_dogrulama.sql dosyasini calistir (kendini geri alan rapor).
--
-- NE KURULUR
--   wc_odev_kontrolleri : her satir "bu ogrenci su tarihte bu odevden toplam kac kez yazdi" kaydi.
--                         "gereken" o gunku bant sayisidir (sonradan puan duzelse de bu satirda DEGISMEZ).
--                         Ayni (ogrenci, kaynak sinav, tarih) icin EN SON eklenen satir gecerlidir;
--                         iptal = true olan en son satir o tarihin kaydini kaldirir. Satir silinmez/guncellenmez.
--   wc_odev_duzeltmeleri: ekstra artı (odev basina en cok 1) ve elle duzeltme (+/-, nedeni zorunlu) kayitlari.
--                         Silinmez/guncellenmez; hatayi geri almak icin ters isaretli yeni kayit eklenir.
--
-- GUVENLIK (mevcut puan tablosu wc_exam_scores ile ayni kalip, yeni yetki mekanizmasi YOK)
--   * RLS acik. Yalnizca "authenticated" rolune select ve insert politikasi var:
--       wc_exam_in_my_school(kaynak_exam_id) AND wc_can_enter_scores(student_id)
--     (yonetici hepsi; ogretmen yalnizca wc_staff_scopes'taki kademe/subeler).
--   * update / delete politikasi YOK; authenticated'dan select ve insert disindaki TUM yetkiler alindi
--     (update, delete, truncate, references, trigger). anon ve public'in hicbir yetkisi yok.
--   * Tetikleyici, istemciden gelen entered_by, created_at, grade_at_entry, class_name_at_entry
--     degerlerini EZER (veritabani doldurur). Kaynak sinavin kademesi ogrencinin kademesiyle uyusmali.
--   * Tarih (kontrol_tarihi / tarih) Istanbul gunune gore bugunden ileri olamaz.
--   * ogrenci ve sinav silinmesi, bu tablolarda kayit varken ENGELLENIR (ON DELETE RESTRICT).
--     Not: bu, kayitli odevi olan ogrencinin silinmesini de engeller (puan kaydi olan ogrenci gibi).
--
-- VARSAYIMLAR (mevcut nesnelerden okuduklarima gore; uyusmazsa SQL hata verir ve HICBIR SEY KURULMAZ)
--   wc_exam_in_my_school(uuid) ve wc_can_enter_scores(uuid) boolean doner; students.id, wc_exams.id,
--   wc_staff.id uuid; wc_exams.grade ve students.grade smallint.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- 1) Tablolar
-- -------------------------------------------------------------------------------------
create table public.wc_odev_kontrolleri (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  kaynak_exam_id uuid not null references public.wc_exams (id) on delete restrict,
  kontrol_tarihi date not null,
  toplam_yazilan smallint not null,
  gereken smallint not null,
  iptal boolean not null default false,
  grade_at_entry smallint not null,                          -- tetikleyici doldurur
  class_name_at_entry varchar,                               -- tetikleyici doldurur (ogrencinin subesi bossa bos)
  entered_by uuid not null references public.wc_staff (id),  -- tetikleyici doldurur
  created_at timestamptz not null default now(),    -- tetikleyici ezer
  constraint wc_odev_kontrolleri_toplam_chk check (toplam_yazilan between 0 and 10),
  constraint wc_odev_kontrolleri_gereken_chk check (gereken between 1 and 5)
);

create table public.wc_odev_duzeltmeleri (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  kaynak_exam_id uuid not null references public.wc_exams (id) on delete restrict,
  tur text not null,
  puan smallint not null,
  tarih date not null,              -- donem icin (ekstra artı / duzeltmenin yapildigi gun)
  neden text,
  grade_at_entry smallint not null,                          -- tetikleyici doldurur
  class_name_at_entry varchar,                               -- tetikleyici doldurur (ogrencinin subesi bossa bos)
  entered_by uuid not null references public.wc_staff (id),  -- tetikleyici doldurur
  created_at timestamptz not null default now(),    -- tetikleyici ezer
  constraint wc_odev_duzeltmeleri_tur_chk check (tur in ('ekstra_arti', 'elle')),
  constraint wc_odev_duzeltmeleri_puan_chk check (puan <> 0),
  constraint wc_odev_duzeltmeleri_ekstra_chk check (tur <> 'ekstra_arti' or puan = 1),
  constraint wc_odev_duzeltmeleri_neden_chk check (tur <> 'elle' or (neden is not null and btrim(neden) <> ''))
);

-- Ekstra artı: (ogrenci, kaynak sinav) basina en cok 1
create unique index wc_odev_duzeltmeleri_ekstra_uq
  on public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id)
  where tur = 'ekstra_arti';

-- Sorgu ve yabanci anahtar (silme engeli) denetimleri icin indeksler
create index wc_odev_kontrolleri_sinav_ogrenci_idx on public.wc_odev_kontrolleri (kaynak_exam_id, student_id, kontrol_tarihi);
create index wc_odev_kontrolleri_ogrenci_idx on public.wc_odev_kontrolleri (student_id);
create index wc_odev_duzeltmeleri_sinav_ogrenci_idx on public.wc_odev_duzeltmeleri (kaynak_exam_id, student_id);
create index wc_odev_duzeltmeleri_ogrenci_idx on public.wc_odev_duzeltmeleri (student_id);

-- -------------------------------------------------------------------------------------
-- 2) Tetikleyiciler (INSERT oncesi): istemciden gelen alanlari ez, kurallari denetle
--    SECURITY DEFINER: ogrenci ve sinavi RLS'e takilmadan okuyabilsin. Yetki denetimi yine RLS'in
--    WITH CHECK kosuluyla yapilir (asagida); tetikleyici yetki vermez, yalnizca alanlari doldurur.
-- -------------------------------------------------------------------------------------
create function public.wc_odev_kontrol_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_grade smallint;
  v_class varchar;
  v_sinav_kademe smallint;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadi: odev kaydi yalnizca giris yapmis kullanici tarafindan eklenebilir.';
  end if;

  select s.grade, s.class_name into v_grade, v_class
  from public.students s where s.id = new.student_id;
  if not found then
    raise exception 'Ogrenci bulunamadi.';
  end if;

  select e.grade into v_sinav_kademe from public.wc_exams e where e.id = new.kaynak_exam_id;
  if not found then
    raise exception 'Kaynak sinav bulunamadi.';
  end if;
  if v_sinav_kademe <> v_grade then
    raise exception 'Ogrencinin kademesi (%) kaynak sinavin kademesiyle (%) uyusmuyor.', v_grade, v_sinav_kademe;
  end if;

  if new.kontrol_tarihi > v_bugun then
    raise exception 'Kontrol tarihi bugunden ileri olamaz (Istanbul tarihi: %).', v_bugun;
  end if;

  -- Istemciden gelen degerler ezilir
  new.entered_by := v_uid;
  new.created_at := clock_timestamp();   -- ayni islemde eklenen satirlar da kendi aralarinda sirali olsun
  new.grade_at_entry := v_grade;
  new.class_name_at_entry := v_class;
  return new;
end
$$;

create function public.wc_odev_duzeltme_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_grade smallint;
  v_class varchar;
  v_sinav_kademe smallint;
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadi: odev duzeltmesi yalnizca giris yapmis kullanici tarafindan eklenebilir.';
  end if;

  select s.grade, s.class_name into v_grade, v_class
  from public.students s where s.id = new.student_id;
  if not found then
    raise exception 'Ogrenci bulunamadi.';
  end if;

  select e.grade into v_sinav_kademe from public.wc_exams e where e.id = new.kaynak_exam_id;
  if not found then
    raise exception 'Kaynak sinav bulunamadi.';
  end if;
  if v_sinav_kademe <> v_grade then
    raise exception 'Ogrencinin kademesi (%) kaynak sinavin kademesiyle (%) uyusmuyor.', v_grade, v_sinav_kademe;
  end if;

  if new.tarih > v_bugun then
    raise exception 'Duzeltme tarihi bugunden ileri olamaz (Istanbul tarihi: %).', v_bugun;
  end if;

  new.entered_by := v_uid;
  new.created_at := clock_timestamp();
  new.grade_at_entry := v_grade;
  new.class_name_at_entry := v_class;
  return new;
end
$$;

revoke execute on function public.wc_odev_kontrol_guard() from public, anon, authenticated;
revoke execute on function public.wc_odev_duzeltme_guard() from public, anon, authenticated;

create trigger wc_odev_kontrolleri_guard_trg
  before insert on public.wc_odev_kontrolleri
  for each row execute function public.wc_odev_kontrol_guard();

create trigger wc_odev_duzeltmeleri_guard_trg
  before insert on public.wc_odev_duzeltmeleri
  for each row execute function public.wc_odev_duzeltme_guard();

-- -------------------------------------------------------------------------------------
-- 3) Yetkiler: yalnizca authenticated'a select + insert. Baska hicbir rolde (anon, public) yetki yok.
-- -------------------------------------------------------------------------------------
revoke all on public.wc_odev_kontrolleri from public, anon, authenticated;
revoke all on public.wc_odev_duzeltmeleri from public, anon, authenticated;
grant select, insert on public.wc_odev_kontrolleri to authenticated;
grant select, insert on public.wc_odev_duzeltmeleri to authenticated;

-- -------------------------------------------------------------------------------------
-- 4) RLS: wc_exam_scores ile ayni kosul. update/delete politikasi YOK.
--    wc_is_staff() eklendi: wc_can_enter_scores zaten aktif personeli denetliyorsa gereksizdir, yalnizca kisitlar.
-- -------------------------------------------------------------------------------------
alter table public.wc_odev_kontrolleri enable row level security;
alter table public.wc_odev_duzeltmeleri enable row level security;

create policy wc_odev_kontrolleri_select on public.wc_odev_kontrolleri
  for select to authenticated
  using (public.wc_is_staff() and public.wc_exam_in_my_school(kaynak_exam_id) and public.wc_can_enter_scores(student_id));

create policy wc_odev_kontrolleri_insert on public.wc_odev_kontrolleri
  for insert to authenticated
  with check (public.wc_is_staff() and public.wc_exam_in_my_school(kaynak_exam_id) and public.wc_can_enter_scores(student_id));

create policy wc_odev_duzeltmeleri_select on public.wc_odev_duzeltmeleri
  for select to authenticated
  using (public.wc_is_staff() and public.wc_exam_in_my_school(kaynak_exam_id) and public.wc_can_enter_scores(student_id));

create policy wc_odev_duzeltmeleri_insert on public.wc_odev_duzeltmeleri
  for insert to authenticated
  with check (public.wc_is_staff() and public.wc_exam_in_my_school(kaynak_exam_id) and public.wc_can_enter_scores(student_id));

commit;

-- =====================================================================================
-- GERI ALMA (yorum satiri; gerekirse tek tek calistir)
-- UYARI: DROP TABLE bu tablolardaki TUM odev kayitlarini kalici olarak siler. Kayit girildikten sonra
--        calistirmak veri kaybidir; yalnizca kurulum hemen geri alinacaksa kullan.
-- =====================================================================================
-- drop table public.wc_odev_duzeltmeleri;
-- drop table public.wc_odev_kontrolleri;
-- drop function public.wc_odev_duzeltme_guard();
-- drop function public.wc_odev_kontrol_guard();
-- (tetikleyiciler, indeksler, politikalar ve yetkiler tablolarla birlikte silinir)

-- =====================================================================================
-- KURULUM SONRASI HIZLI KONTROL (yalnizca okur; ayrintili sinama wc_odev_dogrulama.sql'dedir)
-- =====================================================================================
-- select c.relname, c.relrowsecurity as rls_acik,
--        (select string_agg(p.cmd || ':' || p.policyname, ', ') from pg_policies p
--          where p.schemaname = 'public' and p.tablename = c.relname) as politikalar
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname in ('wc_odev_kontrolleri', 'wc_odev_duzeltmeleri');
--   Beklenen: rls_acik = true; politikalar yalnizca SELECT ve INSERT.
