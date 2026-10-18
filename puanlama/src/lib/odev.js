// Ödev Kontrolü mantığı (arayüzden ve veritabanından bağımsız, saf fonksiyonlar).
//
// Ödev: öğrencinin bir sınavdaki (kaynak sınav) doğru sayısına göre, bir sonraki ünitenin kelimelerini deftere yazması.
// Bant sınav kaydından HESAPLANIR (saklanmaz). Kontrol kayıtları "o tarihte toplam kaç kez yazdı" bilgisini tutar.
//
// Girdiler (veritabanı satırları, bu aşamada yalnızca şekilleri varsayılır):
//  sinavKaydi  : { status: 'girdi' | 'girmedi' | 'kopya', correct_count } ya da yok (kayıt yok)
//  kontrol     : { id, kontrol_tarihi: 'YYYY-MM-DD', toplam_yazilan, gereken, iptal, created_at }
//                Aynı (kontrol_tarihi) için en son eklenen satır geçerlidir; iptal=true olan geçerli satır kaydı kaldırır.
//  duzeltme    : { id, tur: 'ekstra_arti' | 'elle', puan, tarih: 'YYYY-MM-DD', neden, created_at }
import { adaGoreSirala } from './puanGirisi.js'

export const ODEV_SORU_SAYISI = 25
export const EN_FAZLA_TOPLAM_YAZILAN = 10

// --- Bant -----------------------------------------------------------------------------------------------------

// Sınav kaydından ödev bandı.
//  { tur: 'belirsiz' }                          sınav kaydı yok: artı/eksi işlenmez, "sonuç bekleniyor"
//  { tur: 'tanimsiz', neden }                   sınav 25 soru değil ya da doğru sayısı geçersiz
//  { tur: 'odevsiz', otomatikArti }             25 doğru: +2, 15-24 doğru: +1 (ödev yok)
//  { tur: 'yazma', gereken }                    kaç kez yazacak (1-5)
export function bantHesapla(sinavKaydi, soruSayisi) {
  if (soruSayisi !== ODEV_SORU_SAYISI) return { tur: 'tanimsiz', neden: 'soru-sayisi' }
  if (!sinavKaydi) return { tur: 'belirsiz' }
  if (sinavKaydi.status === 'girmedi' || sinavKaydi.status === 'kopya') return { tur: 'yazma', gereken: 5 }
  if (sinavKaydi.status !== 'girdi') return { tur: 'tanimsiz', neden: 'durum' }
  const d = sinavKaydi.correct_count
  if (!Number.isInteger(d) || d < 0 || d > ODEV_SORU_SAYISI) return { tur: 'tanimsiz', neden: 'dogru-sayisi' }
  if (d === 25) return { tur: 'odevsiz', otomatikArti: 2 }
  if (d >= 15) return { tur: 'odevsiz', otomatikArti: 1 }
  if (d >= 13) return { tur: 'yazma', gereken: 1 }
  if (d >= 8) return { tur: 'yazma', gereken: 2 }
  if (d >= 4) return { tur: 'yazma', gereken: 3 }
  if (d >= 1) return { tur: 'yazma', gereken: 4 }
  return { tur: 'yazma', gereken: 5 }
}

// --- Tarih / dönem ----------------------------------------------------------------------------------------------

const TARIH_BICIMI = /^(\d{4})-(\d{2})-(\d{2})$/

