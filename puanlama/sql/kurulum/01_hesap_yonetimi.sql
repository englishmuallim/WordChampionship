begin;

-- 1) Personelin kademe/sube yetkilerini TEK ISLEMDE degistirir (once hepsini siler, sonra yenilerini ekler).
--    Yalnizca Edge Function (service_role) cagirabilir. Hata olursa hicbir sey degismez.
--    Girdi ornegi: [{"grade": 7, "class_name": "A"}, {"grade": 8, "class_name": null}]
--    class_name bos (null) ise o kademenin tum subeleri demektir.
create function public.wc_set_scopes(p_staff_id uuid, p_scopes jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_adet integer;
begin
  if not exists (select 1 from public.wc_staff where id = p_staff_id) then
    raise exception 'Personel bulunamadi.';
  end if;

  if p_scopes is null or jsonb_typeof(p_scopes) <> 'array' then
    raise exception 'Yetkiler bir dizi olmali.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_scopes) as e
    where jsonb_typeof(e) <> 'object'
       or coalesce(jsonb_typeof(e -> 'grade'), '') <> 'number'
       or (e ->> 'grade') !~ '^[0-9]+$'
       or (
         e -> 'class_name' is not null
         and jsonb_typeof(e -> 'class_name') <> 'null'
         and (jsonb_typeof(e -> 'class_name') <> 'string' or char_length(e ->> 'class_name') <> 1)
       )
  ) then
    raise exception 'Gecersiz yetki satiri.';
  end if;

  delete from public.wc_staff_scopes where staff_id = p_staff_id;

  insert into public.wc_staff_scopes (staff_id, grade, class_name)
  select distinct p_staff_id, (e ->> 'grade')::smallint, nullif(e ->> 'class_name', '')
  from jsonb_array_elements(p_scopes) as e;

  get diagnostics v_adet = row_count;
  return v_adet;
end
$$;

revoke execute on function public.wc_set_scopes(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.wc_set_scopes(uuid, jsonb) to service_role;

-- 2) Personel adlarini (yalnizca id ve ad soyad) verir. Ogretmen de "Son kaydeden" adini gorebilsin diye.
--    Sadece aktif personel cagirabilir ve yalnizca kendi okulunun personelini gorur.
create function public.wc_personel_adlari(p_idler uuid[])
returns table (id uuid, full_name varchar)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name
  from public.wc_staff s
  where public.wc_is_staff()
    and s.school_id = public.wc_my_school_id()
    and s.id = any(p_idler);
$$;

revoke execute on function public.wc_personel_adlari(uuid[]) from public, anon;

grant execute on function public.wc_personel_adlari(uuid[]) to authenticated;

commit;
