-- =====================================================================================
-- ODEV KONTROLU: DOGRULAMA RAPORU (kendini geri alir; kalici hicbir sey yazmaz)
-- =====================================================================================
-- wc_odev_tablolari.sql calistirildiktan sonra tek seferde calistir.
-- Gecici ZZ- test verisi olusturur, senaryolari dener, sonucu tablo olarak verir ve SONUNDA HER SEYI GERI ALIR
-- (rollback): gercek verinize hicbir sey yazilmaz. COMMIT YOK.
-- SONDA HATA BEKLENIYOR: rapor editorde bir HATA MESAJI olarak gorunur ("BU BIR HATA DEGIL, RAPORDUR").
-- Beklenen: mesajin basinda "RAPORDUR: N / N GECTI" (N ayni sayi) ve her satirda  GECTI .
-- KALDI gorursen o satirin yanindaki mesaji aynen yaz. RAPORDAN ONCE baska bir hata gorursen onu aynen yaz.
-- Editor "current transaction is aborted" derse once  rollback;  calistir.
--
-- CALISTIRMADAN ONCE DOLDURULACAK YERLER (yalnizca SQL Editor'e yapistirdigin kopyada doldur; dosyada birakma):
--   <<YONETICI_KULLANICI_ADI>> : yonetici hesabinin kullanici adi (dosyada 3 yerde gecer; hepsini degistir)
--   <<OGRETMEN_UID>>           : aktif bir OGRETMENIN User UID degeri (Authentication > Users). Bu ogretmenin
--                                wc_staff_scopes'ta en az bir tek subeli yetkisi (ornek 7-A) olmali ve ayni kademede
--                                kademenin TUMU icin ayrica bir yetkisi olmamali. Kimlik gercek bir ogretmen olsa da
--                                hicbir kaydi degismez; yalnizca onun gibi giris yapmis gibi sinanir.
-- Test ogrencileri gercek okulda ZZ- ile baslayan numaralarla olusur ve rollback ile silinir.
-- =====================================================================================

begin;

create temp table rapor (sira integer, test text, beklenen text, sonuc text);

-- Yonetici kimligi (wc_staff: role = admin, username = <<YONETICI_KULLANICI_ADI>>, aktif tek kayit)
do $y$
declare
  v_adet integer;
  v_id uuid;
begin
  select count(*), min(id::text)::uuid into v_adet, v_id
  from public.wc_staff
  where role = 'admin' and username = '<<YONETICI_KULLANICI_ADI>>' and is_active;
  if v_adet <> 1 then
    raise exception 'YONETICI KAYDI BULUNAMADI: wc_staff icinde role = admin ve username = <<YONETICI_KULLANICI_ADI>> olan aktif kayit sayisi % (1 olmali). Rapor calistirilmadi.', v_adet;
  end if;
  perform set_config('zz.yonetici', v_id::text, true);
end
$y$;

-- Ogretmen kimligi ve yetkisi: tek subeli bir yetki secilir (kademe g, sube s); yetkisiz sube y bulunur
do $o$
declare
  v_uid uuid := '<<OGRETMEN_UID>>'::uuid;
  v_g smallint;
  v_s varchar;
  v_y text;
begin
  if not exists (select 1 from public.wc_staff where id = v_uid and role = 'teacher' and is_active) then
    raise exception 'OGRETMEN BULUNAMADI: <<OGRETMEN_UID>> aktif bir ogretmene ait degil. Rapor calistirilmadi.';
  end if;
  select sc.grade, sc.class_name into v_g, v_s
  from public.wc_staff_scopes sc
  where sc.staff_id = v_uid
    and sc.class_name is not null
    and not exists (select 1 from public.wc_staff_scopes x where x.staff_id = v_uid and x.grade = sc.grade and x.class_name is null)
  order by sc.grade, sc.class_name
  limit 1;
  if v_g is null then
    raise exception 'Bu ogretmenin, kademenin tumunu kapsamayan tek subeli bir yetkisi yok (ornek 7-A). Baska bir ogretmen sec. Rapor calistirilmadi.';
  end if;
  select u.l into v_y
  from unnest(array['Y', 'X', 'W', 'V', 'Q']) as u(l)
  where not exists (select 1 from public.wc_staff_scopes x where x.staff_id = v_uid and x.grade = v_g and x.class_name = u.l)
  limit 1;
  perform set_config('zz.o_uid', v_uid::text, true);
  perform set_config('zz.o_g', v_g::text, true);
  perform set_config('zz.o_s', v_s::text, true);
  perform set_config('zz.o_y', v_y, true);
end
$o$;

-- Yardimci 1: bir komutu belirli bir rol ve kimlikle dener. beklenen: IZIN (hata vermemeli) ya da HATA (vermeli).
-- p_parca: HATA beklenirken hata mesajinda gecmesi gereken ifade. p_sub bos birakilirsa yonetici kimligi kullanilir.
create function pg_temp.dene(
  p_sira integer,
  p_test text,
  p_sql text,
  p_beklenen text,
  p_parca text default null,
  p_rol text default null,
  p_sub text default null
) returns void
language plpgsql
as $f$
declare
  v_sonuc text;
  v_sub text := coalesce(p_sub, current_setting('zz.yonetici'));
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_sub, 'role', 'authenticated')::text, true);
  begin
    if p_rol is not null then
      execute format('set local role %I', p_rol);
    end if;
    execute p_sql;
    execute 'reset role';
    v_sonuc := case when p_beklenen = 'IZIN' then 'GECTI' else 'KALDI: hata vermedi' end;
  exception when others then
    execute 'reset role';
    v_sonuc := case
      when p_beklenen = 'HATA' and (p_parca is null or position(p_parca in sqlerrm) > 0) then 'GECTI'
      else 'KALDI: ' || sqlerrm
    end;
  end;
  insert into rapor values (p_sira, p_test, p_beklenen, v_sonuc);
