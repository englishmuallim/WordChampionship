import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  numaraSirala,
  kayittanSatir,
  degerCoz,
  satirDegerlendir,
  kaydedilecekler,
  ozetHesapla,
  yapistirmaCoz,
  yapistirmaEtkisi,
  yapistirmaUygula,
  EN_FAZLA_SUTUN_HATASI,
} from '../src/lib/puanGirisi.js'

const SORU = 25
const ogr = (id, no, ad = `ÖĞRENCİ ${no}`) => ({ id, student_no: no, full_name: ad })
const liste = [ogr('a', '9001'), ogr('b', '9002'), ogr('c', '9003'), ogr('d', '90006')]

test('numaralar sayısal sıralanır', () => {
  const sirali = numaraSirala([ogr('1', '100'), ogr('2', '9'), ogr('3', '10')]).map((o) => o.student_no)
  assert.deepEqual(sirali, ['9', '10', '100'])
})

test('kayıttan ekran satırı', () => {
  assert.deepEqual(kayittanSatir(undefined), { deger: '', isaret: '' })
  assert.deepEqual(kayittanSatir({ status: 'girdi', correct_count: 0 }), { deger: '0', isaret: '' })
  assert.deepEqual(kayittanSatir({ status: 'girmedi', correct_count: null }), { deger: '', isaret: 'girmedi' })
})

test('değer yorumlama: sayı, G, boş, aralık dışı, biçim hatası', () => {
  assert.deepEqual(degerCoz('23', SORU), { tur: 'sayi', n: 23 })
  assert.deepEqual(degerCoz('0', SORU), { tur: 'sayi', n: 0 })
  assert.deepEqual(degerCoz('25', SORU), { tur: 'sayi', n: 25 })
  assert.equal(degerCoz('26', SORU).neden, 'aralik')
  assert.equal(degerCoz('abc', SORU).neden, 'bicim')
  assert.equal(degerCoz('2.5', SORU).neden, 'bicim')
  assert.equal(degerCoz('-3', SORU).neden, 'bicim')
  for (const g of ['G', 'g', 'girmedi', 'GİRMEDİ', ' Girmedi ']) assert.equal(degerCoz(g, SORU).tur, 'girmedi', g)
  for (const b of ['', '   ', null, undefined]) assert.equal(degerCoz(b, SORU).tur, 'bos')
})

test('satır değerlendirme: yeni giriş, aynı değer, değişen değer', () => {
  assert.deepEqual(satirDegerlendir({ deger: '20', isaret: '' }, undefined, SORU), {
    durum: 'girdi', dogru: 20, degisti: true, korunur: false,
  })
  const kayit = { status: 'girdi', correct_count: 20 }
  assert.equal(satirDegerlendir({ deger: '20', isaret: '' }, kayit, SORU).degisti, false)
  assert.equal(satirDegerlendir({ deger: '021', isaret: '' }, kayit, SORU).degisti, true)
  assert.equal(satirDegerlendir({ deger: '021', isaret: '' }, { status: 'girdi', correct_count: 21 }, SORU).degisti, false)
})

test('boş kutu ile "girmedi" farklıdır; kayıtlı puan silinemez, korunur', () => {
  const bos = satirDegerlendir({ deger: '', isaret: '' }, undefined, SORU)
  assert.deepEqual(bos, { durum: 'bos', degisti: false, korunur: false })
  const silinmek = satirDegerlendir({ deger: '', isaret: '' }, { status: 'girdi', correct_count: 10 }, SORU)
  assert.deepEqual(silinmek, { durum: 'bos', degisti: false, korunur: true })
  const girmedi = satirDegerlendir({ deger: '', isaret: 'girmedi' }, undefined, SORU)
  assert.deepEqual(girmedi, { durum: 'girmedi', degisti: true, korunur: false })
  const zatenGirmedi = satirDegerlendir({ deger: '', isaret: 'girmedi' }, { status: 'girmedi', correct_count: null }, SORU)
  assert.equal(zatenGirmedi.degisti, false)
  // girdi -> girmedi bir değişikliktir
  assert.equal(satirDegerlendir({ deger: '', isaret: 'girmedi' }, { status: 'girdi', correct_count: 5 }, SORU).degisti, true)
})

