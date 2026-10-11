-- D2) DAVRANIS RAPORU. 01_ogrenci_yonetimi.sql calistiktan sonra tek seferde calistir.
-- Gecici test verisi (okul, ogrenciler, sinavlar, puan) olusturur, senaryolari dener, sonucu tablo olarak verir
-- ve SONUNDA HER SEYI GERI ALIR (rollback): gercek verinize hicbir sey yazilmaz, ogrenci/okul/sezon eklenmez.
-- COMMIT YOK. SONDA HATA BEKLENIYOR: rapor, editorde bir HATA MESAJI olarak gorunur ("BU BIR HATA DEGIL, RAPORDUR").
-- Hata verince islem otomatik geri alinir; kalici hicbir sey yazilmaz.
-- Beklenen: mesajin basinda "RAPORDUR: N / N GECTI" (N ayni sayi, ornegin 33 / 33) ve her satirda  GECTI .
-- KALDI gorursen o satirin yanindaki mesaji bana aynen yaz.
-- RAPORDAN ONCE baska bir hata gorursen (ornegin yonetici kaydi bulunamadi), o hatayi bana aynen yaz.
-- Test verisi isimleri ZZ- ile baslar; gercek kayitlarla karismaz. Editor "current transaction is aborted"
-- derse once  rollback;  calistir.

begin;

create temp table rapor (sira integer, test text, beklenen text, sonuc text);

-- Yonetici kimligi: wc_staff'ta role = 'admin' ve username = '<<YONETICI_KULLANICI_ADI>>' olan AKTIF tek kayit.
-- Bulunamazsa (ya da birden fazlaysa) acik bir hata verip durur. Kimlik bu islem boyunca
-- 'zz.yonetici' ayarinda tutulur ve asagidaki senaryolarda varsayilan kimlik olarak kullanilir.
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

-- Yardimci 1: bir komutu belirli bir rol ve kimlikle dener (kimlik verilmezse yukaridaki yonetici). beklenen: IZIN (hata vermemeli) ya da HATA (vermeli).
-- p_parca: HATA beklenirken hata mesajinda gecmesi gereken ifade.
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

-- Yardimci 2: bir kosulun dogru olup olmadigini kontrol eder.
create function pg_temp.kontrol(p_sira integer, p_test text, p_kosul text) returns void
language plpgsql
as $f$
declare
  v_ok boolean;
begin
  execute 'select coalesce((' || p_kosul || '), false)' into v_ok;
  insert into rapor values (p_sira, p_test, 'DOGRU', case when v_ok then 'GECTI' else 'KALDI' end);
end
$f$;

-- ---------------------------------------------------------------------------------------------
-- Gecici test verisi
-- ---------------------------------------------------------------------------------------------
insert into public.schools (school_code, school_name) values ('ZZ-OKUL', 'ZZ TEST OKULU');

insert into public.students (school_id, student_no, full_name, class_name, grade)
select o.id, v.numara, v.ad, 'T', v.kademe
from public.schools o
cross join (values
  ('ZZ-T1', 'ZZ TEST BIR', 8),
  ('ZZ-T2', 'ZZ TEST IKI', 8),
  ('ZZ-T3', 'ZZ TEST UC PUANLI', 8),
  ('ZZ-T4', 'ZZ TEST DORT ESKI SEZON', 8)
) as v(numara, ad, kademe)
where o.school_code = '767124';

insert into public.students (school_id, student_no, full_name, class_name, grade)
select o.id, 'ZZ-X1', 'ZZ BASKA OKUL', 'T', 8
from public.schools o
where o.school_code = 'ZZ-OKUL';

-- aktif sezonda 8. kademe 97. unite test sinavi
insert into public.wc_exams (season_id, grade, unit_no, question_count, points_per_question)
select se.id, 8, 97, 25, 4
from public.wc_seasons se
join public.schools o on o.id = se.school_id
where o.school_code = '767124' and se.is_active;

