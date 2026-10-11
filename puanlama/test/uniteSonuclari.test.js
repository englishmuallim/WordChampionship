import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  uniteAdi,
  baslikMetni,
  sinifMetni,
  tamPuanMi,
  ogrenciSatirlari,
  sonuclariSirala,
  otomatikSutunSayisi,
  sutunlaraBol,
  satirOlculeri,
  fonksiyonYokMu,
  FONKSIYON_YOK_MESAJI,
} from '../src/lib/uniteSonuclari.js'

// wc_unit_results satırı (sahte veri; 20 soru × 5 puan)
const k = (id, ad, unit, dogru, extra = {}) => ({
  student_id: id,
  student_no: extra.no ?? id,
  full_name: ad,
  class_name: extra.sube ?? 'A',
  unit_no: unit,
  status: extra.status ?? 'girdi',
  correct_count: extra.status === 'kopya' ? 0 : dogru,
  question_count: 20,
  points_per_question: 5,
})
const adlar = (satirlar) => satirlar.map((s) => s.ad)

test('ünite adları: 1-10 kelime, ötesi İngilizce sıra eki', () => {
  assert.equal(uniteAdi(1), 'FIRST')
  assert.equal(uniteAdi(2), 'SECOND')
  assert.equal(uniteAdi(10), 'TENTH')
  assert.equal(uniteAdi(11), '11TH')
  assert.equal(uniteAdi(12), '12TH')
  assert.equal(uniteAdi(13), '13TH')
  assert.equal(uniteAdi(21), '21ST')
  assert.equal(uniteAdi(22), '22ND')
  assert.equal(uniteAdi(23), '23RD')
  assert.equal(uniteAdi(24), '24TH')
})

test('başlık: Türkçe büyük harfler doğrudan yazılı, YEAR kullanılır, GRADE/TERM/kopya yok', () => {
  const b = baslikMetni(5, 1)
  assert.equal(b.okul, 'BOYACI MAHMUT ZİYLAN İMAM-HATİP SECONDARY SCHOOL')
  assert.equal(b.yarisma, 'WORD CHAMPIONSHIP')
  assert.equal(b.sonuc, 'FIRST COMPETITION RESULTS OF YEAR 5')
  assert.equal(baslikMetni(8, 3).sonuc, 'THIRD COMPETITION RESULTS OF YEAR 8')
  const hepsi = Object.values(b).join(' ')
  assert.ok(!/GRADE|TERM|KOPYA/i.test(hepsi))
})

test('sınıf "5-C" biçiminde', () => {
  assert.equal(sinifMetni(5, 'C'), '5-C')
  assert.equal(sinifMetni(7, null), '7')
})

test('tam puan: tüm sorular doğru', () => {
  assert.equal(tamPuanMi(20, 20), true)
  assert.equal(tamPuanMi(19, 20), false)
  assert.equal(tamPuanMi(0, 0), false)
  // soru başı puan 4 × 25 soru = 100 de, 20 × 5 = 100 de tam puan; 100 puan olması şart değil
  assert.equal(tamPuanMi(25, 25), true)
})

test('girmedi, kayıtsız ve ünitede kaydı olmayan öğrenci listede yok', () => {
  const kayit = [
    k('1', 'Ali', 1, 10),
    k('2', 'Veli', 1, 0, { status: 'girmedi' }),
    k('3', 'Can', 2, 15), // 1. üniteyi hiç girmemiş (kaydı yok), 2'de girdi
  ]
  const s = ogrenciSatirlari(kayit, 1, 5)
  assert.deepEqual(adlar(s), ['Ali'])
})

test('kopya: 0 doğru, 0 puan ile listede; tam puan sayılmaz', () => {
  const s = ogrenciSatirlari([k('1', 'Ali', 1, 20, { status: 'kopya' })], 1, 5)
  assert.equal(s.length, 1)
  assert.equal(s[0].dogru, 0)
  assert.equal(s[0].puan, 0)
  assert.equal(s[0].tamPuan, false)
})

test('girdi: doğru, puan ve tam puan', () => {
  const s = ogrenciSatirlari([k('1', 'Ali', 1, 20), k('2', 'Veli', 1, 19)], 1, 5)
  const ali = s.find((x) => x.ad === 'Ali')
  const veli = s.find((x) => x.ad === 'Veli')
  assert.deepEqual([ali.dogru, ali.puan, ali.tamPuan, ali.sinif], [20, 100, true, '5-A'])
  assert.deepEqual([veli.dogru, veli.puan, veli.tamPuan], [19, 95, false])
})

test('toplam: seçilen ünite dahil ona kadarki üniteler; kopya toplama 0 katar', () => {
  const kayit = [
    k('1', 'Ali', 1, 10), // 50
    k('1', 'Ali', 2, 12), // 60
    k('1', 'Ali', 3, 20, { status: 'kopya' }), // 0
  ]
  assert.equal(ogrenciSatirlari(kayit, 2, 5)[0].toplam, 110)
  assert.equal(ogrenciSatirlari(kayit, 3, 5)[0].toplam, 110) // kopya 0 katar
  assert.equal(ogrenciSatirlari(kayit, 1, 5)[0].toplam, 50)
})

test('sonradan girilen ünite seçilen ünitenin toplamını değiştirmez', () => {
  const ilk = [k('1', 'Ali', 1, 10), k('1', 'Ali', 2, 12)]
  const sonra = [...ilk, k('1', 'Ali', 3, 20), k('1', 'Ali', 4, 20)]
  assert.deepEqual(ogrenciSatirlari(ilk, 2, 5), ogrenciSatirlari(sonra, 2, 5))
})