test('geçersiz değer kaydı engelleyen bir değişiklik sayılır', () => {
  const d = satirDegerlendir({ deger: '26', isaret: '' }, undefined, SORU)
  assert.equal(d.durum, 'gecersiz')
  assert.equal(d.degisti, true)
  assert.match(d.hata, /0 ile 25/)
})

test('kaydedilecekler yalnızca değişen ve geçerli satırları, doğru biçimde üretir', () => {
  const kayitlar = new Map([
    ['a', { status: 'girdi', correct_count: 20 }], // değişmeyecek
    ['b', { status: 'girdi', correct_count: 10 }], // girmedi'ye çevrilecek
    ['c', { status: 'girdi', correct_count: 15 }], // kutu boşaltıldı -> korunur
  ])
  const satirlar = {
    a: { deger: '20', isaret: '' },
    b: { deger: '', isaret: 'girmedi' },
    c: { deger: '', isaret: '' },
    d: { deger: '7', isaret: '' }, // yeni
  }
  const deg = liste.map((o) => ({ ogrenci: o, d: satirDegerlendir(satirlar[o.id], kayitlar.get(o.id), SORU) }))
  const k = kaydedilecekler(deg, 'sinav-1')
  assert.deepEqual(k.yazilacak, [
    { exam_id: 'sinav-1', student_id: 'b', status: 'girmedi', correct_count: null },
    { exam_id: 'sinav-1', student_id: 'd', status: 'girdi', correct_count: 7 },
  ])
  assert.equal(k.korunan, 1)
  assert.equal(k.gecersiz, 0)
})

test('özet: girildi/girmedi/boş sayıları ve girenlerin ortalaması', () => {
  const satirlar = {
    a: { deger: '20', isaret: '' }, // 80
    b: { deger: '10', isaret: '' }, // 40
    c: { deger: '', isaret: 'girmedi' },
    d: { deger: '', isaret: '' },
  }
  const deg = liste.map((o) => ({ ogrenci: o, d: satirDegerlendir(satirlar[o.id], undefined, SORU) }))
  const o = ozetHesapla(deg, 4)
  assert.deepEqual([o.toplam, o.girdi, o.girmedi, o.bos, o.gecersiz], [4, 2, 1, 1, 0])
  assert.equal(o.ortalama, 60)
  assert.equal(ozetHesapla([], 4).ortalama, null)
})

test('yapıştırma biçim 1: tek sütun, liste sırasıyla; boş atlanır, G girmedi olur', () => {
  const s = yapistirmaCoz('20\r\n\r\nG\n15\n', liste, SORU)
  assert.equal(s.bicim, 1)
  assert.deepEqual(s.uygulanacak, [
    { ogrenciId: 'a', deger: '20', isaret: '' },
    { ogrenciId: 'c', deger: '', isaret: 'girmedi' },
    { ogrenciId: 'd', deger: '15', isaret: '' },
  ])
  assert.deepEqual(s.uyarilar, [])
})

test('yapıştırma biçim 1: fazla/eksik değer ve geçersiz değer uyarıları', () => {
  const eksik = yapistirmaCoz('20\n21', liste, SORU)
  assert.match(eksik.uyarilar[0], /son 2 öğrenciye dokunulmadı/)
  const fazla = yapistirmaCoz('1\n2\n3\n4\n5', liste, SORU)
  assert.match(fazla.uyarilar[0], /fazla 1 değer uygulanmadı/)
  const hatali = yapistirmaCoz('20\n99\nabc\n5', liste, SORU)
  assert.equal(hatali.uygulanacak.length, 2)
  assert.equal(hatali.uyarilar.length, 2)
  assert.match(hatali.uyarilar[0], /Satır 2/)
  assert.match(hatali.uyarilar[1], /Satır 3/)
})

test('yapıştırma biçim 2: numaraya göre eşleşir; eşleşmeyen ve tekrar eden uyarı verir', () => {
  const metin = ['9003\t12', '9001\tG', '55555\t10', '9002\t7', '9002\t8', '90006\t'].join('\n')
  const s = yapistirmaCoz(metin, liste, SORU)
  assert.equal(s.bicim, 2)
  assert.deepEqual(
    s.uygulanacak.map((u) => [u.ogrenciId, u.deger, u.isaret]),
    [['c', '12', ''], ['a', '', 'girmedi']]
  )
  assert.equal(s.uyarilar.length, 2)
  assert.ok(s.uyarilar.some((u) => /55555 numaralı öğrenci bu şubede yok/.test(u)))
  assert.ok(s.uyarilar.some((u) => /9002 numarası birden fazla/.test(u)))
})

