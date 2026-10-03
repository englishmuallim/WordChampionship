// Puan girişi mantığı (arayüzden bağımsız, saf fonksiyonlar).
// Bir satırın ekrandaki hali: { deger: '23', isaret: '' }   (isaret: '' | 'girmedi' | 'kopya')
// "isaret" tek alan olduğu için Girmedi ve Kopya aynı anda seçilemez.
// Kayıtlı hali (veritabanı): { status: 'girdi' | 'girmedi' | 'kopya', correct_count: number | null }
import { sadelestir } from './metin.js'

export const BOS_SATIR = { deger: '', isaret: '' }

// Öğrenci numaralarını sayısal sıralar (9 < 10 < 100)
export function numaraSirala(liste) {
  return [...liste].sort((a, b) => a.student_no.localeCompare(b.student_no, 'tr', { numeric: true }))
}

// Kayıtlı puanı ekran satırına çevirir
export function kayittanSatir(kayit) {
  if (!kayit) return { ...BOS_SATIR }
  if (kayit.status === 'girmedi') return { deger: '', isaret: 'girmedi' }
  if (kayit.status === 'kopya') return { deger: '', isaret: 'kopya' }
  return { deger: String(kayit.correct_count), isaret: '' }
}

// Bir hücre değerini yorumlar: sayı | girmedi (G) | kopya (K) | boş | geçersiz
export function degerCoz(hucre, soruSayisi) {
  const m = String(hucre ?? '').trim()
  if (m === '') return { tur: 'bos' }
  const s = sadelestir(m)
  if (s === 'g' || s === 'girmedi') return { tur: 'girmedi' }
  if (s === 'k' || s === 'kopya') return { tur: 'kopya' }
  if (/^\d+$/.test(m)) {
    const n = Number(m)
    if (n <= soruSayisi) return { tur: 'sayi', n }
    return { tur: 'gecersiz', neden: 'aralik', mesaj: `${n} değeri 0-${soruSayisi} aralığının dışında.` }
  }
  return { tur: 'gecersiz', neden: 'bicim', mesaj: `"${m.slice(0, 20)}" geçerli bir değer değil (sayı veya G olmalı).` }
}

// Bir satırı kayıtlı haliyle karşılaştırıp değerlendirir.
//  durum: 'girdi' | 'girmedi' | 'kopya' | 'bos' | 'gecersiz'
//  degisti: kaydedilmesi gereken bir değişiklik var mı (geçersiz satır da "değişti" sayılır, kaydı engeller)
//  korunur: kutu boş ama kayıtlı puan var; kayıtlı puan silinemediği için korunacak
export function satirDegerlendir(satir, kayit, soruSayisi) {
  if (satir.isaret === 'girmedi' || satir.isaret === 'kopya') {
    return { durum: satir.isaret, degisti: !(kayit && kayit.status === satir.isaret), korunur: false }
  }
  if (satir.deger.trim() === '') {
    return { durum: 'bos', degisti: false, korunur: Boolean(kayit) }
  }
  const c = degerCoz(satir.deger, soruSayisi)
  if (c.tur === 'sayi') {
    const ayni = kayit && kayit.status === 'girdi' && kayit.correct_count === c.n
    return { durum: 'girdi', dogru: c.n, degisti: !ayni, korunur: false }
  }
  return { durum: 'gecersiz', degisti: true, korunur: false, hata: `0 ile ${soruSayisi} arasında tam sayı olmalı.` }
}

// Değerlendirilmiş satırlardan veritabanına yazılacakları çıkarır.
// degerlendirmeler: [{ ogrenci, d }] (d = satirDegerlendir sonucu)
export function kaydedilecekler(degerlendirmeler, sinavId) {
  const yazilacak = []
  let gecersiz = 0
  let korunan = 0
  for (const { ogrenci, d } of degerlendirmeler) {
    if (d.durum === 'gecersiz') gecersiz++
    else if (d.korunur) korunan++
    else if (d.degisti && d.durum === 'girdi') {
      yazilacak.push({ exam_id: sinavId, student_id: ogrenci.id, status: 'girdi', correct_count: d.dogru })
    } else if (d.degisti && (d.durum === 'girmedi' || d.durum === 'kopya')) {
      yazilacak.push({ exam_id: sinavId, student_id: ogrenci.id, status: d.durum, correct_count: null })
    }
  }
  return { yazilacak, gecersiz, korunan }
}

