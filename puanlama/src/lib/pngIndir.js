// Çıktı alanını PNG olarak üretir; indirir ya da paylaşma menüsüne gönderir (iki ayrı işlem).
// html-to-image yalnızca gerektiğinde yüklenir (sayfa açılışını şişirmez).
// Yazı tipleri (Carlito) ve logo kendi sunucumuzdan geldiği için harici istek yapılmaz.

import { paylasimIptalMi } from './uniteSonuclari'

const PIKSEL_ORANI = 2

// Çıktı öğesini 1500 px × 2 = 3000 px genişlikte PNG'ye çevirir. Öğenin ekrandaki ölçeği (transform) sonucu etkilemez:
// html-to-image öğenin kendi boyutunu (offsetWidth) kullanır, üst kaptaki ölçeği kullanmaz.
export async function pngUret(dugum) {
  const { toBlob } = await import('html-to-image')
  await document.fonts.ready
  const secenek = { pixelRatio: PIKSEL_ORANI, backgroundColor: '#ffffff' }
  // Safari ilk çağrıda yazı tipi ve resmi boş çizebiliyor: ilk sonuç atılır, ikincisi kullanılır.
  await toBlob(dugum, secenek)
  const blob = await toBlob(dugum, secenek)
  if (!blob) throw new Error('PNG üretilemedi')
  return blob
}

// Gerçek (geçerli) 1x1 PNG. Destek denemesinde boş dosya yerine bu kullanılır: bazı tarayıcılar boş dosyayı reddeder.
const KUCUK_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

export function denemeDosyasi() {
  const bayt = Uint8Array.from(atob(KUCUK_PNG), (c) => c.charCodeAt(0))
  return new File([bayt], 'deneme.png', { type: 'image/png' })
}

// Doğrudan dosya indirir; paylaşma menüsüne hiç dokunmaz (her cihazda aynı).
export function pngIndir(blob, dosyaAdi) {
  const adres = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = adres
  a.download = dosyaAdi
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(adres), 10000)
}

// Paylaşma menüsünü açar. Döner: 'paylasildi' | 'iptal' (kullanıcı menüyü kapattı: hiçbir şey yapılmaz).
// Diğer hatalar (ör. NotAllowedError) çağırana fırlatılır.
export async function pngPaylas(blob, dosyaAdi) {
  const dosya = new File([blob], dosyaAdi, { type: 'image/png' })
  try {
    await navigator.share({ files: [dosya], title: dosyaAdi })
    return 'paylasildi'
  } catch (hata) {
    if (paylasimIptalMi(hata)) return 'iptal'
    throw hata
  }
}