// 'YYYY-MM-DD' gerçek bir takvim günü mü? (Date nesnesine güvenilmez: saat dilimi kaymasın diye elle kontrol edilir.)
export function tarihGecerliMi(tarih) {
  const m = TARIH_BICIMI.exec(String(tarih ?? ''))
  if (!m) return false
  const [y, a, g] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (a < 1 || a > 12 || g < 1) return false
  const artik = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const gunler = [31, artik ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return g <= gunler[a - 1]
}

// Eylül-Ocak (Ocak dahil) 1. dönem, Şubat ve sonrası 2. dönem. Tarih yok ya da geçersizse null ("tarihsiz").
export function donemBul(tarih) {
  if (!tarihGecerliMi(tarih)) return null
  const ay = Number(String(tarih).slice(5, 7))
  return ay >= 9 || ay === 1 ? 1 : 2
}

// Kontrol tarihi doğrulaması. bugun: 'YYYY-MM-DD' (dışarıdan verilir; fonksiyon saat okumaz).
export function kontrolTarihiDogrula(tarih, bugun) {
  if (!tarihGecerliMi(tarih)) return { gecerli: false, hata: 'Geçerli bir tarih seç.' }
  if (String(tarih) > String(bugun)) return { gecerli: false, hata: 'Kontrol tarihi bugünden ileri olamaz.' }
  return { gecerli: true }
}

// --- Kontrol kayıtları ------------------------------------------------------------------------------------------

const yeniMi = (a, b) => (a.created_at === b.created_at ? String(a.id) > String(b.id) : String(a.created_at) > String(b.created_at))

// Ham kontrol satırlarından geçerli olanları çıkarır: aynı tarih için en son eklenen satır geçerlidir;
// o satır iptal ise o tarih kaydı yoktur. Sonuç tarihe göre eskiden yeniye sıralıdır (girişin sırasından bağımsız).
export function gecerliKontroller(satirlar) {
  const sonlar = new Map()
  for (const s of satirlar ?? []) {
    const mevcut = sonlar.get(s.kontrol_tarihi)
    if (!mevcut || yeniMi(s, mevcut)) sonlar.set(s.kontrol_tarihi, s)
  }
  return [...sonlar.values()]
    .filter((s) => !s.iptal)
    .sort((a, b) => String(a.kontrol_tarihi).localeCompare(String(b.kontrol_tarihi)))
}

// Her geçerli kontrolün sonucu (kendi anındaki `gereken` ile). kalan = gereken - toplam (eksiye düşmez).
//  İlk kontrol (tarihe göre): kalan 0 → +1 artı; kalan > 0 → -kalan.
//  Sonraki kontroller: kalan > 0 → -kalan; kalan 0 → "tamamlandı" (artı yok).
export function kontrolSonuclari(gecerli) {
  return gecerli.map((k, i) => {
    const kalan = Math.max(0, k.gereken - k.toplam_yazilan)
    let etki
    let durum
    if (kalan > 0) {
      etki = -kalan
      durum = 'eksi'
    } else if (i === 0) {
      etki = 1
      durum = 'arti'
    } else {
      etki = 0
      durum = 'tamamlandi'
    }
    return { tarih: k.kontrol_tarihi, toplam: k.toplam_yazilan, gereken: k.gereken, kalan, etki, durum }
  })
}

// Seçilen tarihten ÖNCEKİ son kontrolün toplamı (yoksa 0). "Önceki toplam" sütunu için.
export function oncekiToplam(gecerli, tarih) {
  let toplam = 0
  for (const k of gecerli) if (String(k.kontrol_tarihi) < String(tarih)) toplam = k.toplam_yazilan
  return toplam
}

// Girilen toplam yazılan sayısı. Azalan toplam hata değil, uyarıdır (geriye dönük giriş ya da düzeltme olabilir).
export function toplamDogrula(toplam, oncekiToplamDeger) {
  if (!Number.isInteger(toplam) || toplam < 0 || toplam > EN_FAZLA_TOPLAM_YAZILAN) {
    return { gecerli: false, hata: `0 ile ${EN_FAZLA_TOPLAM_YAZILAN} arasında tam sayı olmalı.` }
  }
  if (toplam < oncekiToplamDeger) {
    return { gecerli: true, uyari: `Önceki toplam ${oncekiToplamDeger}; toplam azalmaz. Emin misin?` }
  }
  return { gecerli: true }
}

// --- Bir öğrencinin bir ödevi ----------------------------------------------------------------------------------

// Bir (öğrenci, kaynak sınav) ödevinin tüm durumu.
//  bant           : bantHesapla sonucu (GÜNCEL bant)
//  sinavTarihi    : kaynak sınavın exam_date'i (otomatik artının dönemi için; yoksa null → "tarihsiz")
//  kontrolSatirlari, duzeltmeSatirlari : ham satırlar
// Dönen:
//  durum: 'belirsiz' | 'tanimsiz' | 'odevsiz' | 'acik' | 'tamamlandi'
//  gereken, sonToplam, kalan (yalnızca 'yazma' bandında anlamlı), bantDegisti (geçmiş kayıtlar gözden geçirilmeli)
//  ekstraYapildi, ekstraYapilabilir
//  hareketler: [{ tur: 'otomatik' | 'kontrol' | 'ekstra' | 'elle', puan, tarih, neden? }]  (artı ve eksi kalemleri)
//  arti, eksi (pozitif sayı), net
export function odevDurumu({ bant, sinavTarihi = null, kontrolSatirlari = [], duzeltmeSatirlari = [] }) {
  const gecerli = gecerliKontroller(kontrolSatirlari)
  const sonuclar = kontrolSonuclari(gecerli)
  const hareketler = []

  if (bant.tur === 'odevsiz') hareketler.push({ tur: 'otomatik', puan: bant.otomatikArti, tarih: sinavTarihi })
  for (const s of sonuclar) if (s.etki !== 0) hareketler.push({ tur: 'kontrol', puan: s.etki, tarih: s.tarih })

  // Ekstra artı ödev başına tek sefer (ilk eklenen sayılır); elle düzeltmelerin hepsi sayılır.
  const duzeltmeler = [...(duzeltmeSatirlari ?? [])].sort((a, b) => (yeniMi(a, b) ? 1 : -1))
  let ekstraYapildi = false
  for (const d of duzeltmeler) {
    if (d.tur === 'ekstra_arti') {
      if (ekstraYapildi) continue
      ekstraYapildi = true
      hareketler.push({ tur: 'ekstra', puan: 1, tarih: d.tarih, neden: d.neden ?? null })
    } else if (d.tur === 'elle' && d.puan) {
      hareketler.push({ tur: 'elle', puan: d.puan, tarih: d.tarih, neden: d.neden ?? null })
    }
  }

  const son = gecerli[gecerli.length - 1]
  const sonToplam = son ? son.toplam_yazilan : 0
  let durum
  let gereken = null
  let kalan = null
  let bantDegisti = false
  if (bant.tur === 'yazma') {
    gereken = bant.gereken
    kalan = Math.max(0, gereken - sonToplam)
    durum = son && kalan === 0 ? 'tamamlandi' : 'acik'
    bantDegisti = Boolean(son) && son.gereken !== gereken
  } else {
    durum = bant.tur // 'belirsiz' | 'tanimsiz' | 'odevsiz'
    bantDegisti = gecerli.length > 0 // kontrol kaydı var ama güncel bant yazma değil
  }

  const arti = hareketler.filter((h) => h.puan > 0).reduce((t, h) => t + h.puan, 0)
  const eksi = hareketler.filter((h) => h.puan < 0).reduce((t, h) => t - h.puan, 0)
  return {
    durum,
    gereken,
    sonToplam,
    kalan,
    bantDegisti,
    ekstraYapildi,
    ekstraYapilabilir: bant.tur === 'odevsiz' && !ekstraYapildi,
    kontrolSonuclari: sonuclar,
    hareketler,
    arti,
    eksi,
    net: arti - eksi,
  }
}

// --- Liste düzeni ----------------------------------------------------------------------------------------------

// Ödev Kontrolü listesi: açık ödevler üstte; ardından belirsiz/tanımsız, ödevsiz; tamamlayanlar altta.
// Her grubun içinde ad soyada göre Türkçe A-Z (eşitse öğrenci no sayısal). Satır: { full_name, student_no, durum }.
const ONCELIK = { acik: 0, belirsiz: 1, tanimsiz: 1, odevsiz: 2, tamamlandi: 3 }
export function odevSatirlariniSirala(satirlar) {
  return [0, 1, 2, 3].flatMap((g) => adaGoreSirala(satirlar.filter((s) => (ONCELIK[s.durum] ?? 1) === g)))
}

// --- Özet ------------------------------------------------------------------------------------------------------

// Bir öğrencinin ödevlerinden özet. odevler: [{ odevUnite, hareketler }] (odevDurumu çıktısından).
// donem: 'tumu' | 1 | 2. Dönem, her hareketin tarihine göredir (otomatik artıda kaynak sınav tarihi).
// Tarihsiz hareketler yalnızca 'tumu'da sayılır; her durumda `tarihsiz` sayacında bildirilir.
export function ogrenciOzeti(odevler, donem = 'tumu') {
  const unite = []
  let arti = 0
  let eksi = 0
  let tarihsiz = 0
  for (const o of odevler) {
    let a = 0
    let e = 0
    for (const h of o.hareketler) {
      const d = donemBul(h.tarih)
      if (d === null) tarihsiz++
      if (donem !== 'tumu' && d !== donem) continue
      if (h.puan > 0) a += h.puan
      else e -= h.puan
    }
    arti += a
    eksi += e
    unite.push({ odevUnite: o.odevUnite, arti: a, eksi: e, net: a - e })
  }
  unite.sort((x, y) => x.odevUnite - y.odevUnite)
  return { arti, eksi, net: arti - eksi, unite, tarihsiz }
}

// =====================================================================================================================
// Ödev Kontrolü sayfası için saf yardımcılar (arayüz bunları çağırır; veritabanı/React yok)
// =====================================================================================================================

// Bugünün tarihi, İSTANBUL gününe göre ('YYYY-MM-DD'). Veritabanı da ileri tarih denetimini İstanbul gününe göre yapar;
// tarayıcının kendi saat dilimi (ör. UTC) 21:00-24:00 arasında bir gün geride kalacağından kullanılmaz.
export function istanbulBugunu(simdi) {
  const d = simdi instanceof Date ? simdi : new Date(simdi)
  if (Number.isNaN(d.getTime())) return null
  const parcalar = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  )
  return `${parcalar.year}-${parcalar.month}-${parcalar.day}`
}

