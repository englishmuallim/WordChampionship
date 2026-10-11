-- P2) ON KONTROL (yalnizca okur): "aktif ogrencide left_at ve left_reason bos olmali" kurali mevcut kayitlara uyuyor mu?
-- Kurali ekleyebilmek icin  aktif_ama_ayrilma_bilgisi_dolu  sutununun 0 olmasi gerekir.
-- 0 degilse 02_guvence_kurali.sql CALISTIRILMAZ; sonucu bana goster.

select count(*) as toplam,
       count(*) filter (where is_active is true) as aktif,
       count(*) filter (where is_active is true and (left_at is not null or left_reason is not null))
         as aktif_ama_ayrilma_bilgisi_dolu,
       count(*) filter (where is_active is not true) as pasif,
       count(*) filter (where is_active is not true and left_at is null) as pasif_tarihsiz,
       count(*) filter (where is_active is not true and left_reason is null) as pasif_nedensiz,
       count(*) filter (where is_active is null) as is_active_bos
from public.students;