test('sıralama 1: ünite puanı yüksekten düşüğe', () => {
  const s = ogrenciSatirlari([k('1', 'Ali', 1, 10), k('2', 'Veli', 1, 15), k('3', 'Can', 1, 12)], 1, 5)
  assert.deepEqual(adlar(sonuclariSirala(s)), ['Veli', 'Can', 'Ali'])
})

test('sıralama 2: ünite puanı eşitse ona kadarki toplam belirler (düşük puan önceki ünitede geride kalmayı gösterir)', () => {
  const kayit = [
    k('1', 'Ali', 1, 20), // toplam 100 + 50 = 150
    k('1', 'Ali', 2, 10),
    k('2', 'Veli', 1, 5), // 25 + 50 = 75
    k('2', 'Veli', 2, 10),
    k('3', 'Can', 1, 20, { status: 'kopya' }), // 0 + 50 = 50
    k('3', 'Can', 2, 10),
  ]
  const s = ogrenciSatirlari(kayit, 2, 5)
  assert.deepEqual(adlar(sonuclariSirala(s)), ['Ali', 'Veli', 'Can'])
})

test('sıralama 3: puan ve toplam eşitse ad soyad Türkçe A-Z (Ç, Ğ, İ, I, Ö, Ş, Ü yerinde)', () => {
  const adSirasi = ['Cem', 'Çağla', 'Gül', 'Ğ. Kaan', 'Hakan', 'Irmak', 'İrem', 'Okan', 'Ömer', 'Selin', 'Şeyma', 'Ufuk', 'Ümit']
  const karisik = [...adSirasi].reverse()
  const s = ogrenciSatirlari(karisik.map((ad, i) => k(String(i), ad, 1, 10)), 1, 5)
  assert.deepEqual(adlar(sonuclariSirala(s)), adSirasi)
})

test('sıralama 4: her şey eşitse öğrenci no sayısal sırayla', () => {
  const s = ogrenciSatirlari(
    [k('a', 'Ali Kaya', 1, 10, { no: '100' }), k('b', 'Ali Kaya', 1, 10, { no: '9' }), k('c', 'Ali Kaya', 1, 10, { no: '25' })],
    1,
    5
  )
  assert.deepEqual(sonuclariSirala(s).map((x) => x.no), ['9', '25', '100'])
})

test('sıralama belirleyici: girdi sırası değişse de sonuç aynı; girdi dizisi bozulmaz', () => {
  const kayit = [k('1', 'Çağla', 1, 10), k('2', 'Cem', 1, 10), k('3', 'Ali', 1, 10), k('4', 'Zeynep', 1, 15)]
  const a = ogrenciSatirlari(kayit, 1, 5)
  const kopyaA = [...a]
  const b = ogrenciSatirlari([...kayit].reverse(), 1, 5)
  assert.deepEqual(adlar(sonuclariSirala(a)), adlar(sonuclariSirala(b)))
  assert.deepEqual(a, kopyaA)
})

test('sütun sayısı: ≤30 → 1, 31-70 → 2, ≥71 → 3', () => {
  assert.equal(otomatikSutunSayisi(0), 1)
  assert.equal(otomatikSutunSayisi(30), 1)
  assert.equal(otomatikSutunSayisi(31), 2)
  assert.equal(otomatikSutunSayisi(70), 2)
  assert.equal(otomatikSutunSayisi(71), 3)
  assert.equal(otomatikSutunSayisi(130), 3)
})

test('sütun bölme: sıra korunur, sol sütun önce dolar, uzunluk farkı en fazla 1', () => {
  const sira = Array.from({ length: 130 }, (_, i) => i)
  const s = sutunlaraBol(sira, 3)
  assert.deepEqual(s.map((c) => c.length), [44, 43, 43])
  assert.deepEqual(s.flat(), sira)
  assert.equal(s[0][0], 0)
  assert.equal(s[1][0], 44)
  assert.deepEqual(sutunlaraBol([1, 2, 3], 2), [[1, 2], [3]])
  assert.deepEqual(sutunlaraBol([1, 2], 3), [[1], [2], []]) // sütundan az öğrenci
  assert.deepEqual(sutunlaraBol([], 2), [[], []])
  assert.deepEqual(sutunlaraBol([1, 2, 3], 1), [[1, 2, 3]])
})

test('satır ölçüleri: çok satırda küçülür, az satırda 40 px ile sınırlı, en az 18 px', () => {
  assert.ok(satirOlculeri(44).satir < satirOlculeri(25).satir)
  assert.equal(satirOlculeri(3).satir, 40)
  assert.equal(satirOlculeri(500).satir, 18)
  assert.ok(Math.abs(satirOlculeri(25).yazi - satirOlculeri(25).satir * 0.58) < 1e-9)
})

test('fonksiyon veritabanında yoksa (PGRST202 / 42883) tanınır, diğer hatalar tanınmaz', () => {
  assert.equal(fonksiyonYokMu({ code: 'PGRST202' }), true)
  assert.equal(fonksiyonYokMu({ code: '42883' }), true)
  assert.equal(fonksiyonYokMu({ code: '42501' }), false)
  assert.equal(fonksiyonYokMu(null), false)
  assert.match(FONKSIYON_YOK_MESAJI, /wc_unit_results/)
})
