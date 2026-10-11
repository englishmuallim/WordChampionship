# Word Championship Puanlama: SQL dosyaları

Bu klasör, puanlama modülünün veritabanında (Supabase) çalıştırılmış SQL dosyalarını **belge olarak** saklar.

## Önce bunları bil

- **SQL'i kullanıcı Supabase SQL Editor'de kendisi çalıştırır.** Dosyaları önce okuyun, sonra çalıştırın.
- Buradaki dosyaların çoğu **canlı veritabanında zaten çalıştırıldı**. Sıra numaraları çalıştırma sırasını gösterir; her dosyayı yeniden çalıştırmak gerekmez ve bazıları tekrar çalıştırılamaz (aşağıdaki tabloya bakın).
- **Bu depo herkese açıktır.** Dosyalara gerçek UID, e-posta, şifre, anahtar (`sb_secret_`, `service_role` anahtarı, `eyJ…`), gerçek öğrenci/öğretmen adı veya numarası yazmayın. Doldurulacak yerler `<<…>>` yer tutucularıyla gösterilir; bunları yalnızca SQL Editor'e yapıştırırken doldurun, dosyayı doldurulmuş hâliyle kaydetmeyin.
- Sohbetten kopyalayınca satır sonları bozulabilir. Dosyayı kod düzenleyicisinde açıp içeriğinin tamamını seçerek SQL Editor'e yapıştırın.

## Klasör haritası

```
sql/
├── kurulum/    Veritabanına kalıcı nesneler ekler (sırayla). 03a-03c yalnızca okur.
├── dogrulama/  Kurulumdan sonra çalışan kontroller (okur ya da sonunda geri alır).
├── bakim/      Personel (öğretmen) işlemleri için şablonlar; yer tutucular doldurulur.
└── testler/    Test verisi ekleme ve temizleme (yalnızca geliştirme sırasında).
```

## Dosyalar: ne işe yarar, türü, geri alma

**Tür:** *Okur* = hiçbir şey değiştirmez. *Kalıcı* = veritabanında kalıcı değişiklik yapar. *Geri alınır* = sonunda `rollback` ile kendi yaptığını geri alır.

### kurulum/ (bu sırayla)

**Geri alma komutları canlıda çalıştırılırsa uygulamayı bozabilir; yalnızca neyi geri aldığını anlayarak kullanın.**

