import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bos,
  ogrenciNoDogrula,
  adDogrula,
  kademeDogrula,
  subeDogrula,
  alanlariDogrula,
} from '../src/lib/ogrenciDogrulama.js'
import { satirDogrula } from '../src/lib/ogrenciIceAktar.js'

test('bos: null, tanımsız, boşluk ve boş metin boştur; 0 dolu sayılır', () => {
  for (const v of [null, undefined, '', '   ']) assert.equal(bos(v), true)
  for (const v of [0, '0', 'a', false]) assert.equal(bos(v), false)
})

test('öğrenci no: sayı metne çevrilir, kırpılır; boş, ondalık, boşluklu ve uzun numara hatadır', () => {
  assert.deepEqual(ogrenciNoDogrula(9001), { deger: '9001', hata: null })
  assert.deepEqual(ogrenciNoDogrula(' A-12.b_3 '), { deger: 'A-12.b_3', hata: null })
  assert.equal(ogrenciNoDogrula('').hata.kod, 'no_bos')
  assert.equal(ogrenciNoDogrula(12.5).hata.kod, 'no_gecersiz')
  assert.equal(ogrenciNoDogrula('12 34').hata.kod, 'no_gecersiz')
  assert.equal(ogrenciNoDogrula('1'.repeat(21)).hata.kod, 'no_gecersiz')
  assert.equal(ogrenciNoDogrula('1'.repeat(20)).hata, null)
})

test('ad soyad: fazla boşluklar sadeleşir; boş ve 100 karakterden uzun ad hatadır', () => {
  assert.deepEqual(adDogrula('  ALİ    CAN\t'), { deger: 'ALİ CAN', hata: null })
  assert.equal(adDogrula('   ').hata.kod, 'ad_bos')
  assert.equal(adDogrula('x'.repeat(100)).hata, null)
  assert.equal(adDogrula('x'.repeat(101)).hata.kod, 'ad_uzun')
})

test('kademe: yalnızca 5-8; metin olarak da gelebilir; birleşik "5-A" ayrı hata kodu alır', () => {
  for (const k of [5, 6, 7, 8, '5', ' 8 ']) assert.equal(kademeDogrula(k).hata, null, String(k))
  for (const k of [4, 9, '12', 0]) assert.equal(kademeDogrula(k).hata.kod, 'kademe_gecersiz', String(k))
  assert.equal(kademeDogrula('').hata.mesaj, 'Kademe boş.')
  assert.equal(kademeDogrula(5.5).hata.kod, 'kademe_gecersiz')
  assert.equal(kademeDogrula('beş').hata.kod, 'kademe_gecersiz')
  for (const k of ['5-A', '6/B', '7 C']) assert.equal(kademeDogrula(k).hata.kod, 'kademe_birlesik', k)
})

test('şube: tek harf (Türkçe büyük harfe çevrilir); "5-A" harfe iner; kademe uyuşmazsa hata', () => {
  assert.deepEqual(subeDogrula('a', 5), { deger: 'A', hata: null })
  assert.equal(subeDogrula('i', 5).deger, 'İ')
  assert.equal(subeDogrula('ı', 5).deger, 'I')
  assert.deepEqual(subeDogrula('5-b', 5), { deger: 'B', hata: null })
  assert.deepEqual(subeDogrula('6/B', null), { deger: 'B', hata: null }) // kademe henüz bilinmiyorsa uyuşma denetlenmez
  assert.equal(subeDogrula('6-A', 5).hata.kod, 'sube_kademe_uyusmaz')
  assert.equal(subeDogrula('').hata.kod, 'sube_bos')
  assert.equal(subeDogrula('AB', 5).hata.kod, 'sube_gecersiz')
  assert.equal(subeDogrula(7, 5).hata.kod, 'sube_gecersiz')
})

test('mesaj dili: dosya bağlamı "sütun", form bağlamı "alan" der; kodlar aynıdır', () => {
  const d = kademeDogrula('5-A', 'dosya').hata
  const f = kademeDogrula('5-A', 'form').hata
  assert.equal(d.kod, f.kod)
  assert.equal(d.mesaj, 'Kademe sütununda "5-A" var; Kademe ve Şube ayrı sütunlarda olmalı.')
  assert.equal(f.mesaj, 'Kademe alanında "5-A" var; Kademe ve Şube ayrı alanlarda olmalı.')

  const du = subeDogrula('6-A', 5, 'dosya').hata
  const fu = subeDogrula('6-A', 5, 'form').hata
  assert.equal(du.kod, fu.kod)
  assert.equal(du.mesaj, 'Şube sütunundaki kademe (6) ile Kademe sütunu (5) uyuşmuyor.')
  assert.equal(fu.mesaj, 'Şube alanındaki kademe (6) ile Kademe alanı (5) uyuşmuyor.')
  // varsayılan bağlam dosyadır (içe aktarma davranışı değişmedi)
  assert.equal(kademeDogrula('5-A').hata.mesaj, d.mesaj)
})

test('alanlariDogrula: geçerli girdi temiz değer verir; hatalar alan sırasıyla toplanır', () => {
  const iyi = alanlariDogrula({ no: 9001, ad: '  ali   can ', kademe: '5', sube: '5-a' }, 'form')
  assert.deepEqual(iyi.deger, { student_no: '9001', full_name: 'ali can', grade: 5, class_name: 'A' })
  assert.deepEqual(iyi.hatalar, [])

  const kotu = alanlariDogrula({ no: '', ad: '', kademe: 9, sube: 'AB' }, 'form')
  assert.equal(kotu.deger, null)
  assert.deepEqual(kotu.hatalar.map((h) => h.kod), ['no_bos', 'ad_bos', 'kademe_gecersiz', 'sube_gecersiz'])
})

test('içe aktarma ile form aynı kuralları kullanır: aynı girdi, aynı sonuç (mesaj dili hariç)', () => {
  const girdiler = [
    { no: 1, ad: 'A B', kademe: 5, sube: 'a' },
    { no: '', ad: 'A', kademe: 7, sube: 'B' },
    { no: 2, ad: 'A', kademe: 9, sube: '9-A' },
    { no: 3, ad: 'A', kademe: '6-A', sube: 'A' },
    { no: 4, ad: '', kademe: 8, sube: '' },
  ]
  for (const g of girdiler) {
    const dosya = satirDogrula(g)
    const form = alanlariDogrula(g, 'form')
    assert.deepEqual(form.deger, dosya.deger)
    assert.deepEqual(form.hatalar.map((h) => h.kod), dosya.hatalar.map((h) => h.kod))
  }
})
