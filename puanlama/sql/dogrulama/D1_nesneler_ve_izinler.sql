-- D1) DOGRULAMA (yalnizca okur): 01_ogrenci_yonetimi.sql calistiktan sonra.
-- Beklenen (6 satir):
--   anon: hepsinde false
--   giris_yapmis: wc_students_grade_guard icin false, diger bes fonksiyon icin true
--   security_definer: yalnizca wc_students_grade_guard icin true
--   ayarlar: hepsinde {search_path=""} (sabitlenmis)
--   tetikleyici_sayisi: 1 (students uzerinde wc_students_grade_guard_trg)

select p.proname as fonksiyon,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as giris_yapmis,
       p.prosecdef as security_definer,
       p.proconfig::text as ayarlar,
       (select count(*)
          from pg_trigger t
         where t.tgrelid = 'public.students'::regclass
           and t.tgname = 'wc_students_grade_guard_trg') as tetikleyici_sayisi
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('wc_students_grade_guard', 'wc_ogrenci_puan_sayilari', 'wc_ogrenci_arsivle',
                    'wc_ogrenci_geri_al', 'wc_ogrenci_sube_degistir', 'wc_ogrenci_kademe_degistir')
order by p.proname;