test('yapıştırma: başlık satırı atlanır; ondalıklı numara (9001.0) eşleşir', () => {
  const b1 = yapistirmaCoz('Doğru\n20\n21', liste, SORU)
  assert.equal(b1.baslikAtlandi, true)
  assert.deepEqual(b1.uygulanacak.map((u) => u.deger), ['20', '21'])

  const b2 = yapistirmaCoz('Öğrenci No\tDoğru\n9001.0\t20', liste, SORU)
  assert.equal(b2.baslikAtlandi, true)
  assert.deepEqual(b2.uygulanacak, [{ ogrenciId: 'a', deger: '20', isaret: '' }])
})

test('yapıştırma etkisi ve uygulama: yalnızca dolu kutuları değiştirmeyi sayar, kaydetmez', () => {
  const satirlar = {
    a: { deger: '20', isaret: '' },
    b: { deger: '', isaret: '' },
    c: { deger: '5', isaret: '' },
  }
  const uygulanacak = [
    { ogrenciId: 'a', deger: '20', isaret: '' }, // aynı
    { ogrenciId: 'b', deger: '9', isaret: '' }, // boştu
    { ogrenciId: 'c', deger: '', isaret: 'girmedi' }, // dolu -> girmedi
  ]
  assert.equal(yapistirmaEtkisi(uygulanacak, satirlar), 1)
  const yeni = yapistirmaUygula(satirlar, uygulanacak)
  assert.deepEqual(yeni.b, { deger: '9', isaret: '' })
  assert.deepEqual(yeni.c, { deger: '', isaret: 'girmedi' })
  assert.deepEqual(satirlar.b, { deger: '', isaret: '' }) // özgün nesne değişmez
})

// ---------- Biçim 3: Öğrenci No | Ad Soyad | Doğru sayısı ----------
const liste3 = [
  ogr('a', '9001', 'ÇAĞRI ŞENOL'),
  ogr('b', '9002', 'İLKAY ÖZDEMİR'),
  ogr('c', '9003', 'ALİ CAN'),
  ogr('d', '90006', 'IŞIL ÜNAL'),
]

test('biçim 3: temel kullanım, numaraya göre eşleşir, isim uyuşuyorsa uyarı yok', () => {
  const metin = '9001\tÇAĞRI ŞENOL\t20\n9003\tALİ CAN\tG\n90006\tIŞIL ÜNAL\t15\n'
  const s = yapistirmaCoz(metin, liste3, SORU)
  assert.equal(s.bicim, 3)
  assert.equal(s.hata, '')
  assert.deepEqual(s.uygulanacak, [
    { ogrenciId: 'a', deger: '20', isaret: '' },
    { ogrenciId: 'c', deger: '', isaret: 'girmedi' },
    { ogrenciId: 'd', deger: '15', isaret: '' },
  ])
  assert.deepEqual(s.uyarilar, [])
  assert.equal(s.isimFarki, 0)
})

test('biçim 3: büyük/küçük harf, Türkçe karakter ve fazla boşluk farkı isim uyarısı VERMEZ', () => {
  const metin = [
    '9001\tcagri senol\t1', // Türkçe karakter yok
    '9002\t  ilkay   özdemir \t2', // küçük harf + fazla boşluk
    '9003\tALI CAN\t3', // İ -> I
    '90006\tisil unal\t4', // Işıl -> isil
  ].join('\n')
  const s = yapistirmaCoz(metin, liste3, SORU)
  assert.equal(s.isimFarki, 0)
  assert.deepEqual(s.uyarilar, [])
  assert.equal(s.uygulanacak.length, 4)
})

test('biçim 3: gerçekten farklı ad uyarı verir ama satır yine uygulanır', () => {
  const s = yapistirmaCoz('9001\tAHMET YILMAZ\t20\n9002\tİLKAY ÖZDEMİR\t10', liste3, SORU)
  assert.equal(s.isimFarki, 1)
  assert.equal(s.uyarilar.length, 1)
  assert.match(s.uyarilar[0], /Satır 1: İsim farkı/)
  assert.match(s.uyarilar[0], /Kayıtlı ad: "ÇAĞRI ŞENOL"/)
  assert.match(s.uyarilar[0], /yapıştırılan ad: "AHMET YILMAZ"/)
  assert.deepEqual(
    s.uygulanacak.map((u) => [u.ogrenciId, u.deger]),
    [['a', '20'], ['b', '10']]
  )
})