// Hızlı düğmeler: 0'dan gereken sayıya kadar (gereken 3 ise [0, 1, 2, 3]). Gereken yoksa düğme yok.
export function hizliDugmeler(gereken) {
  if (!Number.isInteger(gereken) || gereken < 1) return []
  return Array.from({ length: gereken + 1 }, (_, i) => i)
}

// Sınıf modunda "yapıldı / yapılmadı": bu hafta toplam gerekene ulaştı mı? Seçim yoksa null (henüz işaretlenmedi).
export function yapildiMi(toplam, gereken) {
  if (!Number.isInteger(toplam) || !Number.isInteger(gereken)) return null
  return toplam >= gereken
}

// Bir düğmeye basılınca seçim nasıl değişir.
//  mevcut   : şu anki seçim (sayı ya da undefined)
//  tiklanan : basılan düğmenin değeri
//  kayitli  : o tarihte veritabanında kayıtlı toplam (sayı ya da undefined)
// Kayıtlı bir değer kaydetmeden geri alınamaz (silme yok): kayıtlı değerin üzerine yeniden basmak bir şey değiştirmez.
// Henüz kaydedilmemiş bir seçime yeniden basmak seçimi geri alır (kayıtlı değere ya da boşa döner).
export function secimDegistir(mevcut, tiklanan, kayitli) {
  if (tiklanan === mevcut) return mevcut === kayitli ? mevcut : kayitli
  return tiklanan
}

