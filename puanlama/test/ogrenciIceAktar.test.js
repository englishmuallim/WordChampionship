import { test } from 'node:test'
import assert from 'node:assert/strict'
import { satirlariAyir, satirDogrula, planOlustur, hataOzeti, yazilacakSatirlar } from '../src/lib/ogrenciIceAktar.js'
import { csvSatirlari } from '../src/lib/dosyaOku.js'

const kodlar = (d) => d.hatalar.map((h) => h.kod)
const ham = (no, ad, kademe, sube) => ({ satir: 2, no, ad, kademe, sube })

test('başlıklar Türkçe karakter ve büyük/küçük harf farkına dayanıklı', () => {
  for (const baslik of [
    ['Öğrenci No', 'Ad Soyad', 'Kademe', 'Şube'],
    ['ogrenci no', 'ad soyad', 'kademe', 'sube'],
    ['ÖĞRENCİ NO', 'AD SOYAD', 'KADEME', 'ŞUBE'],
    ['Öğrenci Numarası', 'Adı Soyadı', 'Kademe', 'Şube'],
  ]) {
    const sonuc = satirlariAyir([baslik, [1, 'ALİ CAN', 5, 'A']])
    assert.equal(sonuc.hata, undefined, baslik.join('|'))
    assert.equal(sonuc.ham.length, 1)
  }
})

test('eksik başlık açık hata verir; ek sütunlar (Şifre vb.) okunmaz', () => {
  const eksik = satirlariAyir([['Öğrenci No', 'Ad Soyad', 'Kademe'], [1, 'A', 5]])
  assert.match(eksik.hata, /Şube/)

  const fazla = satirlariAyir([
    ['Öğrenci No', 'Ad Soyad', 'Kademe', 'Şube', 'Şifre', 'Telefon', 'Email'],
    [996, 'YAĞIZ CAN', 5, 'B', '123', '9891234567', 'my@mail.com'],
  ])
  assert.deepEqual(Object.keys(fazla.ham[0]).sort(), ['ad', 'kademe', 'no', 'satir', 'sube'])
  assert.ok(!JSON.stringify(fazla).includes('123'))
  assert.ok(!JSON.stringify(fazla).includes('my@mail.com'))
})

test('tamamen boş satırlar atlanır, başlık ilk satır olmak zorunda değil', () => {
  const sonuc = satirlariAyir([
    ['Liste'],
    ['Öğrenci No', 'Ad Soyad', 'Kademe', 'Şube'],
    [1, 'A', 5, 'A'],
    [null, '', null, '  '],
    [2, 'B', 5, 'A'],
  ])
  assert.equal(sonuc.ham.length, 2)
})

test('geçerli satır: sayı hücreleri metne çevrilir, ad boşlukları sadeleşir', () => {
  const d = satirDogrula(ham(9001, '  ALİ   CAN ', 5, 'A'))
  assert.deepEqual(d.deger, { student_no: '9001', full_name: 'ALİ CAN', grade: 5, class_name: 'A' })
})

test('şube yalnızca harfe indirilir (5-A, 5/A, 5 A, küçük harf)', () => {
  for (const s of ['5-A', '5/A', '5 A', '5.A', 'a', ' A ']) {
    const d = satirDogrula(ham(1, 'X', 5, s))
    assert.equal(d.deger?.class_name, 'A', s)
  }
  assert.equal(satirDogrula(ham(1, 'X', 5, 'i')).deger.class_name, 'İ') // Türkçe büyük harf
})

test('şube–kademe uyuşmazlığı, boş şube ve çok harfli şube hatadır', () => {
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 6, '5-A'))), ['sube_kademe_uyusmaz'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 5, ''))), ['sube_bos'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 5, 'AB'))), ['sube_gecersiz'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 5, 7))), ['sube_gecersiz'])
})

test('kademe 5-8 dışı, birleşik ya da sayı olmayan değer hatadır', () => {
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 9, 'A'))), ['kademe_gecersiz'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 4, 'A'))), ['kademe_gecersiz'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', '5-A', 'A'))), ['kademe_birlesik'])
  assert.deepEqual(kodlar(satirDogrula(ham(1, 'X', 'beş', 'A'))), ['kademe_gecersiz'])
  assert.equal(satirDogrula(ham(1, 'X', '7', 'A')).deger.grade, 7)
})

test('boş ad, boş/ondalıklı/karakterli öğrenci no hatadır', () => {
  assert.deepEqual(kodlar(satirDogrula(ham(1, '', 5, 'A'))), ['ad_bos'])
  assert.deepEqual(kodlar(satirDogrula(ham('', 'X', 5, 'A'))), ['no_bos'])
  assert.deepEqual(kodlar(satirDogrula(ham(12.5, 'X', 5, 'A'))), ['no_gecersiz'])
  assert.deepEqual(kodlar(satirDogrula(ham('12 34', 'X', 5, 'A'))), ['no_gecersiz'])
})