test('biçim 3: eşleşme yalnızca numaraya göredir (isim başka öğrenciye benzese de)', () => {
  // Ad "ALİ CAN" ama numara 9001 (ÇAĞRI ŞENOL'a ait): numaraya göre ÇAĞRI'ya uygulanır
  const s = yapistirmaCoz('9001\tALİ CAN\t7', liste3, SORU)
  assert.deepEqual(s.uygulanacak, [{ ogrenciId: 'a', deger: '7', isaret: '' }])
  assert.equal(s.isimFarki, 1)
})

test('biçim 3: eşleşmeyen ve tekrar eden numara, biçim 2 ile aynı davranır', () => {
  const metin = ['55555\tX Y\t10', '9002\tİLKAY ÖZDEMİR\t7', '9002\tİLKAY ÖZDEMİR\t8', '9003\tALİ CAN\t12'].join('\n')
  const s = yapistirmaCoz(metin, liste3, SORU)
  assert.deepEqual(s.uygulanacak, [{ ogrenciId: 'c', deger: '12', isaret: '' }])
  assert.equal(s.uyarilar.length, 2)
  assert.ok(s.uyarilar.some((u) => /55555 numaralı öğrenci bu şubede yok/.test(u)))
  assert.ok(s.uyarilar.some((u) => /9002 numarası birden fazla/.test(u)))
  assert.equal(s.isimFarki, 0) // eşleşmeyen/tekrarlarda isim karşılaştırması yapılmaz
})

test('biçim 3: G/g/girmedi uygulanır, boş değer dokunmaz, aralık dışı hata verir', () => {
  const metin = [
    '9001\tÇAĞRI ŞENOL\tg',
    '9002\tİLKAY ÖZDEMİR\t', // boş: dokunma
    '9003\tALİ CAN\t26', // aralık dışı
    '90006\tIŞIL ÜNAL\tgirmedi',
  ].join('\n')
  const s = yapistirmaCoz(metin, liste3, SORU)
  assert.deepEqual(
    s.uygulanacak.map((u) => [u.ogrenciId, u.isaret]),
    [['a', 'girmedi'], ['d', 'girmedi']]
  )
  assert.equal(s.uyarilar.length, 1)
  assert.match(s.uyarilar[0], /Satır 3 \(ALİ CAN\).*0-25/)
})

test('biçim 3: dördüncü sütun varsa açık hata verilir ve hiçbir şey uygulanmaz', () => {
  const s = yapistirmaCoz('9001\tÇAĞRI ŞENOL\t20\tfazla\n9002\tİLKAY ÖZDEMİR\t10\tfazla', liste3, SORU)
  assert.equal(s.hata, EN_FAZLA_SUTUN_HATASI)
  assert.equal(s.hata, 'En fazla 3 sütun: No, Ad Soyad, Doğru sayısı')
  assert.equal(s.bicim, null)
  assert.deepEqual(s.uygulanacak, [])
  // tek bir satırda bile 4 sütun varsa tümü reddedilir
  const tekSatir = yapistirmaCoz('9001\tÇAĞRI ŞENOL\t20\n9002\ta\tb\tc\td', liste3, SORU)
  assert.equal(tekSatir.hata, EN_FAZLA_SUTUN_HATASI)
  assert.deepEqual(tekSatir.uygulanacak, [])
})

test('başlık satırı üç biçimde de atlanır', () => {
  const b3 = yapistirmaCoz('Öğrenci No\tAd Soyad\tDoğru Sayısı\n9001\tÇAĞRI ŞENOL\t20', liste3, SORU)
  assert.equal(b3.bicim, 3)
  assert.equal(b3.baslikAtlandi, true)
  assert.deepEqual(b3.uygulanacak, [{ ogrenciId: 'a', deger: '20', isaret: '' }])
  assert.deepEqual(b3.uyarilar, [])

  const b2 = yapistirmaCoz('Öğrenci No\tDoğru\n9001\t20', liste3, SORU)
  assert.equal(b2.baslikAtlandi, true)
  assert.deepEqual(b2.uygulanacak, [{ ogrenciId: 'a', deger: '20', isaret: '' }])

  const b1 = yapistirmaCoz('Doğru Sayısı\n20\n15', liste3, SORU)
  assert.equal(b1.baslikAtlandi, true)
  assert.deepEqual(b1.uygulanacak.map((u) => u.deger), ['20', '15'])

  // büyük harf ve Türkçe karakter farkı başlıkta da yok sayılır
  const buyuk = yapistirmaCoz('ÖĞRENCİ NO\tAD SOYAD\tDOĞRU\n9002\tİLKAY ÖZDEMİR\t5', liste3, SORU)
  assert.equal(buyuk.baslikAtlandi, true)
  assert.equal(buyuk.uygulanacak.length, 1)
})

