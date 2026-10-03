// Kullanıcı adıyla girişte arka planda kullanılan uydurma e-posta alanı.
// GEÇİCİ: 9. adımda (öğretmen hesapları) Supabase'in kabul ettiği alanla kesinleşecek.
export const KULLANICI_ADI_ALANI = 'giris.wordchampionship.invalid'

// Girilen metin e-posta ise olduğu gibi, değilse kullanıcı adı sayılıp uydurma e-postaya çevrilir.
export function girisEpostasi(girdi) {
  const metin = girdi.trim().toLowerCase()
  return metin.includes('@') ? metin : `${metin}@${KULLANICI_ADI_ALANI}`
}
