-- OGRETMENI PASIFLESTIR. Pasif hesap giris yapamaz; acik oturumu da veri okuyamaz/yazamaz
-- (veritabani kurallari her istekte is_active degerine bakar). Puan kayitlari silinmez.
-- Doldurulacak yer: <<UID>>
-- Guvenlik: yalnizca role = 'teacher' olan hesaplar pasiflestirilir (yonetici hesabi bu komutla kapanmaz).
-- Hicbir satir donmezse UID yanlis ya da hesap ogretmen degildir.

update public.wc_staff
set is_active = false
where id = '<<UID>>'::uuid
  and role = 'teacher'
returning full_name, username, role, is_active;
