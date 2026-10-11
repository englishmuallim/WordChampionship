-- P1) ON KONTROL (yalnizca okur): AKTIF OLMAYAN ogrencilerin ayrilma tarihi / nedeni gercekte nasil?
-- Her satir bir grup: kademe, sube, left_at, left_reason ve kac ogrenci oldugu.
-- left_at / left_reason bos (NULL) ise o sutunda "bos" gorunur. Bu sonuca gore ne yapilacagina birlikte karar verecegiz.

select grade as kademe,
       class_name as sube,
       is_active,
       left_at,
       left_reason,
       count(*) as adet
from public.students
where is_active is not true
group by grade, class_name, is_active, left_at, left_reason
order by grade, class_name, left_at, left_reason;