const mevcut = [
  { student_no: '9001', full_name: 'ALİ CAN', grade: 5, class_name: 'A', is_active: true },
  { student_no: '9002', full_name: 'VELİ CAN', grade: 5, class_name: 'B', is_active: true },
  { student_no: '9003', full_name: 'PASİF CAN', grade: 6, class_name: 'A', is_active: false },
  { student_no: '9099', full_name: 'DOSYADA YOK', grade: 7, class_name: 'C', is_active: true },
]

test('plan: yeni / güncellenecek / değişiklik yok / hatalı ayrımı', () => {
  const plan = planOlustur(
    [
      { satir: 2, no: 9001, ad: 'ALİ CAN', kademe: 5, sube: 'A' }, // aynı
      { satir: 3, no: 9002, ad: 'VELİ CAN', kademe: 6, sube: 'C' }, // kademe + şube değişti
      { satir: 4, no: 9010, ad: 'YENİ CAN', kademe: 7, sube: 'A' }, // yeni
      { satir: 5, no: 9011, ad: '', kademe: 7, sube: 'A' }, // hatalı
    ],
    mevcut
  )
  assert.deepEqual(
    plan.satirlar.map((s) => s.durum),
    ['ayni', 'guncellenecek', 'yeni', 'hatali']
  )
  const g = plan.satirlar[1]
  assert.deepEqual(
    g.farklar.map((f) => [f.etiket, f.eski, f.yeni]),
    [
      ['Kademe', '5', '6'],
      ['Şube', 'B', 'C'],
    ]
  )
  assert.equal(g.kademeDegisti, true)
  assert.equal(plan.sayilar.kademeDegisen, 1)
  assert.deepEqual(
    { y: plan.sayilar.yeni, g: plan.sayilar.guncellenecek, a: plan.sayilar.ayni, h: plan.sayilar.hatali },
    { y: 1, g: 1, a: 1, h: 1 }
  )
  // Dosyada olmayan ya da işlenmeyen mevcut öğrenciler: 9003 ve 9099
  assert.equal(plan.sayilar.dokunulmayan, 2)
})

test('plan: pasif öğrenci güncellenir ama uyarı alır; yazılacak veride is_active yoktur', () => {
  const plan = planOlustur([{ satir: 2, no: 9003, ad: 'PASİF CAN YENİ', kademe: 6, sube: 'A' }], mevcut)
  assert.equal(plan.satirlar[0].durum, 'guncellenecek')
  assert.equal(plan.satirlar[0].pasif, true)
  const yazilacak = yazilacakSatirlar(plan, 'okul-1')
  assert.deepEqual(Object.keys(yazilacak[0]).sort(), ['class_name', 'full_name', 'grade', 'school_id', 'student_no'])
})

test('plan: dosyada tekrar eden öğrenci no tüm tekrarlar için hatadır', () => {
  const plan = planOlustur(
    [
      { satir: 2, no: 9010, ad: 'A', kademe: 5, sube: 'A' },
      { satir: 3, no: '9010', ad: 'B', kademe: 5, sube: 'B' },
      { satir: 4, no: 9011, ad: 'C', kademe: 5, sube: 'A' },
    ],
    []
  )
  assert.deepEqual(
    plan.satirlar.map((s) => s.durum),
    ['hatali', 'hatali', 'yeni']
  )
  assert.match(plan.satirlar[0].hatalar[0].mesaj, /2, 3/)
  assert.deepEqual(hataOzeti(plan), [{ etiket: 'Aynı öğrenci no dosyada birden fazla', adet: 2 }])
})

test('yazılacak satırlar yalnızca yeni ve güncellenecekleri içerir', () => {
  const plan = planOlustur(
    [
      { satir: 2, no: 9001, ad: 'ALİ CAN', kademe: 5, sube: 'A' }, // aynı
      { satir: 3, no: 9010, ad: 'YENİ', kademe: 5, sube: 'A' }, // yeni
      { satir: 4, no: 9011, ad: '', kademe: 5, sube: 'A' }, // hatalı
    ],
    mevcut
  )
  assert.deepEqual(
    yazilacakSatirlar(plan, 's').map((r) => r.student_no),
    ['9010']
  )
})

test('CSV: noktalı virgül ayırıcı ve UTF-8 Türkçe karakterler', () => {
  const metin = 'Öğrenci No;Ad Soyad;Kademe;Şube\n9001;ÇAĞRI ŞENOL;5;A\n'
  const satirlar = csvSatirlari(new TextEncoder().encode(metin).buffer)
  assert.deepEqual(satirlar[1], ['9001', 'ÇAĞRI ŞENOL', '5', 'A'])
  assert.equal(satirlariAyir(satirlar).ham[0].ad, 'ÇAĞRI ŞENOL')
})