test('biçim 3: eksik sütunlu satır uyarı alır', () => {
  const s = yapistirmaCoz('9001\tÇAĞRI ŞENOL\t20\n9002\tİLKAY ÖZDEMİR', liste3, SORU)
  assert.equal(s.bicim, 3)
  assert.equal(s.uygulanacak.length, 1)
  assert.match(s.uyarilar[0], /Satır 2: üç sütun/)
})

// ---------- Kopya durumu ----------
test('K, k ve "kopya" değeri kopya olarak yorumlanır (G ve sayıdan ayrı)', () => {
  for (const v of ['K', 'k', 'kopya', 'KOPYA', ' Kopya ']) assert.equal(degerCoz(v, SORU).tur, 'kopya', v)
  assert.equal(degerCoz('G', SORU).tur, 'girmedi')
  assert.equal(degerCoz('0', SORU).tur, 'sayi') // "0 girdi" ile kopya ayrı şeylerdir
  assert.equal(degerCoz('kopyaa', SORU).tur, 'gecersiz')
})

test('kayıttan kopya satırı kurulur; kopya kaydı kutuyu temizler', () => {
  assert.deepEqual(kayittanSatir({ status: 'kopya', correct_count: null }), { deger: '', isaret: 'kopya' })
})

test('kopya satırı değerlendirme: yeni kopya değişikliktir, aynı kopya değişiklik değildir', () => {
  const kopya = { deger: '', isaret: 'kopya' }
  assert.deepEqual(satirDegerlendir(kopya, undefined, SORU), { durum: 'kopya', degisti: true, korunur: false })
  assert.equal(satirDegerlendir(kopya, { status: 'kopya', correct_count: null }, SORU).degisti, false)
  // girdi/girmedi -> kopya ve kopya -> girmedi birer değişikliktir
  assert.equal(satirDegerlendir(kopya, { status: 'girdi', correct_count: 12 }, SORU).degisti, true)
  assert.equal(satirDegerlendir(kopya, { status: 'girmedi', correct_count: null }, SORU).degisti, true)
  assert.equal(
    satirDegerlendir({ deger: '', isaret: 'girmedi' }, { status: 'kopya', correct_count: null }, SORU).degisti,
    true
  )
})

test('kopya ve girmedi karşılıklı dışlar: işaret tek alan olduğundan ikisi birden olamaz', () => {
  // Yapıştırma, kopya satırını girmedi yaptığında ya da tersinde eski işaret kalmaz
  const baslangic = {
    a: { deger: '', isaret: 'kopya' },
    b: { deger: '', isaret: 'girmedi' },
    c: { deger: '10', isaret: '' },
  }
  const yeni = yapistirmaUygula(baslangic, [
    { ogrenciId: 'a', deger: '', isaret: 'girmedi' },
    { ogrenciId: 'b', deger: '', isaret: 'kopya' },
    { ogrenciId: 'c', deger: '', isaret: 'kopya' },
  ])
  assert.deepEqual(yeni, {
    a: { deger: '', isaret: 'girmedi' },
    b: { deger: '', isaret: 'kopya' },
    c: { deger: '', isaret: 'kopya' }, // sayı da temizlenir
  })
  for (const s of Object.values(yeni)) assert.deepEqual(Object.keys(s).sort(), ['deger', 'isaret'])
})