// Satırın kaydedilmesi gereken bir değişikliği var mı? (seçim yeni ya da kayıtlıdan farklı, ya da bekleyen ekstra artı)
export function satirDegisti(secim, kayitli, ekstraSecimi = false) {
  const kontrolDegisti = Number.isInteger(secim) && secim !== kayitli
  return kontrolDegisti || Boolean(ekstraSecimi)
}

// Satırda hangi alanlar görünür. durum: odevDurumu().durum.
//  Sınıf modu (tahtada herkes görür): yalnızca ad, hızlı düğmeler ve yapıldı/yapılmadı; artı/eksi sonuçları,
//  gereken ve önceki toplam gizlenir. "Ödev yok" görünür, "sonuç bekleniyor" ve bant uyarıları gizlenir.
//  Hızlı düğmeler ve ekstra artı düğmesi her iki modda da görünür (düğmeler yalnızca yazma bandında vardır).
export function satirAlanlari(durum, sinifModu) {
  const yazma = durum === 'acik' || durum === 'tamamlandi'
  let etiket = null
  if (durum === 'odevsiz') etiket = 'Ödev yok'
  else if (durum === 'belirsiz' && !sinifModu) etiket = 'Sonuç bekleniyor'
  else if (durum === 'tanimsiz' && !sinifModu) etiket = 'Bant tanımsız (sınav 25 soru değil)'
  return {
    dugmeler: yazma,
    ekstra: durum === 'odevsiz',
    yapildiRozeti: sinifModu && yazma,
    gereken: !sinifModu && yazma,
    oncekiToplam: !sinifModu && yazma,
    hesap: !sinifModu,
    bantDegistiRozeti: !sinifModu,
    etiket,
  }
}

