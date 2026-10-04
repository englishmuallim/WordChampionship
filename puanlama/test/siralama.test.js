import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sinavlariSirala,
  sinavBasligi,
  hucreMetni,
  tabloSatirlari,
  subeListesi,
  subeyeGoreSuz,
  duzenleSirala,
  gizliSatirVar,
  secimAnahtari,
  veriGuncelMi,
} from '../src/lib/siralama.js'

const sinavlar = [
  { id: 'e2', unit_no: 2, exam_date: '2026-11-20', question_count: 25, points_per_question: 4 },
  { id: 'e1', unit_no: 1, exam_date: null, question_count: 20, points_per_question: 5 },
]

// wc_ranking çıktısına benzer satır
const s = (id, no, ad, sube, extra = {}) => ({
  student_id: id,
  student_no: no,
  full_name: ad,
  grade: 5,
  class_name: sube,
  is_active: true,
  exams_taken: 0,
  total_points: 0,
  grade_rank: 1,
  class_rank: 1,
  kopya_sayisi: 0,
  ...extra,
})
const p = (sinav, ogr, status, dogru = null) => ({ exam_id: sinav, student_id: ogr, status, correct_count: dogru })
const hepsi = (...idler) => new Set(idler)

test('sınavlar ünite numarasına göre sıralanır, başlıkta tarih ve puan bilgisi var', () => {
  assert.deepEqual(sinavlariSirala(sinavlar).map((x) => x.unit_no), [1, 2])
  assert.deepEqual(sinavBasligi(sinavlar[0]), { kisa: 'Ü2', aciklama: '2. ünite · 20.11.2026 · 25 soru × 4 puan' })
  assert.equal(sinavBasligi(sinavlar[1]).aciklama, '1. ünite · 20 soru × 5 puan') // tarih yoksa yazılmaz
})

test('ünite hücreleri: puan, K, —, boş (kayıt yok) ve gizli', () => {
  const satirlar = [
    s('a', '1', 'A', 'A', { exams_taken: 1, total_points: 100, kopya_sayisi: 1 }),
    s('b', '2', 'B', 'A', { exams_taken: 0, total_points: 0, kopya_sayisi: 0 }),
  ]
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e2', 'a', 'kopya'), p('e1', 'b', 'girmedi')]
  const t = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a', 'b') })
  // sütunlar ünite sırasıyla: [Ü1, Ü2]
  assert.deepEqual(t[0].hucreler.map(hucreMetni), ['100', 'K'])
  assert.deepEqual(t[1].hucreler.map(hucreMetni), ['—', '']) // Ü1 girmedi, Ü2 kayıt yok
  assert.deepEqual(t[1].hucreler.map((h) => h.durum), ['girmedi', 'bos'])
})

test('puan = doğru sayısı × o sınavın soru başı puanı; 0 doğru bir puandır, boş değildir', () => {
  const satirlar = [s('a', '1', 'A', 'A', { exams_taken: 2, total_points: 25 * 4 * 0 + 20 * 5 })]
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e2', 'a', 'girdi', 0)]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.deepEqual(satir.hucreler.map(hucreMetni), ['100', '0'])
  assert.equal(satir.uyumsuz, null)
})

test('satır alanları ve eşit sıraların korunması', () => {
  const satirlar = [
    s('a', '1', 'ALİ', 'A', { grade_rank: 1, class_rank: 1, total_points: 100, exams_taken: 1 }),
    s('b', '2', 'VELİ', 'B', { grade_rank: 2, class_rank: 1, total_points: 80, exams_taken: 1 }),
    s('c', '3', 'CAN', 'A', { grade_rank: 2, class_rank: 2, total_points: 80, exams_taken: 1 }),
    s('d', '4', 'DİLEK', 'B', { grade_rank: 4, class_rank: 2, total_points: 60, exams_taken: 1 }),
  ]
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e1', 'b', 'girdi', 16), p('e1', 'c', 'girdi', 16), p('e1', 'd', 'girdi', 12)]
  const t = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a', 'b', 'c', 'd') })
  assert.deepEqual(t.map((x) => x.kademeSirasi), [1, 2, 2, 4]) // eşitler aynı sırayı paylaşır
  assert.deepEqual(t.map((x) => x.subeSirasi), [1, 1, 2, 2])
  assert.equal(t[0].ad, 'ALİ')
  assert.equal(t[0].sinavSayisi, 1)
  assert.equal(t[0].toplam, 100)
  assert.ok(t.every((x) => x.uyumsuz === null))
})

test('kopya sayısı satıra aktarılır; ayrılan öğrenci aktif=false olur', () => {
  const satirlar = [s('a', '1', 'A', 'A', { kopya_sayisi: 2, is_active: false })]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar: [], erisimli: hepsi('a') })
  assert.equal(satir.kopya, 2)
  assert.equal(satir.aktif, false)
})