| Dosya | Ne yapar | Tür | Geri alma |
|---|---|---|---|
| `01_hesap_yonetimi.sql` | `wc_set_scopes` (personelin kademe/şube yetkilerini tek işlemde değiştirir; yalnızca Edge Function çağırır) ve `wc_personel_adlari` (personel adlarını verir) fonksiyonlarını kurar. | Kalıcı | `drop function public.wc_set_scopes(uuid, jsonb);` `drop function public.wc_personel_adlari(uuid[]);` |
| `02_siralama_wc_ranking.sql` | Güncel `wc_ranking` fonksiyonu (`kopya_sayisi` dahil). Eski sürümü `drop function` ile silip yeniden oluşturur. | Kalıcı | **Dosyada yok.** Eski sürüm kayıtlı olmadığı için basit bir geri alma yoktur; fonksiyonu silmek Sıralama sayfasını bozar. Bu dosyayı yeniden çalıştırmak (önce siler, sonra kurar) aynı sürümü yeniden kurar. |
| `03a_on_kontrol_P1_pasif_ogrenci_dagilimi.sql` | Aktif olmayan öğrencilerin ayrılma tarihi/nedeni nasıl? | Okur | Gerekmez |
| `03b_on_kontrol_P2_guvence_kurali_kontrolu.sql` | "Aktif öğrencide ayrılma bilgisi boş olmalı" kuralı mevcut kayıtlara uyuyor mu? | Okur | Gerekmez |
| `03c_on_kontrol_P3_cakisma_kontrolu.sql` | Kurulacak adlarda zaten bir fonksiyon/tetikleyici var mı? Hiç satır dönmemeli; satır dönerse 04 çalıştırılmaz. | Okur | Gerekmez |
| `04_ogrenci_yonetimi.sql` | Kademe koruması (aktif sezonda puan kaydı olan öğrencinin kademesi değişemez), puan kaydı sayıları, toplu arşivleme / geri alma / şube değiştirme / kademe değiştirme fonksiyonları. Tek işlemdedir; hata olursa hiçbir şey değişmez. **Yeniden çalıştırılamaz:** nesneler zaten varsa hata verir (zararsızdır). | Kalıcı | `drop trigger wc_students_grade_guard_trg on public.students;` `drop function public.wc_students_grade_guard();` `drop function public.wc_ogrenci_puan_sayilari();` `drop function public.wc_ogrenci_arsivle(uuid[], date, text);` `drop function public.wc_ogrenci_geri_al(uuid[]);` `drop function public.wc_ogrenci_sube_degistir(uuid[], text);` `drop function public.wc_ogrenci_kademe_degistir(uuid[], smallint, text);` (Bu satırlar dosyada yok, README'de önerilir.) |
| `05_guvence_kurali.sql` | Aktif öğrencinin `left_at` ve `left_reason` alanlarının boş olmasını veritabanında zorunlu kılar. **Yalnızca 03b sonucunda `aktif_ama_ayrilma_bilgisi_dolu = 0` ise çalıştırın.** | Kalıcı | `alter table public.students drop constraint students_aktif_ayrilma_chk;` |
| `06_unite_sonuclari_wc_unit_results.sql` | Ünite Sonuçları sayfası için `wc_unit_results` fonksiyonu (yönetici ve öğretmen için tüm kademe, yalnızca aktif öğrenciler, seçilen üniteye kadarki girdi/kopya kayıtları). Salt okunur fonksiyondur. | Kalıcı | Dosyanın sonunda yorum olarak: `drop function public.wc_unit_results(uuid, smallint, integer);` |

### dogrulama/

| Dosya | Ne yapar | Tür |
|---|---|---|
| `D1_nesneler_ve_izinler.sql` | 04'ten sonra: fonksiyonlar var mı, `anon`ın izni yok mu, `search_path` sabit mi? | Okur |
| `D2_davranis_raporu.sql` | 04'ten sonra: geçici test verisiyle senaryoları dener, tablo olarak raporlar, **sonunda her şeyi geri alır**. Sonunda editörde bir **hata mesajı** görünmesi normaldir ("RAPORDUR: N / N GEÇTİ"). **Çalıştırmadan önce** dosyadaki `<<YONETICI_KULLANICI_ADI>>` yer tutucularını yönetici hesabının kullanıcı adıyla değiştirin (bkz. aşağıdaki not). | Geri alınır |
| `D3_sube_degisimi_puan_kaydi_kaniti.sql` | Şube değişince puan kaydındaki eski şubenin değişmediğini gösterir (test öğrencisi 99003 için). | Okur |
| `D4_arsiv_durumu_kontrolu.sql` | Test öğrencilerinin aktiflik, ayrılma tarihi ve nedeni. | Okur |

**`wc_unit_results` için not:** SQL Editor `wc_is_staff()` için false döndürdüğünden, fonksiyonu editörden çağırırsanız boş sonuç dönmesi normaldir. Gerçek doğrulama sayfadan yapılır (yönetici ve öğretmen hesabıyla).

### bakim/ (personel işlemleri)

Hepsinde `<<UID>>` gibi yer tutucular vardır. Önce Supabase panelinde **Authentication > Users**'da hesabı açın ve hesabın *User UID* değerini kopyalayın. Yer tutucuları dosyada değil, SQL Editor'e yapıştırdığınız kopyada doldurun.

| Dosya | Ne yapar | Tür | Yer tutucular |
|---|---|---|---|
| `01_ogretmen_ekle.sql` | Yeni öğretmen için `wc_staff` kaydı ekler (okul, okul kodundan bulunur). | Kalıcı | `<<UID>>`, `<<AD SOYAD>>`, `<<kullanici_adi>>` |
| `02_yetki_ver.sql` | Öğretmenin kademe/şube yetkilerini değiştirir: eski yetkilerin **tümü silinir**, yazdıklarınız eklenir (tek işlem). **Çalıştırmadan önce `03_kontrol_listesi.sql` ile mevcut yetkileri not edin.** | Kalıcı | `<<UID>>` ve yetki listesi |
| `03_kontrol_listesi.sql` | Tüm personel, rolleri, durumları ve yetkileri. | Okur | Yok |
| `04_pasiflestir.sql` | Öğretmen hesabını pasifleştirir (yönetici hesabı bu komutla kapanmaz). Geri alma: `05_yeniden_etkinlestir.sql`. | Kalıcı | `<<UID>>` |
| `05_yeniden_etkinlestir.sql` | Pasif hesabı yeniden etkinleştirir. Geri alma: `04_pasiflestir.sql`. | Kalıcı | `<<UID>>` |
| `06_pasif_kanit_testi.sql` | Pasif bir öğretmenin hiçbir veriyi göremediğini kanıtlar; sonunda geri alır. | Geri alınır | `<<UID>>` (iki yerde, ikisine aynı) |

`04_pasiflestir.sql` ve `05_yeniden_etkinlestir.sql` birbirinin geri alma komutudur.

### testler/ (yalnızca geliştirme; gerçek öğrenciler varken dikkat)

**`01_ogrenci_test_verisi.sql` canlı veritabanına test öğrencisi ve 99. ünite sınavı ekler; sıralama ve Ünite Sonuçları'nda görünür. Gerçek sınav günlerinde ve öğretmenler puan girerken çalıştırmayın.**

| Dosya | Ne yapar | Tür |
|---|---|---|
| `01_ogrenci_test_verisi.sql` | 5 test öğrencisi (numara 99001-99005, adı "TEST…", 8. kademe, şube T), 8. kademe 99. ünite geçici sınavı ve 99003 için 1 puan kaydı ekler. **Canlı veritabanında çalışır:** 99. ünite sınavı ve test öğrencileri sıralama ve Ünite Sonuçları ekranlarında görünür; işiniz bitince temizleyin. | Kalıcı |
| `02_ogrenci_test_temizlik.sql` | Yukarıdaki test verisini siler: yalnızca numarası 99001-99005 ve adı TEST ile başlayan öğrencileri, 8. kademe 99. ünite sınavını ve ilgili puanları. Önce kontrol sorguları (A) çalışır; silme (B) ayrı bölümdür. Dosya gerçek öğrenci olup olmadığını kontrol eder, yine de **A bölümündeki sonuçları okuyup** silmeye öyle geçin. | Kalıcı (silme) |

## Dosya adları

Dosyaların **içerikleri** Masaüstündeki özgün sürümleriyle bire bir aynıdır (tek istisna aşağıdadır). Yalnızca dosya adları sıra numarasıyla yeniden adlandırıldı:

| Bu klasördeki ad | Özgün ad |
|---|---|
| `kurulum/01_hesap_yonetimi.sql` | `wc_hesap_yonetimi.sql` |
| `kurulum/02_siralama_wc_ranking.sql` | `wc_ranking_kopya.sql` |
| `kurulum/03a_…P1…` / `03b_…P2…` / `03c_…P3…` | `P1_…` / `P2_…` / `P3_…` |
| `kurulum/04_ogrenci_yonetimi.sql` | `01_ogrenci_yonetimi.sql` |
| `kurulum/05_guvence_kurali.sql` | `02_guvence_kurali.sql` |
| `kurulum/06_unite_sonuclari_wc_unit_results.sql` | `wc_unit_results.sql` |
| `dogrulama/D1…D4` | aynı adlar |
| `bakim/01…06` | `wc_sql_sablonlari/01…06` |
| `testler/01_ogrenci_test_verisi.sql` | `wc_ogrenci_test_verisi.sql` |
| `testler/02_ogrenci_test_temizlik.sql` | `wc_ogrenci_test_temizlik.sql` |

Not: bazı dosyalardaki "bana göster" gibi ifadeler, dosyalar hazırlanırken yazılmış notlardır; sonucu proje yöneticisine gösterin anlamına gelir.

### Tek içerik değişikliği: `dogrulama/D2_davranis_raporu.sql`

Özgün dosyada yönetici kullanıcı adı doğrudan yazılıydı (üç satır: bir açıklama, bir koşul, bir hata mesajı). Depo herkese açık olduğu için bu yerlerdeki kullanıcı adı `<<YONETICI_KULLANICI_ADI>>` yer tutucusuyla değiştirildi. **D2'yi çalıştırmadan önce bu yer tutucuyu yönetici hesabının kullanıcı adıyla doldurun.** Doldurmazsanız dosya "YÖNETİCİ KAYDI BULUNAMADI" hatasıyla durur ve hiçbir şey değişmez. Dosyanın geri kalanı özgün sürümle aynıdır.

## Kayıtlı olmayan nesneler

Aşağıdakilerin SQL'i bu depoda **yoktur** (Masaüstündeki dosyalarda da bulunmuyordu). Bunlar Supabase'de zaten kurulu ve çalışıyor, ancak kaynak metinleri kayıtlı değil. Bu klasördeki dosyalar tek başına sıfırdan bir veritabanı kurmaya **yetmez**; yalnızca sonradan eklenenleri belgeler.

- **İlk şema:** `schools`, `students`, `wc_staff`, `wc_staff_scopes`, `wc_seasons`, `wc_exams`, `wc_exam_scores` tabloları, sütunları, kısıtları ve indeksleri; eski final uygulamasının tabloları. Puan kaydında "puan girildiği andaki şube" bilgisinin tutulduğu sütun da bunlardandır.
- **RLS (satır düzeyi güvenlik) politikaları:** hangi rolün hangi tabloyu okuyup yazabildiği (örneğin öğretmenin yalnızca yetkili şubelerin ham puanını okuması).
- **Yardımcı fonksiyonlar:** `wc_is_staff`, `wc_is_admin`, `wc_my_school_id`, `wc_season_in_my_school` ve varsa diğerleri. Buradaki fonksiyonlar bunları çağırır.
- **Diğer tetikleyiciler** (kademe koruması hariç; o `kurulum/04`'te).
- **Edge Function** kaynak kodu (personel hesabı oluşturma ve yetki yönetimi için `wc_set_scopes`'u çağıran fonksiyon).

Bunları kayıt altına almak için Supabase CLI ile şema dökümü (`supabase db dump`) alınabilir; bu henüz yapılmadı.
