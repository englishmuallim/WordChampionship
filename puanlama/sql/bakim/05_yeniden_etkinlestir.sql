-- PASIF HESABI YENIDEN ETKINLESTIR. Yetkiler (kademe/sube) oldugu gibi korunur.
-- Doldurulacak yer: <<UID>>

update public.wc_staff
set is_active = true
where id = '<<UID>>'::uuid
returning full_name, username, role, is_active;
