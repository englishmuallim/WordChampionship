-- D4) KONTROL (yalnizca okur): test ogrencilerinin aktiflik, ayrilma tarihi ve nedeni.
-- Arsivleme / geri alma testlerinden sonra calistir. Aktif ogrencide left_at ve left_reason BOS olmali
-- (02_guvence_kurali.sql bunu veritabaninda da zorunlu kilar); ayrilmis ogrencide tarih ve (verildiyse) neden dolu olmali.

select student_no,
       full_name,
       grade as kademe,
       class_name as sube,
       is_active,
       left_at,
       left_reason
from public.students
where student_no in ('99001', '99002', '99003', '99004', '99005')
order by student_no;