-- pasif (eski) sezon ve o sezonda bir sinav
insert into public.wc_seasons (school_id, name, is_active)
select o.id, 'ZZ ESKI SEZON', false from public.schools o where o.school_code = '767124';

insert into public.wc_exams (season_id, grade, unit_no, question_count, points_per_question)
select se.id, 8, 1, 25, 4 from public.wc_seasons se where se.name = 'ZZ ESKI SEZON';

-- T3: aktif sezonda puani var. T4: yalnizca eski sezonda puani var.
insert into public.wc_exam_scores (exam_id, student_id, status, correct_count)
select e.id, s.id, 'girdi', 10
from public.wc_exams e
cross join public.students s
where e.unit_no = 97 and e.grade = 8 and s.student_no = 'ZZ-T3';

insert into public.wc_exam_scores (exam_id, student_id, status, correct_count)
select e.id, s.id, 'girdi', 10
from public.wc_exams e
join public.wc_seasons se on se.id = e.season_id
cross join public.students s
where se.name = 'ZZ ESKI SEZON' and s.student_no = 'ZZ-T4';

-- gercek okulun kimligini, rol degistirince okunabilsin diye bir ayar olarak sakla
select set_config('zz.okul', (select id::text from public.schools where school_code = '767124'), true);

-- ---------------------------------------------------------------------------------------------
-- Senaryolar (yonetici = yukarida wc_staff'tan bulunan kimlik; "authenticated" rolu = gercek giris yapmis kullanici gibi, RLS dahil)
-- ---------------------------------------------------------------------------------------------
select pg_temp.dene(1, 'Yonetici iki ogrenciyi arsivler (T1, T2)',
  $q$select public.wc_ogrenci_arsivle(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T2')), (now() at time zone 'Europe/Istanbul')::date, 'Nakil')$q$,
  'IZIN', null, 'authenticated');
select pg_temp.kontrol(2, 'Arsivlenenler pasif, tarih ve neden yazili',
  $q$(select count(*) from public.students where student_no in ('ZZ-T1','ZZ-T2') and is_active = false and left_at is not null and left_reason = 'Nakil') = 2$q$);
select pg_temp.dene(3, 'Zaten arsivli ogrenciyi tekrar arsivlemek: HATA',
  $q$select public.wc_ogrenci_arsivle(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T2')), (now() at time zone 'Europe/Istanbul')::date, 'Nakil')$q$,
  'HATA', 'Hiçbir değişiklik yapılmadı', 'authenticated');
select pg_temp.dene(4, 'Geri al (T1, T2)',
  $q$select public.wc_ogrenci_geri_al(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T2')))$q$,
  'IZIN', null, 'authenticated');
select pg_temp.kontrol(5, 'Geri alinanlar aktif, tarih ve neden temizlendi',
  $q$(select count(*) from public.students where student_no in ('ZZ-T1','ZZ-T2') and is_active = true and left_at is null and left_reason is null) = 2$q$);
select pg_temp.dene(6, 'Aktif ogrenciye geri al uygulanamaz (T1): HATA',
  $q$select public.wc_ogrenci_geri_al(array(select id from public.students where student_no = 'ZZ-T1'))$q$,
  'HATA', 'Hiçbir değişiklik yapılmadı', 'authenticated');
select pg_temp.dene(7, 'Sube degistir (T1, T2, T3 -> U)',
  $q$select public.wc_ogrenci_sube_degistir(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T2','ZZ-T3')), 'U')$q$,
  'IZIN', null, 'authenticated');
select pg_temp.kontrol(8, 'Uc ogrencinin subesi U oldu',
  $q$(select count(*) from public.students where student_no in ('ZZ-T1','ZZ-T2','ZZ-T3') and class_name = 'U') = 3$q$);
select pg_temp.kontrol(9, 'SUBE DEGISINCE PUAN KAYDINDAKI ESKI SUBE DEGISMEDI (T3: ogrenci=U, puan kaydi=T)',
  $q$(select s.class_name = 'U' and sc.class_name_at_entry = 'T' from public.students s join public.wc_exam_scores sc on sc.student_id = s.id where s.student_no = 'ZZ-T3')$q$);
select pg_temp.dene(10, 'Puansiz iki ogrencinin kademesi 8 -> 7 (sube korunur)',
  $q$select public.wc_ogrenci_kademe_degistir(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T2')), 7::smallint, null)$q$,
  'IZIN', null, 'authenticated');
select pg_temp.kontrol(11, 'T1 ve T2 kademe 7, sube U korundu',
  $q$(select count(*) from public.students where student_no in ('ZZ-T1','ZZ-T2') and grade = 7 and class_name = 'U') = 2$q$);
select pg_temp.dene(12, 'Aktif sezonda puani olan ogrencinin (T3) kademesi degistirilemez: HATA',
  $q$select public.wc_ogrenci_kademe_degistir(array(select id from public.students where student_no = 'ZZ-T3'), 7::smallint, null)$q$,
  'HATA', 'kademesi değiştirilemez', 'authenticated');
select pg_temp.dene(13, 'Secimde tek puanli varsa tum islem iptal (T1 + T3 -> kademe 6): HATA',
  $q$select public.wc_ogrenci_kademe_degistir(array(select id from public.students where student_no in ('ZZ-T1','ZZ-T3')), 6::smallint, null)$q$,
  'HATA', 'kademesi değiştirilemez', 'authenticated');
select pg_temp.kontrol(14, 'HEPSI YA DA HICBIRI: T1 hala kademe 7',
  $q$(select grade = 7 from public.students where student_no = 'ZZ-T1')$q$);
select pg_temp.dene(15, 'SQL editorunden dogrudan guncelleme de engellenir (puanli T3)',
  $q$update public.students set grade = 6 where student_no = 'ZZ-T3'$q$,
  'HATA', 'kademesi değiştirilemez', null);
select pg_temp.dene(16, 'Kademe ayni degerle guncellenirse engellenmez (T3, grade = 8)',
  $q$update public.students set grade = 8 where student_no = 'ZZ-T3'$q$,
  'IZIN', null, null);
select pg_temp.dene(17, 'Yalnizca ESKI sezonda puani olan ogrencinin (T4) kademesi degisebilir',
  $q$update public.students set grade = 7 where student_no = 'ZZ-T4'$q$,
  'IZIN', null, null);
select pg_temp.kontrol(18, 'Puan sayilari: T3 toplam 1 / aktif sezon 1; T4 toplam 1 / aktif sezon 0',
  $q$(select count(*) from public.wc_ogrenci_puan_sayilari() p join public.students s on s.id = p.student_id where (s.student_no = 'ZZ-T3' and p.toplam = 1 and p.aktif_sezon = 1) or (s.student_no = 'ZZ-T4' and p.toplam = 1 and p.aktif_sezon = 0)) = 2$q$);

-- yetki ve girdi kontrolleri
select pg_temp.dene(19, 'Yonetici olmayan (rastgele kimlik) arsivleyemez: HATA',
  $q$select public.wc_ogrenci_arsivle(array(select id from public.students where student_no = 'ZZ-T2'), (now() at time zone 'Europe/Istanbul')::date, null)$q$,
  'HATA', 'yönetici yetkisi', 'authenticated', '00000000-0000-0000-0000-0000000000aa');
select pg_temp.dene(20, 'Anonim cagiramaz: HATA',
  $q$select public.wc_ogrenci_arsivle(array[gen_random_uuid()], (now() at time zone 'Europe/Istanbul')::date, null)$q$,
  'HATA', 'permission denied', 'anon');
-- (21: rol belirtilmedi; erisim kurallari ogrenciyi gizlemesin diye fonksiyonun KENDI okul filtresi sinanir)
select pg_temp.dene(21, 'Baska okulun ogrencisi reddedilir (ZZ-X1): HATA',
  $q$select public.wc_ogrenci_arsivle(array(select id from public.students where student_no = 'ZZ-X1'), (now() at time zone 'Europe/Istanbul')::date, null)$q$,
  'HATA', 'Hiçbir değişiklik yapılmadı', null);
select pg_temp.kontrol(22, 'Baska okulun ogrencisi hala aktif',
  $q$(select is_active from public.students where student_no = 'ZZ-X1')$q$);
select pg_temp.dene(23, 'Gelecek tarihli ayrilma reddedilir: HATA',
  $q$select public.wc_ogrenci_arsivle(array(select id from public.students where student_no = 'ZZ-T2'), (now() at time zone 'Europe/Istanbul')::date + 1, null)$q$,
  'HATA', 'gelecekte olamaz', 'authenticated');
select pg_temp.dene(24, 'Bos liste reddedilir: HATA',
  $q$select public.wc_ogrenci_arsivle('{}'::uuid[], (now() at time zone 'Europe/Istanbul')::date, null)$q$,
  'HATA', 'boş', 'authenticated');
select pg_temp.dene(25, 'Kademe 9 reddedilir: HATA',
  $q$select public.wc_ogrenci_kademe_degistir(array(select id from public.students where student_no = 'ZZ-T2'), 9::smallint, null)$q$,
  'HATA', '5 ile 8', 'authenticated');
select pg_temp.dene(26, 'Iki harfli sube reddedilir: HATA',
  $q$select public.wc_ogrenci_sube_degistir(array(select id from public.students where student_no = 'ZZ-T2'), 'AB')$q$,
  'HATA', 'tek bir harf', 'authenticated');
select pg_temp.dene(27, 'Olmayan kimlik reddedilir: HATA',
  $q$select public.wc_ogrenci_geri_al(array['00000000-0000-0000-0000-000000000001'::uuid])$q$,
  'HATA', 'Hiçbir değişiklik yapılmadı', 'authenticated');

-- tek ogrenci islemleri ve yonetici disi yazma (RLS)
select pg_temp.dene(28, 'Yonetici ogrenci ekleyebilir (RLS)',
  $q$insert into public.students (school_id, student_no, full_name, class_name, grade) values (current_setting('zz.okul')::uuid, 'ZZ-INS', 'ZZ EKLENEN', 'T', 8)$q$,
  'IZIN', null, 'authenticated');
select pg_temp.dene(29, 'Yonetici puansiz ogrenciyi silebilir (RLS)',
  $q$delete from public.students where student_no = 'ZZ-INS'$q$,
  'IZIN', null, 'authenticated');
select pg_temp.dene(30, 'Puani olan ogrenci silinemez (veritabani engeller): HATA',
  $q$delete from public.students where student_no = 'ZZ-T3'$q$,
  'HATA', 'foreign key', 'authenticated');
select pg_temp.dene(31, 'Yonetici olmayan ogrenci ekleyemez (RLS): HATA',
  $q$insert into public.students (school_id, student_no, full_name, class_name, grade) values (current_setting('zz.okul')::uuid, 'ZZ-INS2', 'ZZ YETKISIZ', 'T', 8)$q$,
  'HATA', 'row-level security', 'authenticated', '00000000-0000-0000-0000-0000000000aa');
select pg_temp.dene(32, 'Yonetici olmayan ogrenci guncelleme denemesi hata vermez ama hicbir satiri degistirmez',
  $q$update public.students set class_name = 'Z' where student_no = 'ZZ-T1'$q$,
  'IZIN', null, 'authenticated', '00000000-0000-0000-0000-0000000000aa');
select pg_temp.kontrol(33, 'T1 subesi degismedi (U)',
  $q$(select class_name = 'U' from public.students where student_no = 'ZZ-T1')$q$);

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