test('tutarlılık: uyuşan satırda uyarı yok; toplam, sınav sayısı ya da kopya sayısı uyuşmazsa uyarı var', () => {
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e2', 'a', 'kopya')]
  const uyan = s('a', '1', 'A', 'A', { exams_taken: 1, total_points: 100, kopya_sayisi: 1 })
  assert.equal(tabloSatirlari({ satirlar: [uyan], sinavlar, puanlar, erisimli: hepsi('a') })[0].uyumsuz, null)

  for (const bozuk of [{ total_points: 95 }, { exams_taken: 2 }, { kopya_sayisi: 0 }]) {
    const [r] = tabloSatirlari({ satirlar: [{ ...uyan, ...bozuk }], sinavlar, puanlar, erisimli: hepsi('a') })
    assert.match(r.uyumsuz, /Ünite puanlarının toplamı 100/, JSON.stringify(bozuk))
  }
})

test('erişimi olmayan satırın ünite hücreleri gizlidir (boş) ve tutarlılık kontrolüne girmez', () => {
  // Öğretmen yalnızca "a"yı görebilir; "b" başka şubeden. Ham puan listesinde b yok.
  const satirlar = [
    s('a', '1', 'A', 'A', { exams_taken: 1, total_points: 100 }),
    s('b', '2', 'B', 'B', { exams_taken: 2, total_points: 150 }), // toplamı var ama ünite verisi yok
  ]
  const puanlar = [p('e1', 'a', 'girdi', 20)]
  const t = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.equal(t[0].erisimli, true)
  assert.equal(t[1].erisimli, false)
  assert.deepEqual(t[1].hucreler.map((h) => h.durum), ['gizli', 'gizli'])
  assert.deepEqual(t[1].hucreler.map(hucreMetni), ['', ''])
  assert.equal(t[1].uyumsuz, null) // veri eksik olduğu için yanlış uyarı verilmez
  assert.equal(t[1].toplam, 150) // toplam ve sıralar herkes için görünür
  assert.equal(gizliSatirVar(t), true)
  assert.equal(gizliSatirVar([t[0]]), false)
})

test('şube listesi, şube filtresi', () => {
  const satirlar = [s('a', '1', 'A', 'B'), s('b', '2', 'B', 'A'), s('c', '3', 'C', 'B'), s('d', '4', 'D', null)]
  assert.deepEqual(subeListesi(satirlar), ['A', 'B'])
  const t = tabloSatirlari({ satirlar, sinavlar: [], puanlar: [], erisimli: hepsi('a', 'b', 'c', 'd') })
  assert.deepEqual(subeyeGoreSuz(t, 'B').map((x) => x.ogrenciId), ['a', 'c'])
  assert.equal(subeyeGoreSuz(t, '').length, 4)
})

test('sıralama düzeni: kademe sırası ve şube içi sıra; Türkçe ad sıralaması', () => {
  const satirlar = [
    s('a', '1', 'ZEYNEP', 'A', { grade_rank: 3, class_rank: 1 }),
    s('b', '2', 'ALİ', 'B', { grade_rank: 1, class_rank: 1 }),
    s('c', '3', 'ÇAĞRI', 'B', { grade_rank: 2, class_rank: 2 }),
    s('d', '4', 'CAN', 'A', { grade_rank: 2, class_rank: 2 }),
  ]
  const t = tabloSatirlari({ satirlar, sinavlar: [], puanlar: [], erisimli: hepsi('a', 'b', 'c', 'd') })
  assert.deepEqual(duzenleSirala(t, 'kademe').map((x) => x.ogrenciId), ['b', 'd', 'c', 'a'])
  // kademe sırası eşitliğinde (2 ve 2) önce şube (A, B), sonra ad
  assert.deepEqual(duzenleSirala(t, 'sube').map((x) => x.ogrenciId), ['a', 'd', 'b', 'c'])
  // özgün dizi değişmez
  assert.deepEqual(t.map((x) => x.ogrenciId), ['a', 'b', 'c', 'd'])
})

test('hücre metni: durumlara göre', () => {
  assert.equal(hucreMetni({ durum: 'puan', puan: 0 }), '0')
  assert.equal(hucreMetni({ durum: 'puan', puan: 88 }), '88')
  assert.equal(hucreMetni({ durum: 'kopya' }), 'K')
  assert.equal(hucreMetni({ durum: 'girmedi' }), '—')
  assert.equal(hucreMetni({ durum: 'bos' }), '')
  assert.equal(hucreMetni({ durum: 'gizli' }), '')
})