test('CSV: Windows-1254 (Türkçe Excel) kodlaması doğru çözülür', () => {
  // "ÇAĞRI ŞENOL" Windows-1254: Ç=C7 Ğ=D0 Ş=DE ; "Öğrenci" Ö=D6 ğ=F0
  const baytlar = Uint8Array.from([
    ...Buffer.from('\xD6\xF0renci No,Ad Soyad,Kademe,Þube\n', 'latin1').map((b) => b),
  ])
  // Latin1 ile yazılan Þ "Þ"dir; Windows-1254'te DE = Ş olduğundan aynı bayttır.
  const tam = Uint8Array.from([
    ...baytlar,
    ...Buffer.from('9001,\xC7A\xD0RI \xDEENOL,5,A\n', 'latin1'),
  ])
  const satirlar = csvSatirlari(tam.buffer)
  assert.equal(satirlar[0][0], 'Öğrenci No')
  assert.equal(satirlar[0][3], 'Şube')
  assert.equal(satirlar[1][1], 'ÇAĞRI ŞENOL')
  assert.equal(satirlariAyir(satirlar).hata, undefined)
})

// ---------- Kademe değişikliği ve puan kuralı (aktif sezonda puanı olan öğrencinin kademesi değişemez) ----------
test('plan: aktif sezonda puanı olan öğrencinin kademesini değiştiren satır HATALI sayılır ve dokunulmaz', () => {
  const m = [
    { id: 'p1', student_no: '9101', full_name: 'PUANLI CAN', grade: 5, class_name: 'A', is_active: true },
    { id: 'p2', student_no: '9102', full_name: 'PUANSIZ CAN', grade: 5, class_name: 'A', is_active: true },
    { id: 'p3', student_no: '9103', full_name: 'ESKI SEZON CAN', grade: 5, class_name: 'A', is_active: true },
  ]
  const puan = new Map([
    ['p1', { toplam: 2, aktifSezon: 2 }],
    ['p3', { toplam: 1, aktifSezon: 0 }], // yalnızca eski sezonda puanı var
  ])
  const plan = planOlustur(
    [
      { satir: 2, no: 9101, ad: 'PUANLI CAN', kademe: 6, sube: 'A' }, // puanlı + kademe değişimi -> HATALI
      { satir: 3, no: 9102, ad: 'PUANSIZ CAN', kademe: 6, sube: 'A' }, // puansız -> güncellenecek
      { satir: 4, no: 9103, ad: 'ESKI SEZON CAN', kademe: 6, sube: 'A' }, // eski sezon puanı -> güncellenecek
    ],
    m,
    puan
  )
  assert.deepEqual(plan.satirlar.map((s) => s.durum), ['hatali', 'guncellenecek', 'guncellenecek'])
  assert.equal(plan.satirlar[0].hatalar[0].kod, 'kademe_puanli')
  assert.match(plan.satirlar[0].hatalar[0].mesaj, /Aktif sezonda 2 puan kaydı olduğu için kademe değiştirilemez \(5\. kademe → 6\. kademe\)/)
  // hatalı satır değişiklik sayacına ve yazılacaklara girmez, o öğrenci "dokunulmayan"dır
  assert.equal(plan.sayilar.kademeDegisen, 2)
  assert.deepEqual(yazilacakSatirlar(plan, 's').map((r) => r.student_no), ['9102', '9103'])
  assert.equal(plan.sayilar.dokunulmayan, 1)
  assert.deepEqual(hataOzeti(plan), [{ etiket: 'Aktif sezonda puanı olduğu için kademe değiştirilemez', adet: 1 }])
})

test('plan: puanlı öğrencinin kademesi AYNI kalıyorsa (yalnızca ad/şube) hata değildir', () => {
  const m = [{ id: 'p1', student_no: '9101', full_name: 'PUANLI CAN', grade: 5, class_name: 'A', is_active: true }]
  const puan = new Map([['p1', { toplam: 2, aktifSezon: 2 }]])
  const plan = planOlustur([{ satir: 2, no: 9101, ad: 'PUANLI CAN YENI', kademe: 5, sube: 'B' }], m, puan)
  assert.equal(plan.satirlar[0].durum, 'guncellenecek')
  assert.deepEqual(plan.satirlar[0].farklar.map((f) => f.alan), ['full_name', 'class_name'])
})

test('plan: puan sayıları verilmezse eski davranış sürer (kademe değişimi güncellenecektir)', () => {
  const m = [{ id: 'p1', student_no: '9101', full_name: 'X', grade: 5, class_name: 'A', is_active: true }]
  const plan = planOlustur([{ satir: 2, no: 9101, ad: 'X', kademe: 6, sube: 'A' }], m)
  assert.equal(plan.satirlar[0].durum, 'guncellenecek')
  assert.equal(plan.satirlar[0].kademeDegisti, true)
})
