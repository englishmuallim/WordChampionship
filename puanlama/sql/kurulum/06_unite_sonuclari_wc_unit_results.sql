-- ============================================================================
-- Unite Sonuclari sayfasi icin salt okunur fonksiyon: wc_unit_results
-- ============================================================================
-- NE YAPAR
--   Secilen sezon + kademe + unite icin, AKTIF ogrencilerin, secilen uniteye
--   kadarki (unit_no <= secilen) "girdi" ve "kopya" kayitlarini dondurur.
--   "girmedi" kayitlari ve hic kaydi olmayan ogrenciler donmez.
--   Siralama ve toplam hesabi sayfada (JavaScript) yapilir; burada sadece ham veri var.
--
-- GUVENLIK
--   * wc_is_staff(): yalnizca aktif personel (yonetici ya da ogretmen) sonuc alir.
--   * Okul kontrolu: sezon kullanicinin okuluna ait olmali, ogrenci ayni okulda olmali.
--   * SECURITY DEFINER: ogretmen, yetkili olmadigi subelerin ham tablosunu okuyamaz
--     ama bu fonksiyon tum kademeyi verir (wc_ranking ile ayni yaklasim).
--   * search_path sabit (bos), tum nesneler public. ile yazildi.
--   * anon ve public'ten EXECUTE alindi; yalnizca authenticated calistirabilir.
--   * Veritabanina YAZMAZ (stable, sadece select).
--
-- ONCE BU DOSYAYI VS CODE'DA OKUYUN, SONRA SUPABASE SQL EDITORUNDE CALISTIRIN.
-- ============================================================================

begin;

create or replace function public.wc_unit_results(
  p_season_id uuid,
  p_grade smallint,
  p_unit_no integer
) returns table (
  student_id uuid,
  student_no varchar,
  full_name varchar,
  class_name varchar,
  unit_no integer,
  status text,
  correct_count integer,
  question_count integer,
  points_per_question integer
)
language sql stable security definer set search_path = '' as $$
  select s.id,
         s.student_no,
         s.full_name,
         s.class_name,
         e.unit_no::integer,
         sc.status::text,
         sc.correct_count::integer,
         e.question_count::integer,
         e.points_per_question::integer
  from public.students s
  join public.wc_exam_scores sc on sc.student_id = s.id
  join public.wc_exams e on e.id = sc.exam_id
  where public.wc_is_staff()
    and public.wc_season_in_my_school(p_season_id)
    and s.school_id = public.wc_my_school_id()
    and s.grade = p_grade
    and s.is_active
    and e.season_id = p_season_id
    and e.grade = p_grade
    and e.unit_no <= p_unit_no
    and sc.status in ('girdi', 'kopya')
  order by s.id, e.unit_no;
$$;

revoke execute on function public.wc_unit_results(uuid, smallint, integer) from public, anon;
grant execute on function public.wc_unit_results(uuid, smallint, integer) to authenticated;

commit;

-- ============================================================================
-- GERI ALMA (gerekirse; fonksiyonu tamamen kaldirir, baska hicbir seye dokunmaz)
-- ============================================================================
-- drop function public.wc_unit_results(uuid, smallint, integer);

-- ============================================================================
-- DOGRULAMA SORGULARI (SQL editoru service rolu ile calistigi icin wc_is_staff() orada
-- false doner; bu yuzden fonksiyonu editorden cagirinca bos donmesi NORMALDIR.
-- Gercek dogrulama sayfadan, yonetici ve ogretmen hesabiyla yapilir.)
-- ============================================================================
-- 1) Fonksiyon var mi, yetkiler dogru mu? (anon ve public'te execute OLMAMALI)
-- select r.rolname,
--        has_function_privilege(r.rolname, 'public.wc_unit_results(uuid, smallint, integer)', 'execute') as can_execute
-- from pg_roles r
-- where r.rolname in ('anon', 'authenticated', 'service_role')
-- order by r.rolname;
--   Beklenen: anon = false, authenticated = true.
--
-- 2) Fonksiyonun guvenlik ayarlari (security definer = true, search_path sabit olmali)
-- select p.proname, p.prosecdef as security_definer, p.provolatile as volatilite, p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'wc_unit_results';
--   Beklenen: security_definer = true, volatilite = 's' (stable), proconfig = {search_path=""}.
--
-- 3) Ham veriyle karsilastirma icin (okul/sezon id'lerini kendinize gore doldurun; ilk sinav, 6. kademe):
-- select count(*) filter (where sc.status = 'girdi') as girdi, count(*) filter (where sc.status = 'kopya') as kopya
-- from public.wc_exam_scores sc
-- join public.wc_exams e on e.id = sc.exam_id
-- join public.students s on s.id = sc.student_id
-- where e.grade = 6 and e.unit_no = 1 and s.is_active;
--   Sayfada 6. kademe 1. unite listesindeki ogrenci sayisi = girdi + kopya olmali.