// ---------- Girdiği sınav = girdi + kopya ----------
test('yalnızca kopyası olan öğrenci "1 sınav" görünür, toplamı 0, tutarlılık uyarısı yok', () => {
  const satirlar = [s('a', '1', 'RIFKI CAN', 'A', { exams_taken: 0, total_points: 0, kopya_sayisi: 1 })]
  const puanlar = [p('e1', 'a', 'kopya')]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.equal(satir.sinavSayisi, 1) // kopya sınava girmiş sayılır
  assert.equal(satir.girdiSayisi, 0)
  assert.equal(satir.kopya, 1)
  assert.equal(satir.toplam, 0)
  assert.equal(satir.uyumsuz, null)
  assert.deepEqual(satir.hucreler.map(hucreMetni), ['K', '']) // Ü1 kopya, Ü2 kayıt yok
})

test('hem girdi hem kopyası olan öğrenci: girdiği sınav ikisinin toplamı, puan yalnızca girdiden', () => {
  const satirlar = [s('a', '1', 'A', 'A', { exams_taken: 1, total_points: 100, kopya_sayisi: 1 })]
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e2', 'a', 'kopya')]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.equal(satir.sinavSayisi, 2) // 1 girdi + 1 kopya
  assert.equal(satir.girdiSayisi, 1)
  assert.equal(satir.kopya, 1)
  assert.equal(satir.toplam, 100) // kopya 0 puan, toplamı değiştirmez
  assert.equal(satir.uyumsuz, null)
})

test('girdi ve kopyası olmayan öğrenci (yalnızca girmedi / kayıt yok) 0 sınav görünür', () => {
  const satirlar = [s('a', '1', 'A', 'A')]
  const puanlar = [p('e1', 'a', 'girmedi')]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.equal(satir.sinavSayisi, 0)
  assert.equal(satir.uyumsuz, null)
})

test('tutarlılık: yeni tanımda da girdi ve kopya sayıları ayrı ayrı kontrol edilir (birbirini götüremez)', () => {
  // Ham veride 1 girdi + 1 kopya var; sıralama 2 girdi + 0 kopya diyor. Toplamları (2) aynı ama yanlış.
  const satirlar = [s('a', '1', 'A', 'A', { exams_taken: 2, total_points: 100, kopya_sayisi: 0 })]
  const puanlar = [p('e1', 'a', 'girdi', 20), p('e2', 'a', 'kopya')]
  const [satir] = tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli: hepsi('a') })
  assert.match(satir.uyumsuz, /1 girdi \+ 1 kopya/)
  assert.match(satir.uyumsuz, /2 girdi \+ 0 kopya/)
})

// ---------- Kademe değişince sahte uyarı çıkmaması ----------
test('NEDEN: eski kademenin satırları yeni kademenin sınavlarıyla birleştirilirse sahte uyumsuzluk üretilir', () => {
  // Bu test, hatanın kök nedenini belgeler: bu birleşim hiçbir zaman oluşturulmamalı.
  const eskiSatirlar = [s('r', '9003', 'RIFKI CAN', 'A', { grade: 7, exams_taken: 1, total_points: 80, kopya_sayisi: 1 })]
  const eskiSinavlar = [
    { id: 'k7-1', unit_no: 1, exam_date: null, question_count: 25, points_per_question: 4 },
    { id: 'k7-99', unit_no: 99, exam_date: null, question_count: 25, points_per_question: 4 },
  ]
  const eskiPuanlar = [p('k7-1', 'r', 'girdi', 20), p('k7-99', 'r', 'kopya')]
  const yeniSinavlar = [{ id: 'k8-1', unit_no: 1, exam_date: null, question_count: 25, points_per_question: 4 }]

  const tutarli = tabloSatirlari({ satirlar: eskiSatirlar, sinavlar: eskiSinavlar, puanlar: eskiPuanlar, erisimli: hepsi('r') })
  assert.equal(tutarli[0].uyumsuz, null)
  const karisik = tabloSatirlari({ satirlar: eskiSatirlar, sinavlar: yeniSinavlar, puanlar: eskiPuanlar, erisimli: hepsi('r') })
  assert.notEqual(karisik[0].uyumsuz, null)
})

test('veri yalnızca ait olduğu seçim için güncel sayılır (kademe ya da ayrılanlar değişince değil)', () => {
  const veri = { anahtar: secimAnahtari('7', false), sinavlar: [], satirlar: [], puanlar: [] }
  assert.equal(veriGuncelMi(veri, '7', false), true)
  assert.equal(veriGuncelMi(veri, '8', false), false) // kademe değişti: yeni veri gelene kadar tablo kurulmaz
  assert.equal(veriGuncelMi(veri, '7', true), false) // ayrılanlar değişti
  assert.equal(veriGuncelMi(null, '7', false), false) // henüz veri yok / hata
  assert.equal(secimAnahtari(7, false), secimAnahtari('7', false)) // sayı ya da metin kademe aynı anahtar
})