// "Tamamlananları gizle" kutusu: işaretliyse tamamlanan ödevler listeden çıkar.
export function gorunenSatirlar(satirlar, tamamlananlariGizle) {
  return tamamlananlariGizle ? satirlar.filter((s) => s.durum !== 'tamamlandi') : satirlar
}

// Kaydetmeden önizleme: seçilen toplamı, seçilen tarihte geçici bir kontrol gibi ekleyip sistemin hesabını verir.
// Geçici satır, aynı tarihteki kayıtlı satırın yerine geçer (en son satır geçerli kuralı). Yazma bandı dışında ya da
// seçim yoksa önizleme yoktur (etki null).
//  Dönen: { durum, etki (bu tarihteki kontrolün artı/eksisi ya da null), etiket: '+1' | '-2' | 'tamamlandı' | null, bantDegisti }
export function kontrolOnizleme({ bant, sinavTarihi = null, kontrolSatirlari = [], duzeltmeSatirlari = [], tarih, secim }) {
  const secimVar = bant.tur === 'yazma' && Number.isInteger(secim)
  const gecici = secimVar
    ? [{ id: 'onizleme', kontrol_tarihi: tarih, toplam_yazilan: secim, gereken: bant.gereken, iptal: false, created_at: '￿' }]
    : []
  const d = odevDurumu({ bant, sinavTarihi, kontrolSatirlari: [...kontrolSatirlari, ...gecici], duzeltmeSatirlari })
  let etki = null
  if (secimVar) {
    const bu = d.kontrolSonuclari.find((s) => s.tarih === tarih)
    etki = bu ? bu.etki : null
  }
  const etiket = etki === null ? null : etki > 0 ? `+${etki}` : etki < 0 ? `${etki}` : 'tamamlandı'
  return { durum: d.durum, etki, etiket, bantDegisti: d.bantDegisti, kalan: d.kalan }
}