end
$f$;

-- Yardimci 2: bir kosulun dogru olup olmadigini kontrol eder (sahip rolunde).
create function pg_temp.kontrol(p_sira integer, p_test text, p_kosul text) returns void
language plpgsql
as $f$
declare
  v_ok boolean;
begin
  execute 'select coalesce(' || p_kosul || ', false)' into v_ok;
  insert into rapor values (p_sira, p_test, 'DOGRU', case when v_ok then 'GECTI' else 'KALDI' end);
end
$f$;

-- Yardimci 3: bir sayim sorgusunu belirli rol ve kimlikle calistirir, sonucu beklenen sayiyla karsilastirir.
create function pg_temp.say(p_sira integer, p_test text, p_sql text, p_beklenen bigint, p_rol text, p_sub text) returns void
language plpgsql
as $f$
declare
  v_say bigint;
  v_sonuc text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
  begin
    execute format('set local role %I', p_rol);
    execute p_sql into v_say;
    execute 'reset role';
    v_sonuc := case when v_say = p_beklenen then 'GECTI' else 'KALDI: ' || coalesce(v_say::text, 'bos') end;
  exception when others then
    execute 'reset role';
    v_sonuc := 'KALDI: ' || sqlerrm;
  end;
  insert into rapor values (p_sira, p_test, 'SAYI ' || p_beklenen, v_sonuc);
end
$f$;

-- ---------------------------------------------------------------------------------------------
-- Gecici test verisi (hepsi geri alinir)
-- ---------------------------------------------------------------------------------------------
insert into public.schools (school_code, school_name) values ('ZZ-OKUL', 'ZZ TEST OKULU');

insert into public.students (school_id, student_no, full_name, class_name, grade)
select o.id, v.numara, v.ad, v.sube, v.kademe
from public.schools o
cross join (values
  ('ZZ-O1', 'ZZ ODEV BIR', 'T', 8),
  ('ZZ-O2', 'ZZ ODEV IKI', 'T', 8),
  ('ZZ-OG', 'ZZ OGRETMENIN SUBESI', current_setting('zz.o_s'), current_setting('zz.o_g')::int),
  ('ZZ-OY', 'ZZ OGRETMENIN DISI SUBE', current_setting('zz.o_y'), current_setting('zz.o_g')::int)
) as v(numara, ad, sube, kademe)
where o.school_code = '767124';

insert into public.students (school_id, student_no, full_name, class_name, grade)
select o.id, 'ZZ-X1', 'ZZ BASKA OKUL', 'T', 8
from public.schools o
where o.school_code = 'ZZ-OKUL';