test('kaydedilecek kopya satırı: status "kopya", correct_count boş (null)', () => {
  const kayitlar = new Map([['b', { status: 'kopya', correct_count: null }]]) // zaten kopya: yazılmaz
  const satirlar = {
    a: { deger: '', isaret: 'kopya' },
    b: { deger: '', isaret: 'kopya' },
    c: { deger: '', isaret: 'girmedi' },
    d: { deger: '4', isaret: '' },
  }
  const deg = liste.map((o) => ({ ogrenci: o, d: satirDegerlendir(satirlar[o.id], kayitlar.get(o.id), SORU) }))
  assert.deepEqual(kaydedilecekler(deg, 'sinav-1').yazilacak, [
    { exam_id: 'sinav-1', student_id: 'a', status: 'kopya', correct_count: null },
    { exam_id: 'sinav-1', student_id: 'c', status: 'girmedi', correct_count: null },
    { exam_id: 'sinav-1', student_id: 'd', status: 'girdi', correct_count: 4 },
  ])
})

test('özet: kopya ayrı sayılır ve ortalamaya katılmaz', () => {
  const satirlar = {
    a: { deger: '20', isaret: '' }, // 80
    b: { deger: '10', isaret: '' }, // 40
    c: { deger: '', isaret: 'kopya' },
    d: { deger: '', isaret: 'girmedi' },
  }
  const deg = liste.map((o) => ({ ogrenci: o, d: satirDegerlendir(satirlar[o.id], undefined, SORU) }))
  const o = ozetHesapla(deg, 4)
  assert.deepEqual([o.toplam, o.girdi, o.girmedi, o.kopya, o.bos, o.gecersiz], [4, 2, 1, 1, 0, 0])
  assert.equal(o.ortalama, 60) // (80 + 40) / 2, kopya 0'ı katılmadı
  // yalnızca kopya varsa ortalama yoktur
  const sadeceKopya = ozetHesapla(
    [{ ogrenci: liste[0], d: satirDegerlendir({ deger: '', isaret: 'kopya' }, undefined, SORU) }],
    4
  )
  assert.equal(sadeceKopya.kopya, 1)
  assert.equal(sadeceKopya.ortalama, null)
})

test('yapıştırma biçim 1: K, k ve kopya kopya olarak uygulanır', () => {
  const s = yapistirmaCoz('K\n20\nk\nKopya', liste, SORU)
  assert.equal(s.bicim, 1)
  assert.deepEqual(s.uygulanacak, [
    { ogrenciId: 'a', deger: '', isaret: 'kopya' },
    { ogrenciId: 'b', deger: '20', isaret: '' },
    { ogrenciId: 'c', deger: '', isaret: 'kopya' },
    { ogrenciId: 'd', deger: '', isaret: 'kopya' },
  ])
  assert.deepEqual(s.uyarilar, [])
})

test('yapıştırma biçim 2: K ve kopya numaraya göre uygulanır, G ile karışmaz', () => {
  const s = yapistirmaCoz('9003\tK\n9001\tkopya\n9002\tG\n90006\t15', liste, SORU)
  assert.equal(s.bicim, 2)
  assert.deepEqual(
    s.uygulanacak.map((u) => [u.ogrenciId, u.isaret, u.deger]),
    [['c', 'kopya', ''], ['a', 'kopya', ''], ['b', 'girmedi', ''], ['d', '', '15']]
  )
})

test('yapıştırma biçim 3: K ve kopya kabul edilir; isim farkı kuralı değişmez', () => {
  const s = yapistirmaCoz(
    ['9001\tÇAĞRI ŞENOL\tK', '9002\tİLKAY ÖZDEMİR\tkopya', '9003\tYANLIŞ AD\tG'].join('\n'),
    liste3,
    SORU
  )
  assert.equal(s.bicim, 3)
  assert.deepEqual(
    s.uygulanacak.map((u) => [u.ogrenciId, u.isaret]),
    [['a', 'kopya'], ['b', 'kopya'], ['c', 'girmedi']]
  )
  assert.equal(s.isimFarki, 1)
})

test('yapıştırma: kopya olarak yapıştırılan satır dolu kutuyu değiştirecekse etki sayılır', () => {
  const satirlar = { a: { deger: '20', isaret: '' }, b: { deger: '', isaret: 'kopya' } }
  const uygulanacak = [
    { ogrenciId: 'a', deger: '', isaret: 'kopya' }, // dolu -> kopya: sayılır
    { ogrenciId: 'b', deger: '', isaret: 'kopya' }, // zaten kopya: değişmez
  ]
  assert.equal(yapistirmaEtkisi(uygulanacak, satirlar), 1)
})