// Alt çubuk özeti. Ekrandaki duruma göre hesaplanır (kaydedilmemiş girişler dahil).
// Ortalama yalnızca "girdi" satırlarından hesaplanır; girmedi ve kopya ortalamaya katılmaz.
export function ozetHesapla(degerlendirmeler, soruBasiPuan) {
  const s = {
    toplam: degerlendirmeler.length, girdi: 0, girmedi: 0, kopya: 0, bos: 0, gecersiz: 0, degisen: 0, ortalama: null,
  }
  let toplamPuan = 0
  for (const { d } of degerlendirmeler) {
    s[d.durum]++
    if (d.degisti) s.degisen++
    if (d.durum === 'girdi') toplamPuan += d.dogru * soruBasiPuan
  }
  if (s.girdi > 0) s.ortalama = Math.round((toplamPuan / s.girdi) * 10) / 10
  return s
}

const noSadelestir = (no) => String(no ?? '').trim().replace(/^(\d+)\.0+$/, '$1')

// Başlık satırı tanıma: sütun başlığı olabilecek sözcükler (Türkçe karakter/büyük-küçük harf farkı yok sayılır)
const BASLIK_KELIMELERI = new Set([
  'ogrencino', 'ogrencinumarasi', 'ogrno', 'okulno', 'no',
  'adsoyad', 'adisoyadi', 'adsoyadi', 'adisoyad',
  'dogru', 'dogrusayisi', 'puan',
])
const baslikAnahtari = (m) => sadelestir(m).replace(/[^a-z0-9]/g, '')

// İsim karşılaştırması: büyük/küçük harf, Türkçe karakterler ve fazla boşluklar yok sayılır
const adAnahtari = (m) => sadelestir(m).replace(/\s+/g, ' ').trim()

export const EN_FAZLA_SUTUN_HATASI = 'En fazla 3 sütun: No, Ad Soyad, Doğru sayısı'

