-- KONTROL: tum personel, rolleri, durumlari ve yetkileri (yalnizca okur, hicbir sey degistirmez).

select s.id, s.full_name, s.username, s.role, s.is_active,
       coalesce(
         string_agg(
           sc.grade::text || coalesce('-' || sc.class_name, ' (tum subeler)'),
           ', ' order by sc.grade, sc.class_name
         ),
         'yetki yok'
       ) as yetkiler
from public.wc_staff s
left join public.wc_staff_scopes sc on sc.staff_id = s.id
group by s.id, s.full_name, s.username, s.role, s.is_active
order by s.role, s.full_name;