-- aktif sezonda 7., 8. ve ogretmenin kademesi icin 97. unite test sinavi (25 soru)
insert into public.wc_exams (season_id, grade, unit_no, question_count, points_per_question)
select se.id, g.kademe::smallint, 97, 25, 4
from public.wc_seasons se
join public.schools o on o.id = se.school_id
cross join (select distinct x as kademe from (values (7), (8), (current_setting('zz.o_g')::int)) v(x)) g
where o.school_code = '767124' and se.is_active;

-- Kimlikleri, rol degistirince okunabilsin diye ayar olarak sakla
select set_config('zz.s7', (select e.id::text from public.wc_exams e where e.unit_no = 97 and e.grade = 7), true),
       set_config('zz.s8', (select e.id::text from public.wc_exams e where e.unit_no = 97 and e.grade = 8), true),
       set_config('zz.sg', (select e.id::text from public.wc_exams e where e.unit_no = 97 and e.grade = current_setting('zz.o_g')::int), true),
       set_config('zz.st_o1', (select id::text from public.students where student_no = 'ZZ-O1'), true),
       set_config('zz.st_o2', (select id::text from public.students where student_no = 'ZZ-O2'), true),
       set_config('zz.st_og', (select id::text from public.students where student_no = 'ZZ-OG'), true),
       set_config('zz.st_oy', (select id::text from public.students where student_no = 'ZZ-OY'), true),
       set_config('zz.st_x1', (select id::text from public.students where student_no = 'ZZ-X1'), true);

