-- YETKI VER / DEGISTIR. Personelin eski yetkilerinin HEPSI silinir, asagidakiler yazilir (tek islem).
-- Hata olursa eski yetkiler oldugu gibi kalir.
-- Doldurulacak yer: <<UID>> (ogretmenin User UID degeri) ve yetki listesi.
-- Donen sayi, yazilan yetki satiri sayisidir.
--
-- Yetki listesi ornekleri (asagidaki satirdaki '[ ... ]' kismini degistir):
--   Tek sube (7. kademe A):      '[{"grade":7,"class_name":"A"}]'
--   Tum 7. kademe (butun sube):  '[{"grade":7,"class_name":null}]'
--   7-A ve 8-B:                  '[{"grade":7,"class_name":"A"},{"grade":8,"class_name":"B"}]'
--   Tum yetkileri kaldir:        '[]'

select public.wc_set_scopes('<<UID>>'::uuid, '[{"grade":7,"class_name":"A"}]'::jsonb);
