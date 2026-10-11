-- =====================================================================================
-- OGRENCI YONETIMI TESTLERI SONRASI TEMIZLIK
-- BU DOSYA TESTLERE BASLAMADAN ONCE YAZILDI; testler sirasinda olusturdugun kayitlari siler.
-- Test kayitlari (yalnizca bunlar):
--   Ogrenciler: ogrenci numarasi 99001, 99002, 99003, 99004, 99005 olanlar (adlari TEST ile baslamali)
--   Sinav: 8. kademe 99. unite (aktif sezonda) ve yalnizca bu ogrencilerin bu sinavdaki puanlari
-- SILINMEYECEKLER: bunlar disindaki tum ogrenciler, sinavlar, puanlar; personel, okul, sezon, eski final tablolari.
-- Genis silme kosulu YOKTUR: silmeler tek tek bu numaralara ve bu sinava baglidir.
-- Dosya iki bolumden olusur: A (yalnizca okur) ve B (siler). B yorum blogu icinde KAPALI gelir.
-- Silmek icin B'nin basindaki "/*" ve sonundaki "*/" satirlarini sil.
-- =====================================================================================


-- =====================================================================================
-- BOLUM A: KONTROL SORGULARI (yalnizca okur). Her sorguyu AYRI AYRI calistir.
-- =====================================================================================

-- A1) Test ogrencileri (numarasi 99001-99005 olanlar). Hepsinin adi TEST ile baslamali.
select student_no, full_name, grade, class_name, is_active, left_at, left_reason
from public.students
where student_no in ('99001', '99002', '99003', '99004', '99005')
order by student_no;

-- A2) 8. kademe 99. unite sinavi ve puanlari.
select e.grade as kademe, e.unit_no as unite, e.exam_date as tarih,
       s.student_no, s.full_name, sc.status, sc.correct_count
from public.wc_exams e
left join public.wc_exam_scores sc on sc.exam_id = e.id
left join public.students s on s.id = sc.student_id
where e.grade = 8 and e.unit_no = 99
order by s.student_no;

-- A3) Test ogrencilerinin 8. kademe 99. unite DISINDAKI sinavlarda puani var mi? Beklenen: HIC SATIR.
select e.grade as kademe, e.unit_no as unite, s.student_no, s.full_name, sc.status
from public.wc_exam_scores sc
join public.students s on s.id = sc.student_id
join public.wc_exams e on e.id = sc.exam_id
where s.student_no in ('99001', '99002', '99003', '99004', '99005')
  and not (e.grade = 8 and e.unit_no = 99)
order by s.student_no, e.grade, e.unit_no;

-- A4) Numarasi 99001-99005 olup adi TEST ile baslamayan ogrenci var mi (gercek ogrenci olabilir)? Beklenen: HIC SATIR.
select student_no, full_name, grade, class_name
from public.students
where student_no in ('99001', '99002', '99003', '99004', '99005')
  and full_name not like 'TEST%';

-- A5) 8. kademe 99. unite sinavinda test ogrencisi OLMAYAN birinin puani var mi? Beklenen: HIC SATIR.
select s.student_no, s.full_name, sc.status
from public.wc_exam_scores sc
join public.wc_exams e on e.id = sc.exam_id
join public.students s on s.id = sc.student_id
where e.grade = 8 and e.unit_no = 99
  and s.student_no not in ('99001', '99002', '99003', '99004', '99005');