-- ---------------------------------------------------------------------------------------------
-- Senaryolar ("authenticated" = giris yapmis kullanici, RLS dahil; "anon" = giris yapmamis)
-- ---------------------------------------------------------------------------------------------
select pg_temp.kontrol(1, 'anon rolunun iki tabloda HICBIR yetkisi yok', $q$(select not exists (select 1 from (values ('wc_odev_kontrolleri'),('wc_odev_duzeltmeleri')) t(n), (values ('select'),('insert'),('update'),('delete'),('truncate'),('references'),('trigger')) p(x) where has_table_privilege('anon', 'public.' || t.n, p.x)))$q$);
select pg_temp.kontrol(2, 'authenticated: yalnizca select ve insert var (update, delete, truncate, references, trigger YOK)', $q$(select not exists (select 1 from (values ('wc_odev_kontrolleri'),('wc_odev_duzeltmeleri')) t(n), (values ('update'),('delete'),('truncate'),('references'),('trigger')) p(x) where has_table_privilege('authenticated', 'public.' || t.n, p.x)) and not exists (select 1 from (values ('wc_odev_kontrolleri'),('wc_odev_duzeltmeleri')) t(n), (values ('select'),('insert')) p(x) where not has_table_privilege('authenticated', 'public.' || t.n, p.x)))$q$);
select pg_temp.kontrol(3, 'RLS iki tabloda da acik', $q$(select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('wc_odev_kontrolleri','wc_odev_duzeltmeleri') and c.relrowsecurity) = 2$q$);
select pg_temp.kontrol(4, 'Politikalar: toplam 4, hepsi SELECT ya da INSERT (update/delete politikasi YOK), hepsi authenticated''a', $q$(select count(*) from pg_policies where schemaname = 'public' and tablename in ('wc_odev_kontrolleri','wc_odev_duzeltmeleri')) = 4 and not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('wc_odev_kontrolleri','wc_odev_duzeltmeleri') and (cmd not in ('SELECT','INSERT') or roles::text <> '{authenticated}'))$q$);
select pg_temp.kontrol(5, 'Tetikleyici fonksiyonlarini anon ve authenticated dogrudan calistiramaz', $q$(select not has_function_privilege('anon', 'public.wc_odev_kontrol_guard()', 'execute') and not has_function_privilege('authenticated', 'public.wc_odev_kontrol_guard()', 'execute') and not has_function_privilege('anon', 'public.wc_odev_duzeltme_guard()', 'execute') and not has_function_privilege('authenticated', 'public.wc_odev_duzeltme_guard()', 'execute'))$q$);
select pg_temp.dene(6, 'Yonetici kontrol kaydi ekleyebilir', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.dene(7, 'Istemciden gelen entered_by / created_at / grade_at_entry / class_name_at_entry ile ekleme kabul edilir (degerler ezilecek)', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken, entered_by, created_at, grade_at_entry, class_name_at_entry) values (current_setting('zz.st_o2')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date - 3, 0, 2, '00000000-0000-0000-0000-0000000000ff', '2000-01-01', 5, 'Q')$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.kontrol(8, 'Sahte degerler EZILDI: entered_by = gercek yonetici, created_at simdiki zaman, grade_at_entry = 8, class_name_at_entry = T', $q$(select entered_by = current_setting('zz.yonetici')::uuid and created_at > now() - interval '5 minutes' and grade_at_entry = 8 and class_name_at_entry = 'T' from public.wc_odev_kontrolleri where student_id = current_setting('zz.st_o2')::uuid)$q$);
select pg_temp.dene(9, 'Ileri tarihli kontrol reddedilir (Istanbul gunune gore): HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date + 1, 1, 2)$q$, 'HATA', 'ileri olamaz', 'authenticated', null);
select pg_temp.dene(10, 'Geriye donuk (dun) tarihli kontrol kabul edilir', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date - 1, 1, 2)$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.dene(11, 'toplam_yazilan 11 reddedilir: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 11, 2)$q$, 'HATA', 'toplam_chk', 'authenticated', null);
select pg_temp.dene(12, 'toplam_yazilan -1 reddedilir: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, -1, 2)$q$, 'HATA', 'toplam_chk', 'authenticated', null);
select pg_temp.dene(13, 'gereken 0 reddedilir: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 0, 0)$q$, 'HATA', 'gereken_chk', 'authenticated', null);
select pg_temp.dene(14, 'gereken 6 reddedilir: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 0, 6)$q$, 'HATA', 'gereken_chk', 'authenticated', null);
select pg_temp.dene(15, 'Kaynak sinavin kademesi ogrencininkiyle uyusmazsa (8. kademe ogrenci + 7. kademe sinavi) reddedilir: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s7')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'HATA', 'uyusmuyor', 'authenticated', null);
select pg_temp.dene(16, 'iptal satiri eklenebilir (en son satir iptalse o tarihin kaydi kalkar)', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken, iptal) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date - 1, 1, 2, true)$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.dene(17, 'Baska okulun ogrencisine kontrol eklenemez (RLS): HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_x1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'HATA', 'row-level security', 'authenticated', null);
select pg_temp.dene(18, 'Personel olmayan kimlik kontrol ekleyemez (RLS): HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'HATA', 'row-level security', 'authenticated', '00000000-0000-0000-0000-0000000000aa');
select pg_temp.dene(19, 'anon kontrol ekleyemez: HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'HATA', 'permission denied', 'anon', null);
select pg_temp.dene(20, 'anon kontrol kayitlarini okuyamaz: HATA', $q$select count(*) from public.wc_odev_kontrolleri$q$, 'HATA', 'permission denied', 'anon', null);
select pg_temp.dene(21, 'Oturumsuz (jwt iddiasinda sub yok, auth.uid() bos) ekleme reddedilir: HATA', $q$do $d$ begin perform set_config('request.jwt.claims', '{"role":"authenticated"}', true); insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2); end $d$$q$, 'HATA', 'Oturum bulunamadi', 'authenticated', null);
select pg_temp.dene(22, 'Ogretmen, YETKILI subedeki ogrenciye kontrol ekleyebilir', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_og')::uuid, current_setting('zz.sg')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'IZIN', null, 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(23, 'Ogretmen, yetkisiz subedeki ogrenciye kontrol ekleyemez (RLS): HATA', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_oy')::uuid, current_setting('zz.sg')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'HATA', 'row-level security', 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(24, 'Yonetici, ogretmenin yetkisiz oldugu subedeki ogrenciye kontrol ekleyebilir (hazirlik)', $q$insert into public.wc_odev_kontrolleri (student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken) values (current_setting('zz.st_oy')::uuid, current_setting('zz.sg')::uuid, (now() at time zone 'Europe/Istanbul')::date, 1, 2)$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.say(25, 'Ogretmen yalnizca yetkili subedeki kontrolu gorur (yetkili ogrenci: 1 satir)', $q$select count(*) from public.wc_odev_kontrolleri where student_id = current_setting('zz.st_og')::uuid$q$, 1, 'authenticated', current_setting('zz.o_uid'));
select pg_temp.say(26, 'Ogretmen yetkisiz subedeki kontrolu GORMEZ (0 satir)', $q$select count(*) from public.wc_odev_kontrolleri where student_id = current_setting('zz.st_oy')::uuid$q$, 0, 'authenticated', current_setting('zz.o_uid'));
select pg_temp.say(27, 'Yonetici ikisini de gorur (2 satir)', $q$select count(*) from public.wc_odev_kontrolleri where student_id in (current_setting('zz.st_og')::uuid, current_setting('zz.st_oy')::uuid)$q$, 2, 'authenticated', current_setting('zz.yonetici'));
select pg_temp.dene(28, 'Ogretmen kontrol kaydini guncelleyemez: HATA', $q$update public.wc_odev_kontrolleri set toplam_yazilan = 5$q$, 'HATA', 'permission denied', 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(29, 'Ogretmen kontrol kaydini silemez: HATA', $q$delete from public.wc_odev_kontrolleri$q$, 'HATA', 'permission denied', 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(30, 'Yonetici bile kontrol kaydini guncelleyemez: HATA', $q$update public.wc_odev_kontrolleri set toplam_yazilan = 5$q$, 'HATA', 'permission denied', 'authenticated', null);
select pg_temp.dene(31, 'Yonetici bile kontrol kaydini silemez: HATA', $q$delete from public.wc_odev_kontrolleri$q$, 'HATA', 'permission denied', 'authenticated', null);
select pg_temp.dene(32, 'Yonetici bile tabloyu bosaltamaz (truncate): HATA', $q$truncate public.wc_odev_kontrolleri$q$, 'HATA', 'permission denied', 'authenticated', null);
select pg_temp.dene(33, 'Odev kaydi olan ogrenci silinemez (ON DELETE RESTRICT): HATA', $q$delete from public.students where id = current_setting('zz.st_o1')::uuid$q$, 'HATA', 'foreign key', null, null);
select pg_temp.dene(34, 'Odev kaydi olan sinav silinemez (ON DELETE RESTRICT): HATA', $q$delete from public.wc_exams where id = current_setting('zz.s8')::uuid$q$, 'HATA', 'foreign key', null, null);
select pg_temp.dene(35, 'Yonetici ekstra artı ekleyebilir', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'ekstra_arti', 1, (now() at time zone 'Europe/Istanbul')::date, null)$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.dene(36, 'Ayni ogrenci ve sinav icin ikinci ekstra artı reddedilir: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'ekstra_arti', 1, (now() at time zone 'Europe/Istanbul')::date - 1, null)$q$, 'HATA', 'ekstra_uq', 'authenticated', null);
select pg_temp.dene(37, 'Ekstra artı puani 1 disinda olamaz (2): HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o2')::uuid, current_setting('zz.s8')::uuid, 'ekstra_arti', 2, (now() at time zone 'Europe/Istanbul')::date, null)$q$, 'HATA', 'ekstra_chk', 'authenticated', null);
select pg_temp.dene(38, 'Elle duzeltmede puan sifir olamaz: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'elle', 0, (now() at time zone 'Europe/Istanbul')::date, 'neden')$q$, 'HATA', 'puan_chk', 'authenticated', null);
select pg_temp.dene(39, 'Elle duzeltmede neden zorunlu (bos/null): HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'elle', -1, (now() at time zone 'Europe/Istanbul')::date, null)$q$, 'HATA', 'neden_chk', 'authenticated', null);
select pg_temp.dene(40, 'Elle duzeltmede neden yalnizca bosluk olamaz: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'elle', -1, (now() at time zone 'Europe/Istanbul')::date, '   ')$q$, 'HATA', 'neden_chk', 'authenticated', null);
select pg_temp.dene(41, 'Elle duzeltme (neden dolu, eksi puan) eklenebilir', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'elle', -2, (now() at time zone 'Europe/Istanbul')::date, 'Puan duzeltildi, onceki eksiler geri alindi')$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.dene(42, 'Bilinmeyen tur reddedilir: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o2')::uuid, current_setting('zz.s8')::uuid, 'baska', 1, (now() at time zone 'Europe/Istanbul')::date, 'x')$q$, 'HATA', 'tur_chk', 'authenticated', null);
select pg_temp.dene(43, 'Ileri tarihli duzeltme reddedilir: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o2')::uuid, current_setting('zz.s8')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date + 1, 'x')$q$, 'HATA', 'ileri olamaz', 'authenticated', null);
select pg_temp.dene(44, 'Duzeltmede kademe uyusmazligi reddedilir: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s7')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'x')$q$, 'HATA', 'uyusmuyor', 'authenticated', null);
select pg_temp.dene(45, 'Duzeltmede sahte entered_by/created_at/grade/sube ile ekleme kabul edilir (ezilecek)', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden, entered_by, created_at, grade_at_entry, class_name_at_entry) values (current_setting('zz.st_o2')::uuid, current_setting('zz.s8')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'sahte alan denemesi', '00000000-0000-0000-0000-0000000000ff', '2000-01-01', 5, 'Q')$q$, 'IZIN', null, 'authenticated', null);
select pg_temp.kontrol(46, 'Duzeltmede sahte degerler EZILDI', $q$(select entered_by = current_setting('zz.yonetici')::uuid and created_at > now() - interval '5 minutes' and grade_at_entry = 8 and class_name_at_entry = 'T' from public.wc_odev_duzeltmeleri where student_id = current_setting('zz.st_o2')::uuid and neden = 'sahte alan denemesi')$q$);
select pg_temp.dene(47, 'Ogretmen, YETKILI subedeki ogrenciye duzeltme ekleyebilir', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_og')::uuid, current_setting('zz.sg')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'yetkili sube')$q$, 'IZIN', null, 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(48, 'Ogretmen, yetkisiz subedeki ogrenciye duzeltme ekleyemez (RLS): HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_oy')::uuid, current_setting('zz.sg')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'yetkisiz sube')$q$, 'HATA', 'row-level security', 'authenticated', current_setting('zz.o_uid'));
select pg_temp.dene(49, 'Baska okulun ogrencisine duzeltme eklenemez (RLS): HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_x1')::uuid, current_setting('zz.s8')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'x')$q$, 'HATA', 'row-level security', 'authenticated', null);
select pg_temp.dene(50, 'Duzeltme kaydi guncellenemez: HATA', $q$update public.wc_odev_duzeltmeleri set puan = 5$q$, 'HATA', 'permission denied', 'authenticated', null);
select pg_temp.dene(51, 'Duzeltme kaydi silinemez: HATA', $q$delete from public.wc_odev_duzeltmeleri$q$, 'HATA', 'permission denied', 'authenticated', null);
select pg_temp.dene(52, 'anon duzeltme ekleyemez: HATA', $q$insert into public.wc_odev_duzeltmeleri (student_id, kaynak_exam_id, tur, puan, tarih, neden) values (current_setting('zz.st_o1')::uuid, current_setting('zz.s8')::uuid, 'elle', 1, (now() at time zone 'Europe/Istanbul')::date, 'x')$q$, 'HATA', 'permission denied', 'anon', null);
select pg_temp.say(53, 'Ogretmen yetkisiz subenin duzeltmesini GORMEZ (0 satir)', $q$select count(*) from public.wc_odev_duzeltmeleri where student_id = current_setting('zz.st_oy')::uuid$q$, 0, 'authenticated', current_setting('zz.o_uid'));

-- ---------------------------------------------------------------------------------------------
-- Rapor: butun satirlar tek metne birlestirilir ve HATA MESAJI olarak verilir (islem boylece geri alinir).
-- ---------------------------------------------------------------------------------------------
do $r$
declare
  v_gecti integer;
  v_toplam integer;
  v_satirlar text;
begin
  select count(*) filter (where sonuc = 'GECTI'), count(*) into v_gecti, v_toplam from rapor;
  select string_agg(lpad(sira::text, 2, '0') || ') ' || test || '  =>  ' || sonuc, chr(10) order by sira)
    into v_satirlar from rapor;
  raise exception '%', 'BU BIR HATA DEGIL, RAPORDUR: ' || v_gecti || ' / ' || v_toplam || ' GECTI'
    || chr(10) || chr(10) || v_satirlar
    || chr(10) || chr(10) || 'OZET: ' || v_gecti || ' / ' || v_toplam || ' GECTI'
    || chr(10) || '(Islem geri alindi; kalici hicbir sey yazilmadi.)';
end
$r$;

rollback;