// Excel'den yapıştırılan metni çözer. Biçim, en geniş satırın sütun sayısından anlaşılır:
//  Değer olarak sayı, G/girmedi, K/kopya ya da boş (dokunma) kabul edilir.
//  Biçim 1: tek sütun, ekrandaki liste sırasıyla uygulanır.
//  Biçim 2: iki sütun (öğrenci no, değer), numaraya göre eşleştirilir.
//  Biçim 3: üç sütun (öğrenci no, ad soyad, değer). Eşleşme yine yalnızca numaraya göredir;
//           ad soyad sadece kontrol içindir: farklıysa uyarı verir ama satırı engellemez.
//  3'ten fazla sütun: hata, hiçbir şey uygulanmaz.
// ogrenciler: ekrandaki sıralı liste [{ id, student_no, full_name }]
export function yapistirmaCoz(metin, ogrenciler, soruSayisi) {
  const sonuc = { bicim: null, baslikAtlandi: false, uygulanacak: [], uyarilar: [], girdiSayisi: 0, isimFarki: 0, hata: '' }
  const satirlar = String(metin ?? '').replace(/\r\n?/g, '\n').split('\n')
  while (satirlar.length && satirlar[satirlar.length - 1].trim() === '') satirlar.pop()
  if (!satirlar.length) return sonuc

  const bol = (s) => (s.includes('\t') ? s.split('\t') : s.includes(';') ? s.split(';') : [s])
  const hucreler = satirlar.map(bol)
  const enCok = Math.max(...hucreler.map((h) => h.length))
  if (enCok > 3) {
    sonuc.hata = EN_FAZLA_SUTUN_HATASI
    return sonuc
  }
  const bicim = enCok
  sonuc.bicim = bicim

  let girdiler = hucreler.map((h, i) => {
    if (bicim === 1) return { satir: i + 1, h, deger: h[0] }
    if (bicim === 2) return { satir: i + 1, h, no: noSadelestir(h[0]), deger: h[1] ?? '', eksikSutun: h.length < 2 }
    return { satir: i + 1, h, no: noSadelestir(h[0]), ad: h[1] ?? '', deger: h[2] ?? '', eksikSutun: h.length < 3 }
  })

  // İlk satır başlıksa atla: "Öğrenci No" gibi bir başlık sözcüğü varsa ya da değer sütunu
  // geçerli bir değer değilse (ve geri kalan satırlar düzgünse).
  const ilk = girdiler[0]
  const kelimeli = ilk.h.some((c) => BASLIK_KELIMELERI.has(baslikAnahtari(c)))
  const degerBicimsiz = degerCoz(ilk.deger, soruSayisi).neden === 'bicim' && girdiler.length > 1
  const digerleriDuzgun = girdiler.slice(1).every((g) => degerCoz(g.deger, soruSayisi).neden !== 'bicim')
  if ((kelimeli || degerBicimsiz) && digerleriDuzgun) {
    girdiler = girdiler.slice(1)
    sonuc.baslikAtlandi = true
  }
  sonuc.girdiSayisi = girdiler.length

  const ekle = (ogr, c) => {
    if (c.tur === 'sayi') sonuc.uygulanacak.push({ ogrenciId: ogr.id, deger: String(c.n), isaret: '' })
    else if (c.tur === 'girmedi' || c.tur === 'kopya') {
      sonuc.uygulanacak.push({ ogrenciId: ogr.id, deger: '', isaret: c.tur })
    }
  }

  if (bicim === 1) {
    girdiler.forEach((g, k) => {
      const ogr = ogrenciler[k]
      if (!ogr) return
      const c = degerCoz(g.deger, soruSayisi)
      if (c.tur === 'gecersiz') sonuc.uyarilar.push(`Satır ${g.satir} (${ogr.full_name}): ${c.mesaj}`)
      else ekle(ogr, c)
    })
    if (girdiler.length > ogrenciler.length) {
      sonuc.uyarilar.push(
        `${girdiler.length} değer yapıştırıldı ama listede ${ogrenciler.length} öğrenci var; fazla ${girdiler.length - ogrenciler.length} değer uygulanmadı.`
      )
    } else if (girdiler.length < ogrenciler.length) {
      sonuc.uyarilar.push(
        `${girdiler.length} değer yapıştırıldı, listede ${ogrenciler.length} öğrenci var; son ${ogrenciler.length - girdiler.length} öğrenciye dokunulmadı.`
      )
    }
    return sonuc
  }

  // Biçim 2 ve 3: numaraya göre eşleştirme
  const noyaGore = new Map(ogrenciler.map((o) => [noSadelestir(o.student_no), o]))
  const sayac = new Map()
  for (const g of girdiler) sayac.set(g.no, [...(sayac.get(g.no) ?? []), g.satir])
  const bildirilen = new Set()
  const beklenen = bicim === 2 ? 'iki sütun (öğrenci no ve değer)' : 'üç sütun (öğrenci no, ad soyad ve değer)'
  for (const g of girdiler) {
    if (g.eksikSutun) {
      sonuc.uyarilar.push(`Satır ${g.satir}: ${beklenen} bekleniyordu.`)
      continue
    }
    if (g.no === '') {
      sonuc.uyarilar.push(`Satır ${g.satir}: öğrenci no boş.`)
      continue
    }
    if (sayac.get(g.no).length > 1) {
      if (!bildirilen.has(g.no)) {
        bildirilen.add(g.no)
        sonuc.uyarilar.push(
          `Satır ${sayac.get(g.no).join(', ')}: ${g.no} numarası birden fazla kez geçiyor, hiçbiri uygulanmadı.`
        )
      }
      continue
    }
    const ogr = noyaGore.get(g.no)
    if (!ogr) {
      sonuc.uyarilar.push(`Satır ${g.satir}: ${g.no} numaralı öğrenci bu şubede yok.`)
      continue
    }
    if (bicim === 3 && adAnahtari(g.ad) !== '' && adAnahtari(g.ad) !== adAnahtari(ogr.full_name)) {
      sonuc.isimFarki++
      sonuc.uyarilar.push(
        `Satır ${g.satir}: İsim farkı, numaraya göre eşleşti. Kayıtlı ad: "${ogr.full_name}" / yapıştırılan ad: "${g.ad.trim()}".`
      )
    }
    const c = degerCoz(g.deger, soruSayisi)
    if (c.tur === 'gecersiz') sonuc.uyarilar.push(`Satır ${g.satir} (${ogr.full_name}): ${c.mesaj}`)
    else ekle(ogr, c)
  }
  return sonuc
}

// Yapıştırma, kutularda zaten dolu olan kaç değeri değiştirecek?
export function yapistirmaEtkisi(uygulanacak, satirlar) {
  return uygulanacak.filter((u) => {
    const mevcut = satirlar[u.ogrenciId] ?? BOS_SATIR
    const dolu = mevcut.isaret !== '' || mevcut.deger.trim() !== ''
    return dolu && (mevcut.isaret !== u.isaret || mevcut.deger.trim() !== u.deger)
  }).length
}

// Yapıştırılan değerleri ekrandaki satırlara uygular (kaydetmez)
export function yapistirmaUygula(satirlar, uygulanacak) {
  const yeni = { ...satirlar }
  for (const u of uygulanacak) yeni[u.ogrenciId] = { deger: u.deger, isaret: u.isaret }
  return yeni
}
