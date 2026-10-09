// Öğrenci içe aktarma mantığı (arayüzden bağımsız, saf fonksiyonlar).
// Dosyadan yalnızca 4 sütun alınır: Öğrenci No, Ad Soyad, Kademe, Şube.
// Dosyadaki başka sütunlara (Şifre, Telefon, Email vb.) hiç dokunulmaz.
import { sadelestir } from './metin.js'
import { alanlariDogrula, bos } from './ogrenciDogrulama.js'

const BASLIK_ESLEME = {
  no: ['ogrencino', 'ogrencinumarasi', 'ogrno', 'okulno'],
  ad: ['adsoyad', 'adisoyadi', 'adsoyadi', 'adisoyad'],
  kademe: ['kademe'],
  sube: ['sube'],
}
const BASLIK_ADI = { no: 'Öğrenci No', ad: 'Ad Soyad', kademe: 'Kademe', sube: 'Şube' }

const baslikAnahtari = (metin) => sadelestir(metin).replace(/[^a-z0-9]/g, '')
// İlk 10 satırda başlık satırını arar. Bulamazsa hangi sütunların eksik olduğunu söyler.
export function satirlariAyir(satirlar) {
  let enIyi = { idx: {}, i: -1 }
  for (let i = 0; i < Math.min(satirlar.length, 10); i++) {
    const idx = {}
    ;(satirlar[i] ?? []).forEach((hucre, j) => {
      const a = baslikAnahtari(hucre)
      for (const [alan, liste] of Object.entries(BASLIK_ESLEME)) {
        if (idx[alan] === undefined && liste.includes(a)) idx[alan] = j
      }
    })
    if (Object.keys(idx).length > Object.keys(enIyi.idx).length) enIyi = { idx, i }
  }

  const eksik = Object.keys(BASLIK_ADI).filter((alan) => enIyi.idx[alan] === undefined)
  if (eksik.length) {
    return {
      hata:
        `Dosyada şu sütun başlıkları bulunamadı: ${eksik.map((a) => BASLIK_ADI[a]).join(', ')}. ` +
        `Beklenen başlıklar: ${Object.values(BASLIK_ADI).join(', ')}.`,
    }
  }

  const { idx } = enIyi
  const ham = []
  for (let i = enIyi.i + 1; i < satirlar.length; i++) {
    const s = satirlar[i] ?? []
    const kayit = { satir: i + 1, no: s[idx.no], ad: s[idx.ad], kademe: s[idx.kademe], sube: s[idx.sube] }
    if (bos(kayit.no) && bos(kayit.ad) && bos(kayit.kademe) && bos(kayit.sube)) continue
    ham.push(kayit)
  }
  if (!ham.length) return { hata: 'Dosyada başlık satırından sonra öğrenci satırı bulunamadı.' }
  return { ham }
}

// Tek satırı doğrular ve temizler. Her hata { kod, mesaj } biçimindedir.
// Kurallar ogrenciDogrulama.js içindedir ve tek öğrenci formuyla ortaktır.
export function satirDogrula(ham) {
  return alanlariDogrula(ham, 'dosya')
}

const ALANLAR = [
  ['full_name', 'Ad Soyad'],
  ['grade', 'Kademe'],
  ['class_name', 'Şube'],
]

// ham: satirlariAyir'ın çıktısı. mevcutlar: veritabanındaki öğrenciler (student_no, full_name, grade, class_name, is_active).
export function planOlustur(ham, mevcutlar) {
  const mevcutMap = new Map(mevcutlar.map((o) => [o.student_no, o]))
  const dogrulanan = ham.map((h) => ({ h, d: satirDogrula(h) }))

  // Dosyada tekrar eden öğrenci no'ları bul
  const nolar = new Map()
  for (const { h, d } of dogrulanan) {
    if (d.no === null) continue
    if (!nolar.has(d.no)) nolar.set(d.no, [])
    nolar.get(d.no).push(h.satir)
  }

  const eslesenMevcut = new Set()
  const satirlar = dogrulanan.map(({ h, d }) => {
    const hatalar = [...d.hatalar]
    const tekrar = d.no !== null ? nolar.get(d.no) : null
    if (tekrar && tekrar.length > 1) {
      hatalar.push({
        kod: 'tekrar',
        mesaj: `Aynı öğrenci no (${d.no}) dosyada ${tekrar.join(', ')}. satırlarda geçiyor.`,
      })
    }

    const kayit = { satir: h.satir, ham: h, deger: null, farklar: [], hatalar, pasif: false, kademeDegisti: false }
    if (hatalar.length) return { ...kayit, durum: 'hatali' }

    kayit.deger = d.deger
    const eski = mevcutMap.get(d.deger.student_no)
    if (!eski) return { ...kayit, durum: 'yeni' }

    eslesenMevcut.add(d.deger.student_no)
    kayit.pasif = eski.is_active === false
    for (const [alan, etiket] of ALANLAR) {
      const e = eski[alan] ?? ''
      const y = d.deger[alan] ?? ''
      if (String(e) !== String(y)) kayit.farklar.push({ alan, etiket, eski: String(e), yeni: String(y) })
    }
    kayit.kademeDegisti = kayit.farklar.some((f) => f.alan === 'grade')
    return { ...kayit, durum: kayit.farklar.length ? 'guncellenecek' : 'ayni' }
  })

  const say = (durum) => satirlar.filter((s) => s.durum === durum).length
  return {
    satirlar,
    sayilar: {
      yeni: say('yeni'),
      guncellenecek: say('guncellenecek'),
      ayni: say('ayni'),
      hatali: say('hatali'),
      pasif: satirlar.filter((s) => s.pasif).length,
      kademeDegisen: satirlar.filter((s) => s.kademeDegisti).length,
      // Dosyada olmayan ya da hatalı olduğu için işlenmeyecek mevcut öğrenciler
      dokunulmayan: mevcutMap.size - eslesenMevcut.size,
    },
  }
}

const HATA_ETIKETLERI = {
  no_bos: 'Öğrenci no boş',
  no_gecersiz: 'Öğrenci no geçersiz',
  ad_bos: 'Ad Soyad boş',
  ad_uzun: 'Ad Soyad çok uzun',
  kademe_gecersiz: 'Kademe geçersiz (5-8 olmalı)',
  kademe_birlesik: 'Kademe ve Şube aynı sütunda',
  sube_bos: 'Şube boş',
  sube_gecersiz: 'Şube geçersiz (tek harf olmalı)',
  sube_kademe_uyusmaz: 'Şube ile Kademe uyuşmuyor',
  tekrar: 'Aynı öğrenci no dosyada birden fazla',
}

// Hatalı satırların nedenlerini sayarak özetler: [{ etiket, adet }]
export function hataOzeti(plan) {
  const sayac = new Map()
  for (const s of plan.satirlar) {
    for (const kod of new Set(s.hatalar.map((h) => h.kod))) {
      sayac.set(kod, (sayac.get(kod) ?? 0) + 1)
    }
  }
  return [...sayac.entries()].map(([kod, adet]) => ({ etiket: HATA_ETIKETLERI[kod] ?? kod, adet }))
}

// Veritabanına yazılacak satırlar: yalnızca yeni ve güncellenecekler, yalnızca 5 alan.
export function yazilacakSatirlar(plan, schoolId) {
  return plan.satirlar
    .filter((s) => s.durum === 'yeni' || s.durum === 'guncellenecek')
    .map((s) => ({
      school_id: schoolId,
      student_no: s.deger.student_no,
      full_name: s.deger.full_name,
      grade: s.deger.grade,
      class_name: s.deger.class_name,
    }))
}
