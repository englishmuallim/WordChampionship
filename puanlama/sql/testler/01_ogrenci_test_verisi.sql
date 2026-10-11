-- =====================================================================================
-- OGRENCI YONETIMI TESTLERI ICIN TEST VERISI HAZIRLAMA
-- Olusturulacaklar (yalnizca bunlar):
--   5 test ogrencisi: numara 99001-99005, adi TEST ile baslar, 8. kademe, sube T
--   Aktif sezonda 8. kademe 99. unite GECICI test sinavi (25 soru, soru basi 4 puan)
--   99003 numarali ogrenci icin bu sinavda 1 puan kaydi (20 dogru = 80 puan)
-- Bu veri wc_ogrenci_test_temizlik.sql ile BIREBIR uyumludur (ayni numaralar, ayni 8-99 sinavi, TEST adlari);
-- testler bitince o dosya hepsini siler. Gercek ogrencilere, sinavlara ve puanlara dokunulmaz.
-- NOT: 99003 bu sinavda 80 puan alacagi icin 8. kademe siralamasinda gecici olarak 1. gorunur
--      (8. kademede henuz gercek sinav yok). Testleri ogretmenler puan girmiyorken yapin.
--
-- Tek islem (begin/commit). Basta ON KONTROL var: bu numaralarda / bu sinavda zaten bir kayit varsa,
-- aktif sezon ya da okul bulunamazsa hata verip durur ve HICBIR SEY EKLENMEZ.
-- Hata mesaji "invalid input syntax for type integer: DURDU: ..." seklinde gelir; nedeni icinde yazar.
-- Hata sonrasi editor "current transaction is aborted" derse once  rollback;  calistir.
-- Sonunda ne olusturuldugunu gosteren tek satirlik bir ozet verir.
-- =====================================================================================

begin;

-- ON KONTROL (yalnizca okur; sartlardan biri saglanmazsa durur, bundan sonraki hicbir komut calismaz)
select case
         when okul <> 1 then ('DURDU: 767124 kodlu okul bulunamadi (' || okul || ' kayit)')::int
         when aktif_sezon <> 1 then ('DURDU: aktif sezon sayisi 1 degil (' || aktif_sezon || ')')::int
         when ogrenci > 0 then ('DURDU: 99001-99005 numaralarinda ' || ogrenci || ' kayit zaten var')::int
         when sinav > 0 then ('DURDU: 8. kademe 99. unite sinavi zaten var (' || sinav || ' kayit)')::int
         else 0
       end as on_kontrol
from (
  select (select count(*) from public.schools where school_code = '767124') as okul,
         (select count(*)
            from public.wc_seasons se
            join public.schools o on o.id = se.school_id
           where o.school_code = '767124' and se.is_active) as aktif_sezon,
         (select count(*) from public.students
           where student_no in ('99001', '99002', '99003', '99004', '99005')) as ogrenci,
         (select count(*) from public.wc_exams where grade = 8 and unit_no = 99) as sinav
) k;

-- 1) Bes test ogrencisi (8. kademe, sube T)
insert into public.students (school_id, student_no, full_name, class_name, grade)
select o.id, v.numara, v.ad, 'T', 8
from public.schools o
cross join (values
  ('99001', 'TEST OGRENCI 1'),
  ('99002', 'TEST OGRENCI 2'),
  ('99003', 'TEST OGRENCI 3 PUANLI'),
  ('99004', 'TEST OGRENCI 4'),
  ('99005', 'TEST OGRENCI 5')
) as v(numara, ad)
where o.school_code = '767124';

-- 2) Aktif sezonda 8. kademe 99. unite gecici sinavi
insert into public.wc_exams (season_id, grade, unit_no, question_count, points_per_question)
select se.id, 8, 99, 25, 4
from public.wc_seasons se
join public.schools o on o.id = se.school_id
where o.school_code = '767124' and se.is_active;

-- 3) 99003 icin bir puan kaydi (20 dogru). Sube/kademe kaydini ve updated_at'i veritabani kendisi doldurur.
insert into public.wc_exam_scores (exam_id, student_id, status, correct_count)
select e.id, s.id, 'girdi', 20
from public.wc_exams e
cross join public.students s
where e.grade = 8 and e.unit_no = 99
  and s.student_no = '99003';

commit;

-- Ozet (beklenen: test_ogrenci 5, test_sinav 1, test_puan 1, puanli_ogrenci 99003, toplam_ogrenci_simdi = onceki toplam + 5)
select (select count(*) from public.students
         where student_no in ('99001', '99002', '99003', '99004', '99005')) as test_ogrenci,
       (select count(*) from public.wc_exams where grade = 8 and unit_no = 99) as test_sinav,
       (select count(*)
          from public.wc_exam_scores sc
          join public.wc_exams e on e.id = sc.exam_id
         where e.grade = 8 and e.unit_no = 99) as test_puan,
       (select string_agg(s.student_no, ', ')
          from public.wc_exam_scores sc
          join public.wc_exams e on e.id = sc.exam_id
          join public.students s on s.id = sc.student_id
         where e.grade = 8 and e.unit_no = 99) as puanli_ogrenci,
       (select count(*) from public.students) as toplam_ogrenci_simdi;
