// Veritabanı hatalarını anlaşılır Türkçe mesaja çevirir.
// baglam: { tur: 'sinav' | 'sezon', grade, unit } - mesajı kişiselleştirmek için.
export function hataMetni(error, baglam = {}) {
  if (!error) return ''
  console.error('Veritabanı hatası:', error)
  switch (error.code) {
    case '23505':
      if (baglam.tur === 'sinav') {
        return `${baglam.grade}. kademe için ${baglam.unit}. ünite bu sezonda zaten tanımlı.`
      }
      if (baglam.tur === 'sezon') return 'Bu adda başka bir sezon zaten var.'
      return 'Bu kayıt zaten var.'
    case '23503':
      return 'Bu kayda bağlı puan kaydı olduğu için silinemez.'
    case '23514':
      return 'Girilen değerler geçersiz. Alanları kontrol edin.'
    case '42501':
      return 'Bu işlem için yetkiniz yok.'
    case 'P0001': // veritabanı koruma tetikleyicilerinin kendi Türkçe mesajları
      return error.message
    default:
      return 'Beklenmeyen bir hata oluştu. Bağlantınızı kontrol edip tekrar deneyin.'
  }
}
