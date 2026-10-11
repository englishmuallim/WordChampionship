begin;

-- =====================================================================================
-- 1) KADEME KORUMASI (tetikleyici)
-- AKTIF SEZONDA puan kaydi (girdi / girmedi / kopya) olan ogrencinin kademesi degistirilemez.
-- Tablo duzeyinde calisir: uygulama, ice aktarma VE SQL editorunden yapilan guncellemeler dahil
-- her yolu yakalar. (Yalnizca tetikleyiciyi kapatabilen bir veritabani yoneticisi atlayabilir.)
-- Neden: wc_ranking puanlari ogrenci kimligiyle toplar; kademe degisirse eski kademenin puanlari
-- yeni kademenin siralamasina tasinirdi. Eski sezonlarin puani engel degildir (yil sonu terfisi icin).
-- =====================================================================================
create function public.wc_students_grade_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.grade is distinct from old.grade
     and exists (
       select 1
       from public.wc_exam_scores sc
       join public.wc_exams e on e.id = sc.exam_id
       join public.wc_seasons se on se.id = e.season_id
       where sc.student_id = old.id
         and se.is_active
     )
  then
    raise exception 'Aktif sezonda puan kaydı olan öğrencinin kademesi değiştirilemez (öğrenci no: %).', old.student_no;
  end if;
  return new;
end
$$;

revoke execute on function public.wc_students_grade_guard() from public, anon, authenticated;

create trigger wc_students_grade_guard_trg
  before update of grade on public.students
  for each row
  execute function public.wc_students_grade_guard();

