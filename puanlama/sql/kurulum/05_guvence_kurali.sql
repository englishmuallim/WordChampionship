-- 02) GUVENCE KURALI. YALNIZCA P2 sonucunda  aktif_ama_ayrilma_bilgisi_dolu = 0  ise calistir.
-- Kural: aktif bir ogrencinin ayrilma tarihi (left_at) ve ayrilma nedeni (left_reason) bos olmalidir.
-- Boylece geri alma (aktiflestirme) tarih ve nedeni temizlemeyi unutsa bile veritabani buna izin vermez.
-- Mevcut kayitlardan biri kurala uymuyorsa komut hata verir ve HICBIR SEY DEGISMEZ.
-- Geri alma:  alter table public.students drop constraint students_aktif_ayrilma_chk;

alter table public.students
  add constraint students_aktif_ayrilma_chk
  check (is_active is not true or (left_at is null and left_reason is null));
