-- D3) KANIT (yalnizca okur): SUBE DEGISINCE PUAN KAYDINDAKI ESKI SUBE DEGISMEZ.
-- Test: arayuzde 99003'un subesini toplu islemle degistirdikten sonra bu sorguyu calistir.
-- Beklenen: ogrenci_sube = yeni sube (orn. V), puan_kaydindaki_eski_sube = T (puan girildigi andaki sube),
--           ogrenci_kademe = 8, puan_kaydindaki_kademe = 8.
-- Eski sube bilgisi puan girilirken kaydedilir ve sonradan degismez; siralama ve raporlarda gecmis dogru kalir.

select s.student_no,
       s.full_name,
       s.class_name as ogrenci_sube,
       sc.class_name_at_entry as puan_kaydindaki_eski_sube,
       s.grade as ogrenci_kademe,
       sc.grade_at_entry as puan_kaydindaki_kademe,
       e.unit_no as unite,
       sc.status,
       sc.correct_count as dogru
from public.students s
join public.wc_exam_scores sc on sc.student_id = s.id
join public.wc_exams e on e.id = sc.exam_id
where s.student_no = '99003'
order by e.grade, e.unit_no;
