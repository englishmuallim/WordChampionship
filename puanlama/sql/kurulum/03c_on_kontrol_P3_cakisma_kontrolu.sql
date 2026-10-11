-- P3) ON KONTROL (yalnizca okur): kuracagimiz isimlerde zaten bir sey var mi?
-- Beklenen: HIC SATIR DONMEMELI. Satir donerse 01_ogrenci_yonetimi.sql CALISTIRILMAZ; sonucu bana goster.
-- (tetikleyici satirlari: students tablosunda daha once kurulmus tetikleyici varsa onlar da listelenir)

select 'fonksiyon' as tur, p.proname::text as ad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('wc_students_grade_guard', 'wc_ogrenci_puan_sayilari', 'wc_ogrenci_arsivle',
                    'wc_ogrenci_geri_al', 'wc_ogrenci_sube_degistir', 'wc_ogrenci_kademe_degistir')
union all
select 'tetikleyici', t.tgname::text
from pg_trigger t
where t.tgrelid = 'public.students'::regclass
  and not t.tgisinternal
union all
select 'kisit', c.conname::text
from pg_constraint c
where c.conrelid = 'public.students'::regclass
  and c.conname = 'students_aktif_ayrilma_chk';
