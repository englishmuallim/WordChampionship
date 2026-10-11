// Çıktı alanını PNG olarak üretir; dokunmatik cihazda paylaşma menüsünü, olmazsa indirmeyi kullanır.
// html-to-image yalnızca gerektiğinde yüklenir (sayfa açılışını şişirmez).
// Yazı tipleri (Carlito) ve logo kendi sunucumuzdan geldiği için harici istek yapılmaz.

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

function dokunmatikMi() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

function indir(blob, dosyaAdi) {
  const adres = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = adres
  a.download = dosyaAdi
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(adres), 10000)
}

// Dokunmatik cihazda önce paylaşma menüsü; desteklenmiyorsa, iptal edilirse ya da hata verirse normal indirme.
// Masaüstünde doğrudan indirme. Döner: 'paylasildi' | 'indirildi'
export async function pngPaylasVeyaIndir(blob, dosyaAdi) {
  if (dokunmatikMi() && typeof navigator.canShare === 'function') {
    const dosya = new File([blob], dosyaAdi, { type: 'image/png' })
    if (navigator.canShare({ files: [dosya] })) {
      try {
        await navigator.share({ files: [dosya], title: dosyaAdi })
        return 'paylasildi'
      } catch {
        // iptal ya da (Safari'de uzun beklemeden sonra) izin hatası: indirmeye düşülür
      }
    }
  }
  indir(blob, dosyaAdi)
  return 'indirildi'
}
