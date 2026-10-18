// CSV üretimi (saf fonksiyonlar). Türkçe Excel için: UTF-8 BOM, noktalı virgül ayırıcı, CRLF satır sonu.
// Metin hücreleri formül enjeksiyonuna karşı korunur; sayı sütunları (örn. -2) olduğu gibi yazılır.
import { donemBul } from './odev.js'

export const BOM = '﻿'
const AYIRAC = ';'
const SATIR_SONU = '\r\n'

// Excel/Sheets bir hücreyi formül sayar: = + - @ ile ya da sekme / satır başı karakteriyle başlıyorsa.
// Başına tek tırnak konarak metin olarak görünmesi sağlanır.
const FORMUL_BASLANGICI = /^[=+\-@\t\r]/

// Tek hücre. sayi=true: değer sonlu bir tam sayı olmalı (formül koruması uygulanmaz, geçersizse boş).
export function csvHucre(deger, { sayi = false } = {}) {
  if (deger === null || deger === undefined) return ''
  if (sayi) return Number.isInteger(deger) ? String(deger) : ''
  let metin = String(deger)
  if (FORMUL_BASLANGICI.test(metin)) metin = `'${metin}`
  if (/[;"\r\n]/.test(metin)) metin = `"${metin.replace(/"/g, '""')}"`
  return metin
}

// basliklar: [{ ad, sayi? }]  satirlar: [[değer, ...], ...]  (sütun sırası başlıklarla aynı)
// Sonuç BOM ile başlar, her satır CRLF ile biter.
export function csvOlustur(basliklar, satirlar) {
  const baslik = basliklar.map((b) => csvHucre(b.ad)).join(AYIRAC)
  const govde = satirlar.map((s) => basliklar.map((b, i) => csvHucre(s[i], { sayi: Boolean(b.sayi) })).join(AYIRAC))
  return BOM + [baslik, ...govde].join(SATIR_SONU) + SATIR_SONU
}

const DONEM_ADI = { tumu: 'Tümü', 1: '1. dönem', 2: '2. dönem' }
export const donemAdi = (donem) => DONEM_ADI[donem] ?? String(donem)

// 'YYYY-MM-DD' → 'GG.AA.YYYY' (Türkçe Excel tarih olarak tanır); geçersizse boş
export function tarihTr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

// Özet CSV: öğrenci başına artı, eksi, net. satirlar: ozetSatirlariniHazirla/ozetSirala çıktısı.
export function ozetCsv(satirlar, donem) {
  return csvOlustur(
    [
      { ad: 'Şube' },
      { ad: 'Öğrenci No' },
      { ad: 'Ad Soyad' },
      { ad: 'Artı', sayi: true },
      { ad: 'Eksi', sayi: true },
      { ad: 'Net', sayi: true },
      { ad: 'Dönem' },
      { ad: 'Tarihsiz kalem', sayi: true },
    ],
    satirlar.map((s) => [s.sube, s.student_no, s.full_name, s.arti, s.eksi, s.net, donemAdi(donem), s.tarihsiz])
  )
}

// Döküm CSV: her hareket bir satır. Puan işaretlidir (+1, -2); eksi puan sayı olarak yazılır.
export function dokumCsv(satirlar, donem) {
  const sonuc = []
  for (const s of satirlar) {
    for (const h of s.dokum) {
      sonuc.push([
        s.sube,
        s.student_no,
        s.full_name,
        h.odevUnite,
        tarihTr(h.tarih),
        h.turAdi,
        h.puan,
        h.tarihsiz ? 'tarihsiz' : donemAdi(donemBul(h.tarih)),
        h.aciklama,
      ])
    }
  }
  return csvOlustur(
    [
      { ad: 'Şube' },
      { ad: 'Öğrenci No' },
      { ad: 'Ad Soyad' },
      { ad: 'Ödev ünitesi', sayi: true },
      { ad: 'Tarih' },
      { ad: 'Tür' },
      { ad: 'Puan', sayi: true },
      { ad: 'Dönem' },
      { ad: 'Açıklama' },
    ],
    sonuc
  )
}

// Dosya adı (yalnızca ASCII): odev-ozeti-7-A-tumu.csv, odev-dokumu-7-tum-subeler-1-donem.csv
export function csvDosyaAdi(tur, kademe, sube, donem) {
  const subeParca = sube ? String(sube).replace(/[^A-Za-z0-9]/g, '') || 'sube' : 'tum-subeler'
  const donemParca = donem === 'tumu' ? 'tumu' : `${donem}-donem`
  return `odev-${tur === 'dokum' ? 'dokumu' : 'ozeti'}-${kademe}-${subeParca}-${donemParca}.csv`
}
