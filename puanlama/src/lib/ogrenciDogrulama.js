// Öğrenci alanlarının doğrulama kuralları (arayüzden bağımsız, saf fonksiyonlar).
// Hem Excel/CSV içe aktarma hem de tek öğrenci ekleme/düzenleme formu AYNI kuralları kullanır:
//   Öğrenci no : dolu, harf/rakam/._- karakterleri, en çok 20 karakter
//   Ad Soyad   : dolu, fazla boşluklar tek boşluğa iner, en çok 100 karakter
//   Kademe     : 5 ile 8 arasında tam sayı
//   Şube       : tek harf ("A"); "5-A", "5/A", "5 A" gibi gelirse harfe indirilir
// baglam: hata mesajlarının dili. 'dosya' = içe aktarma ("sütun"), 'form' = tek öğrenci formu ("alan").

export const bos = (v) => v === null || v === undefined || String(v).trim() === ''
const goster = (v) => (v instanceof Date ? 'tarih' : String(v).slice(0, 30))

// Hücre değerini metne çevirir: tam sayı -> metin, metin -> kırpılmış metin, diğerleri (tarih, ondalık, mantıksal) -> null
function tamMetin(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : null
  if (typeof v === 'string') return v.trim()
  return null
}

// Bağlama göre değişen iki mesaj
const MESAJLAR = {
  dosya: {
    kademeBirlesik: (m) => `Kademe sütununda "${m}" var; Kademe ve Şube ayrı sütunlarda olmalı.`,
    kademeUyusmaz: (subedeki, kademe) =>
      `Şube sütunundaki kademe (${subedeki}) ile Kademe sütunu (${kademe}) uyuşmuyor.`,
  },
  form: {
    kademeBirlesik: (m) => `Kademe alanında "${m}" var; Kademe ve Şube ayrı alanlarda olmalı.`,
    kademeUyusmaz: (subedeki, kademe) =>
      `Şube alanındaki kademe (${subedeki}) ile Kademe alanı (${kademe}) uyuşmuyor.`,
  },
}

// Her alan doğrulayıcısı { deger, hata } döner. hata: null ya da { kod, mesaj }.

export function ogrenciNoDogrula(ham) {
  if (bos(ham)) return { deger: null, hata: { kod: 'no_bos', mesaj: 'Öğrenci no boş.' } }
  const m = tamMetin(ham)
  if (m === null || !/^[0-9A-Za-zÇĞİÖŞÜçğıöşü._-]{1,20}$/.test(m)) {
    return { deger: null, hata: { kod: 'no_gecersiz', mesaj: `Öğrenci no geçersiz: "${goster(ham)}".` } }
  }
  return { deger: m, hata: null }
}

export function adDogrula(ham) {
  if (bos(ham)) return { deger: null, hata: { kod: 'ad_bos', mesaj: 'Ad Soyad boş.' } }
  const a = String(ham).replace(/\s+/g, ' ').trim()
  if (a.length > 100) return { deger: null, hata: { kod: 'ad_uzun', mesaj: 'Ad Soyad 100 karakterden uzun.' } }
  return { deger: a, hata: null }
}

export function kademeDogrula(ham, baglam = 'dosya') {
  if (bos(ham)) return { deger: null, hata: { kod: 'kademe_gecersiz', mesaj: 'Kademe boş.' } }
  const m = tamMetin(ham)
  if (m !== null && /^\d+$/.test(m)) {
    const n = Number(m)
    if (n >= 5 && n <= 8) return { deger: n, hata: null }
    return { deger: null, hata: { kod: 'kademe_gecersiz', mesaj: `Kademe 5 ile 8 arasında olmalı (bulunan: ${n}).` } }
  }
  if (m !== null && /^\d{1,2}\s*[-/.\s]\s*\p{L}$/u.test(m)) {
    return { deger: null, hata: { kod: 'kademe_birlesik', mesaj: MESAJLAR[baglam].kademeBirlesik(m) } }
  }
  return { deger: null, hata: { kod: 'kademe_gecersiz', mesaj: `Kademe bir sayı olmalı (bulunan: "${goster(ham)}").` } }
}

// kademe: doğrulanmış kademe (sayı) ya da null. "5-A" gibi birleşik girişte baştaki sayı kademeyle uyuşmalı.
export function subeDogrula(ham, kademe, baglam = 'dosya') {
  if (bos(ham)) return { deger: null, hata: { kod: 'sube_bos', mesaj: 'Şube boş.' } }
  const m = tamMetin(ham)
  const birlesik = m && m.match(/^(\d{1,2})\s*[-/.\s]\s*(\p{L})$/u)
  const tek = m && /^\p{L}$/u.test(m)
  if (birlesik) {
    if (kademe !== null && Number(birlesik[1]) !== kademe) {
      return {
        deger: null,
        hata: { kod: 'sube_kademe_uyusmaz', mesaj: MESAJLAR[baglam].kademeUyusmaz(birlesik[1], kademe) },
      }
    }
    return { deger: birlesik[2].toLocaleUpperCase('tr'), hata: null }
  }
  if (tek) return { deger: m.toLocaleUpperCase('tr'), hata: null }
  return { deger: null, hata: { kod: 'sube_gecersiz', mesaj: `Şube tek harf olmalı (bulunan: "${goster(ham)}").` } }
}

// Dört alanı birlikte doğrular. ham: { no, ad, kademe, sube }. Hatalar alan sırasıyla gelir.
// Dönen: { no, hatalar, deger } (deger: hata yoksa { student_no, full_name, grade, class_name }).
export function alanlariDogrula(ham, baglam = 'dosya') {
  const hatalar = []
  const topla = (sonuc) => {
    if (sonuc.hata) hatalar.push(sonuc.hata)
    return sonuc.deger
  }
  const no = topla(ogrenciNoDogrula(ham.no))
  const ad = topla(adDogrula(ham.ad))
  const kademe = topla(kademeDogrula(ham.kademe, baglam))
  const sube = topla(subeDogrula(ham.sube, kademe, baglam))
  return {
    no,
    hatalar,
    deger: hatalar.length ? null : { student_no: no, full_name: ad, grade: kademe, class_name: sube },
  }
}
