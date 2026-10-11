-- KANIT TESTI: pasif bir ogretmen hicbir veriyi gorebilir mi? (SONUNDA GERI ALINIR, kalici bir sey degismez)
-- Doldurulacak yer: <<UID>> , dosyada IKI yerde gecer (update satiri ve set_config satiri). Ikisine de ayni kodu yaz:
--   ogretmenin User UID degeri.
--
-- Beklenen sonuc (hesap pasifken): ogrenci 0, puan 0, sezon 0, sinav 0, siralama 0, kendi_satirim 1
--   (kendi_satirim 1: pasif hesap yalnizca kendi profil satirini okuyabilir; uygulama bunu "hesap pasif" demek icin kullanir)
-- Karsilastirma icin: asagidaki "update" satirinin basina -- koyup (yorum yapip) bir kez daha calistirirsan
--   hesap AKTIFKEN gorebildigi sayilari gorursun (ogrenci, puan, sezon vb. sifirdan buyuk olmali).

begin;
update public.wc_staff set is_active = false where id = '<<UID>>'::uuid;
select set_config('request.jwt.claims', '{"sub":"<<UID>>","role":"authenticated"}', true);
set local role authenticated;
select (select count(*) from public.students) as ogrenci,
       (select count(*) from public.wc_exam_scores) as puan,
       (select count(*) from public.wc_seasons) as sezon,
       (select count(*) from public.wc_exams) as sinav,
       (select count(*) from public.wc_ranking((select id from public.wc_seasons where is_active), 7::smallint)) as siralama,
       (select count(*) from public.wc_staff) as kendi_satirim;
rollback;
