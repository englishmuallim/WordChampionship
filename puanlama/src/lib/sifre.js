// Şifre kuralları (arayüzden bağımsız, saf fonksiyonlar).
// Kural: en az 6 karakter, en az bir harf (Türkçe harfler dahil) ve en az bir rakam.
// Not: Supabase tarafında yalnızca "en az 6 karakter" zorunludur; harf + rakam kuralı burada uygulanır.

export const EN_AZ_UZUNLUK = 6
const EN_FAZLA_BAYT = 72 // Supabase'in şifre sınırı (bcrypt)

// Yeni şifre kurala uyuyor mu? Uymayan her kural için bir mesaj döner.
export function sifreKuraliniDenetle(sifre) {
  const hatalar = []
  const s = String(sifre ?? '')
  if ([...s].length < EN_AZ_UZUNLUK) hatalar.push(`Şifre en az ${EN_AZ_UZUNLUK} karakter olmalı.`)
  if (!/\p{L}/u.test(s)) hatalar.push('Şifre en az bir harf içermeli.')
  if (!/[0-9]/.test(s)) hatalar.push('Şifre en az bir rakam içermeli.')
  if (s !== s.trim()) hatalar.push('Şifrenin başında ya da sonunda boşluk olmamalı.')
  if (new TextEncoder().encode(s).length > EN_FAZLA_BAYT) hatalar.push('Şifre çok uzun.')
  return hatalar
}

// Şifre değiştirme formunu denetler: mevcut şifre dolu mu, yeni şifre kurala uyuyor mu,
// tekrarı aynı mı, mevcut şifreden farklı mı. Hata yoksa boş dizi döner.
export function sifreDegisiminiDenetle({ mevcut, yeni, tekrar }) {
  const hatalar = []
  if (!String(mevcut ?? '')) hatalar.push('Mevcut şifreni yaz.')
  hatalar.push(...sifreKuraliniDenetle(yeni))
  if (yeni !== tekrar) hatalar.push('Yeni şifre ile tekrarı aynı değil.')
  if (mevcut && yeni && mevcut === yeni) hatalar.push('Yeni şifre mevcut şifreden farklı olmalı.')
  return hatalar
}
