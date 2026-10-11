-- OGRETMEN EKLE (wc_staff kaydi). Once panelde hesabi ac: Authentication > Users > Add user,
-- e-posta: kullaniciadi@giris.wordchampionship.invalid , Auto Confirm User isaretli.
--
-- Doldurulacak yerler (3 tane, << >> isaretli):
--   <<UID>>           : Authentication > Users > hesabin satirina tikla > "User UID" (uzun kod)
--   <<AD SOYAD>>      : ornek  AYSE YILMAZ
--   <<kullanici_adi>> : hesabin e-postasinda @ isaretinden onceki kisim (kucuk harf, Turkce harf yok)
-- Yer tutuculari doldurmadan calistirirsan "invalid input syntax for type uuid" hatasi alirsin (zararsiz).
-- Okul, okul kodundan (767124) kendiliginden bulunur.

insert into public.wc_staff (id, school_id, full_name, username, role, is_active)
select '<<UID>>'::uuid, s.id, '<<AD SOYAD>>', '<<kullanici_adi>>', 'teacher', true
from public.schools s
where s.school_code = '767124'
returning id, full_name, username, role, is_active;