-- =====================================================================================
-- BOLUM B: SILME (GERI ALINAMAZ; test verisi onemsizdir). Acmak icin asagidaki "/*" satirini ve
-- dosyanin sonundaki "*/" satirini sil, sonra B bolumunun TAMAMINI tek seferde calistir.
-- Bastaki guvenlik kontrolu sartlardan biri saglanmazsa "invalid input syntax for type integer: DURDU: ..."
-- hatasi verip islemi durdurur; bu durumda HICBIR SEY SILINMEZ (silmeler kontrolden sonra gelir).
-- Hata sonrasi editor "current transaction is aborted" derse once  rollback;  calistir.
-- =====================================================================================
/*
drop table if exists pg_temp.wc_ogr_temizlik_onceki;

begin;

create temp table wc_ogr_temizlik_onceki as
select (select count(*) from public.students
         where student_no in ('99001', '99002', '99003', '99004', '99005')) as ogrenci,
       (select count(*) from public.wc_exam_scores sc
          join public.students s on s.id = sc.student_id
         where s.student_no in ('99001', '99002', '99003', '99004', '99005')) as puan,
       (select count(*) from public.wc_exams where grade = 8 and unit_no = 99) as sinav;

-- GUVENLIK KONTROLU: asagidakilerden biri varsa hata verip durur, hicbir sey silinmez.
select case
         when isimsiz > 0 then ('DURDU: ' || isimsiz || ' ogrencinin adi TEST ile baslamiyor (gercek ogrenci olabilir)')::int
         when baska_sinav > 0 then ('DURDU: test ogrencilerinin 8-99 disinda ' || baska_sinav || ' puan kaydi var')::int
         when baska_ogrenci > 0 then ('DURDU: 8-99 sinavinda test disi ogrencilere ait ' || baska_ogrenci || ' puan kaydi var')::int
         when istisna > 0 then ('DURDU: test ogrencilerine ait ' || istisna || ' ogrenci istisnasi kaydi var')::int
         else 0
       end as guvenlik_kontrolu
from (
  select (select count(*) from public.students
           where student_no in ('99001', '99002', '99003', '99004', '99005')
             and full_name not like 'TEST%') as isimsiz,
         (select count(*) from public.wc_exam_scores sc
            join public.students s on s.id = sc.student_id
            join public.wc_exams e on e.id = sc.exam_id
           where s.student_no in ('99001', '99002', '99003', '99004', '99005')
             and not (e.grade = 8 and e.unit_no = 99)) as baska_sinav,
         (select count(*) from public.wc_exam_scores sc
            join public.students s on s.id = sc.student_id
            join public.wc_exams e on e.id = sc.exam_id
           where e.grade = 8 and e.unit_no = 99
             and s.student_no not in ('99001', '99002', '99003', '99004', '99005')) as baska_ogrenci,
         (select count(*) from public.wc_student_settings st
            join public.students s on s.id = st.student_id
           where s.student_no in ('99001', '99002', '99003', '99004', '99005')) as istisna
) k;

-- 1) 8. kademe 99. unite sinavindaki test ogrencilerinin puanlari
delete from public.wc_exam_scores
where exam_id in (select id from public.wc_exams where grade = 8 and unit_no = 99)
  and student_id in (select id from public.students
                      where student_no in ('99001', '99002', '99003', '99004', '99005'));

-- 2) 8. kademe 99. unite test sinavi (yalnizca hic puani kalmadiysa silinir)
delete from public.wc_exams e
where e.grade = 8 and e.unit_no = 99
  and not exists (select 1 from public.wc_exam_scores sc where sc.exam_id = e.id);

-- 3) Test ogrencileri (numarasi listede ve adi TEST ile baslayanlar)
delete from public.students
where student_no in ('99001', '99002', '99003', '99004', '99005')
  and full_name like 'TEST%';

commit;

select o.ogrenci - (select count(*) from public.students
                     where student_no in ('99001', '99002', '99003', '99004', '99005')) as silinen_ogrenci,
       o.puan - (select count(*) from public.wc_exam_scores sc
                   join public.students s on s.id = sc.student_id
                  where s.student_no in ('99001', '99002', '99003', '99004', '99005')) as silinen_puan,
       o.sinav - (select count(*) from public.wc_exams where grade = 8 and unit_no = 99) as silinen_sinav,
       (select count(*) from public.students
         where student_no in ('99001', '99002', '99003', '99004', '99005')) as kalan_test_ogrenci,
       (select count(*) from public.wc_exams where grade = 8 and unit_no = 99) as kalan_test_sinav,
       (select count(*) from public.students) as toplam_ogrenci_simdi
from pg_temp.wc_ogr_temizlik_onceki o;
*/
