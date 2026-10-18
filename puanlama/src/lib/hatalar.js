// Veritabanı sunucusunun kendi (Türkçe) hata mesajlarını, kullanıcıya daha açık anlatan metne çevirir.
// Tanınmayan mesaj olduğu gibi döner. Mesajlar 01_ogrenci_yonetimi.sql içindeki fonksiyon ve tetikleyicilerden gelir.
export function sunucuMesajiniCevir(mesaj) {
  const m = String(mesaj ?? '')
  const kademe = m.match(/kademesi değiştirilemez \(öğrenci no: (.+?)\)/)
  if (kademe) {
    return (
      `${kademe[1]} numaralı öğrencinin aktif sezonda puan kaydı olduğu için kademesi değiştirilemez. ` +
      'Değiştirilseydi eski kademenin puanları yeni kademenin sıralamasına taşınırdı.'
    )
  }
  const sayi = m.match(/Seçilen (\d+) öğrenciden yalnızca (\d+) tanesi/)
  if (sayi) {
    return (
      `Seçilen ${sayi[1]} öğrenciden yalnızca ${sayi[2]} tanesi işlenebildi (liste başka biri tarafından ` +
      'değiştirilmiş olabilir). Hiçbir değişiklik yapılmadı. Sayfayı yenileyip tekrar dene.'
    )
  }
  if (m.includes('yönetici yetkisi gerekir')) return 'Bu işlem için yönetici yetkisi gerekir.'
  // Ödev tablolarının tetikleyicisi (ASCII Türkçe mesajlar)
  if (m.includes('bugunden ileri olamaz')) return 'Tarih bugünden ileri olamaz.'
  if (m.includes('kademesi') && m.includes('uyusmuyor')) return 'Öğrencinin kademesi sınavın kademesiyle uyuşmuyor.'
  if (m.includes('Oturum bulunamadi')) return 'Oturum bulunamadı. Sayfayı yenileyip yeniden giriş yap.'
  return m
}

// Veritabanı hatalarını anlaşılır Türkçe mesaja çevirir.
// baglam: { tur: 'sinav' | 'sezon' | 'ogrenci' | 'odev-ekstra', grade, unit, no } - mesajı kişiselleştirmek için.
export function hataMetni(error, baglam = {}) {
  if (!error) return ''
  console.error('Veritabanı hatası:', error)
  switch (error.code) {
    case '23505':
      if (baglam.tur === 'sinav') {
        return `${baglam.grade}. kademe için ${baglam.unit}. ünite bu sezonda zaten tanımlı.`
      }
      if (baglam.tur === 'sezon') return 'Bu adda başka bir sezon zaten var.'
      if (baglam.tur === 'odev-ekstra') return 'Bu ödev için ekstra artı zaten kaydedilmiş.'
      if (baglam.tur === 'ogrenci') {
        return `Bu öğrenci numarası zaten kayıtlı${baglam.no ? ` (${baglam.no})` : ''}.`
      }
      return 'Bu kayıt zaten var.'
    case '23503':
      if (baglam.tur === 'ogrenci') return 'Bu öğrencinin puan kaydı olduğu için silinemez.'
      return 'Bu kayda bağlı puan kaydı olduğu için silinemez.'
    case '23514':
      return 'Girilen değerler geçersiz. Alanları kontrol edin.'
    case '42501':
      return 'Bu işlem için yetkiniz yok.'
    case 'P0001': // veritabanı koruma tetikleyicilerinin ve fonksiyonlarının kendi Türkçe mesajları
      return sunucuMesajiniCevir(error.message)
    default:
      return 'Beklenmeyen bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyin.'
  }
}

// Ödev tabloları veritabanında henüz yok mu? (SQL çalıştırılmadıysa PostgREST/Postgres "tablo bulunamadı" der.)
export function odevTablosuYokMu(error) {
  return Boolean(error) && (error.code === 'PGRST205' || error.code === '42P01')
}

export const ODEV_TABLOSU_YOK_MESAJI =
  'Ödev tabloları veritabanında henüz kurulmamış. puanlama/sql/kurulum/07_odev_tablolari.sql dosyası Supabase SQL editöründe çalıştırıldıktan sonra sayfa çalışacaktır.'