-- =====================================================================================
-- 2) PUAN KAYDI SAYILARI
-- Ogrenci basina: toplam puan kaydi sayisi ve AKTIF SEZONdaki kayit sayisi. Yalnizca puani olan
-- ogrenciler doner. Silme dugmesinin kapali olmasi ve kademe alaninin kilitlenmesi buna dayanir.
-- Erisim kurallari (RLS) gecerlidir: yonetici hepsini gorur.
-- =====================================================================================
create function public.wc_ogrenci_puan_sayilari()
returns table (student_id uuid, toplam integer, aktif_sezon integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select sc.student_id,
         count(*)::integer,
         (count(*) filter (where se.is_active))::integer
  from public.wc_exam_scores sc
  join public.wc_exams e on e.id = sc.exam_id
  join public.wc_seasons se on se.id = e.season_id
  group by sc.student_id;
$$;

revoke execute on function public.wc_ogrenci_puan_sayilari() from public, anon;

grant execute on function public.wc_ogrenci_puan_sayilari() to authenticated;

-- =====================================================================================
-- 3) TOPLU ISLEMLER. Hepsinde ortak kurallar:
--   * yonetici degilse hata (wc_is_admin)
--   * yalnizca kendi okulunun ogrencileri etkilenir (wc_my_school_id); baska okul kimligi gelirse reddedilir
--   * bos liste / gecersiz girdi reddedilir
--   * etkilenen satir sayisi beklenenden farkliysa HATA verilir ve TUMU geri alinir (hepsi ya da hicbiri)
--   * search_path sabit; EXECUTE yalnizca giris yapmis kullanicida (public ve anon'dan alindi)
-- =====================================================================================

-- 3a) Arsivle ("ayrildi"): is_active=false, left_at, left_reason. Puanlar silinmez.
create function public.wc_ogrenci_arsivle(p_ids uuid[], p_left_at date, p_reason text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_okul uuid;
  v_neden text;
  v_adet integer;
begin
  if not public.wc_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.';
  end if;
  v_okul := public.wc_my_school_id();

  select array_agg(distinct x) into v_ids from unnest(p_ids) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Öğrenci listesi boş.';
  end if;
  if p_left_at is null then
    raise exception 'Ayrılma tarihi gerekli.';
  end if;
  if p_left_at > (now() at time zone 'Europe/Istanbul')::date then
    raise exception 'Ayrılma tarihi gelecekte olamaz.';
  end if;
  v_neden := nullif(btrim(coalesce(p_reason, '')), '');
  if v_neden is not null and char_length(v_neden) > 200 then
    raise exception 'Ayrılma nedeni en fazla 200 karakter olabilir.';
  end if;

  update public.students
  set is_active = false, left_at = p_left_at, left_reason = v_neden
  where id = any(v_ids)
    and school_id = v_okul
    and is_active is true;
  get diagnostics v_adet = row_count;

  if v_adet <> cardinality(v_ids) then
    raise exception 'Seçilen % öğrenciden yalnızca % tanesi güncellenebildi (zaten ayrılmış ya da bulunamadı). Hiçbir değişiklik yapılmadı.',
      cardinality(v_ids), v_adet;
  end if;
  return v_adet;
end
$$;

revoke execute on function public.wc_ogrenci_arsivle(uuid[], date, text) from public, anon;

grant execute on function public.wc_ogrenci_arsivle(uuid[], date, text) to authenticated;

-- 3b) Arsivden geri al: is_active=true, left_at ve left_reason temizlenir.
create function public.wc_ogrenci_geri_al(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_okul uuid;
  v_adet integer;
begin
  if not public.wc_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.';
  end if;
  v_okul := public.wc_my_school_id();

  select array_agg(distinct x) into v_ids from unnest(p_ids) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Öğrenci listesi boş.';
  end if;

  update public.students
  set is_active = true, left_at = null, left_reason = null
  where id = any(v_ids)
    and school_id = v_okul
    and is_active is not true;
  get diagnostics v_adet = row_count;

  if v_adet <> cardinality(v_ids) then
    raise exception 'Seçilen % öğrenciden yalnızca % tanesi geri alınabildi (zaten aktif ya da bulunamadı). Hiçbir değişiklik yapılmadı.',
      cardinality(v_ids), v_adet;
  end if;
  return v_adet;
end
$$;

revoke execute on function public.wc_ogrenci_geri_al(uuid[]) from public, anon;

grant execute on function public.wc_ogrenci_geri_al(uuid[]) to authenticated;

-- 3c) Sube degistir (kademe ayni kalir). Puan kayitlarindaki eski sube (class_name_at_entry) DEGISMEZ:
--     bu fonksiyon yalnizca students tablosunu gunceller.
create function public.wc_ogrenci_sube_degistir(p_ids uuid[], p_sube text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_okul uuid;
  v_adet integer;
begin
  if not public.wc_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.';
  end if;
  v_okul := public.wc_my_school_id();

  select array_agg(distinct x) into v_ids from unnest(p_ids) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Öğrenci listesi boş.';
  end if;
  if p_sube is null or char_length(p_sube) <> 1 or p_sube ~ '[0-9[:space:][:punct:]]' then
    raise exception 'Şube tek bir harf olmalı.';
  end if;

  update public.students
  set class_name = p_sube
  where id = any(v_ids)
    and school_id = v_okul;
  get diagnostics v_adet = row_count;

  if v_adet <> cardinality(v_ids) then
    raise exception 'Seçilen % öğrenciden yalnızca % tanesi güncellenebildi (bulunamadı). Hiçbir değişiklik yapılmadı.',
      cardinality(v_ids), v_adet;
  end if;
  return v_adet;
end
$$;

revoke execute on function public.wc_ogrenci_sube_degistir(uuid[], text) from public, anon;

grant execute on function public.wc_ogrenci_sube_degistir(uuid[], text) to authenticated;

-- 3d) Kademe degistir (istege bagli yeni sube ile). Aktif sezonda puani olan bir ogrenci varsa
--     1) numarali tetikleyici hata verir ve TUM islem geri alinir.
create function public.wc_ogrenci_kademe_degistir(p_ids uuid[], p_kademe smallint, p_sube text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_okul uuid;
  v_adet integer;
begin
  if not public.wc_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.';
  end if;
  v_okul := public.wc_my_school_id();

  select array_agg(distinct x) into v_ids from unnest(p_ids) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Öğrenci listesi boş.';
  end if;
  if p_kademe is null or p_kademe < 5 or p_kademe > 8 then
    raise exception 'Kademe 5 ile 8 arasında olmalı.';
  end if;
  if p_sube is not null and (char_length(p_sube) <> 1 or p_sube ~ '[0-9[:space:][:punct:]]') then
    raise exception 'Şube tek bir harf olmalı.';
  end if;

  update public.students
  set grade = p_kademe, class_name = coalesce(p_sube, class_name)
  where id = any(v_ids)
    and school_id = v_okul;
  get diagnostics v_adet = row_count;

  if v_adet <> cardinality(v_ids) then
    raise exception 'Seçilen % öğrenciden yalnızca % tanesi güncellenebildi (bulunamadı). Hiçbir değişiklik yapılmadı.',
      cardinality(v_ids), v_adet;
  end if;
  return v_adet;
end
$$;

revoke execute on function public.wc_ogrenci_kademe_degistir(uuid[], smallint, text) from public, anon;

grant execute on function public.wc_ogrenci_kademe_degistir(uuid[], smallint, text) to authenticated;

commit;