// Kaydedilecek kontrol satırları: yazma bandındaki öğrencilerden, seçilen toplamı o tarihteki geçerli kayıttan farklı
// (ya da o tarihte kayıt yok) olanlar. `gereken` KAYIT ANINDAKİ güncel banttan alınır (sonradan değişse de bu satırda kalır).
//  ogrenciler: [{ student_id, bant, kontrolSatirlari }]   secimler: { [student_id]: sayı | undefined }
//  Dönen: { yazilacak: [...], gecersiz: sayı }  (geçersiz toplam yazılmaz)
export function kaydedilecekKontroller({ ogrenciler, secimler, tarih, kaynakExamId }) {
  const yazilacak = []
  let gecersiz = 0
  for (const o of ogrenciler) {
    const secim = secimler[o.student_id]
    if (o.bant.tur !== 'yazma' || secim === undefined || secim === null) continue
    if (!toplamDogrula(secim, 0).gecerli) {
      gecersiz++
      continue
    }
    const kayitli = gecerliKontroller(o.kontrolSatirlari).find((k) => k.kontrol_tarihi === tarih)
    if (kayitli && kayitli.toplam_yazilan === secim) continue
    yazilacak.push({
      student_id: o.student_id,
      kaynak_exam_id: kaynakExamId,
      kontrol_tarihi: tarih,
      toplam_yazilan: secim,
      gereken: o.bant.gereken,
      iptal: false,
    })
  }
  return { yazilacak, gecersiz }
}

// Bu ödev için ekstra artı daha önce kaydedilmiş mi?
export function ekstraVarMi(duzeltmeSatirlari) {
  return (duzeltmeSatirlari ?? []).some((d) => d.tur === 'ekstra_arti')
}

// Kaydedilecek ekstra artı satırları: yalnızca ödevsiz bantta, ödev başına tek sefer, tarih = kontrol tarihi.
//  ogrenciler: [{ student_id, bant, duzeltmeSatirlari }]   ekstraSecimleri: { [student_id]: true | false }
export function kaydedilecekEkstralar({ ogrenciler, ekstraSecimleri, tarih, kaynakExamId }) {
  return ogrenciler
    .filter((o) => ekstraSecimleri[o.student_id] && o.bant.tur === 'odevsiz' && !ekstraVarMi(o.duzeltmeSatirlari))
    .map((o) => ({ student_id: o.student_id, kaynak_exam_id: kaynakExamId, tur: 'ekstra_arti', puan: 1, tarih, neden: null }))
}

// "Bu tarihin kaydını iptal et": kayıtlı kontrolün aynı tarih ve değerleriyle iptal=true satırı (silme yok, yeni satır).
// Tarihte geçerli kayıt yoksa null.
export function iptalSatiri({ studentId, kaynakExamId, kontrolSatirlari, tarih }) {
  const kayitli = gecerliKontroller(kontrolSatirlari).find((k) => k.kontrol_tarihi === tarih)
  if (!kayitli) return null
  return {
    student_id: studentId,
    kaynak_exam_id: kaynakExamId,
    kontrol_tarihi: tarih,
    toplam_yazilan: kayitli.toplam_yazilan,
    gereken: kayitli.gereken,
    iptal: true,
  }
}

// Elle düzeltme iletişim kutusu doğrulaması: puan sıfırdan farklı tam sayı, neden zorunlu, tarih geçerli ve ileri değil.
// Çok büyük değerlerde yalnızca uyarı verir (hata değil).
export function elleDuzeltmeDogrula({ puan, neden, tarih, bugun }) {
  if (!Number.isInteger(puan) || puan === 0) return { gecerli: false, hata: 'Puan sıfırdan farklı bir tam sayı olmalı (örn. 2 ya da -1).' }
  if (String(neden ?? '').trim() === '') return { gecerli: false, hata: 'Neden yazmak zorunlu.' }
  const t = kontrolTarihiDogrula(tarih, bugun)
  if (!t.gecerli) return { gecerli: false, hata: t.hata }
  if (Math.abs(puan) > 10) return { gecerli: true, uyari: `${puan} büyük bir değer. Emin misin?` }
  return { gecerli: true }
}

// Elle düzeltme satırı (veritabanına yazılacak biçim)
export function elleDuzeltmeSatiri({ studentId, kaynakExamId, puan, neden, tarih }) {
  return { student_id: studentId, kaynak_exam_id: kaynakExamId, tur: 'elle', puan, tarih, neden: String(neden).trim() }
}
