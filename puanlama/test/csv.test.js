import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOM, csvHucre, csvOlustur, tarihTr, ozetCsv, dokumCsv, csvDosyaAdi, donemAdi } from '../src/lib/csv.js'

test('UTF-8 BOM ile başlar, noktalı virgül ve CRLF kullanır, Türkçe karakterler bozulmaz', () => {
  const c = csvOlustur([{ ad: 'Ad Soyad' }, { ad: 'Net', sayi: true }], [['Çağla Öz İğdır Şahin Ümit', 3]])
  assert.ok(c.startsWith('﻿'))
  assert.equal(BOM, '﻿')
  assert.equal(c, '﻿Ad Soyad;Net\r\nÇağla Öz İğdır Şahin Ümit;3\r\n')
  assert.equal(c.split('\r\n').length, 3) // başlık, 1 satır, bitişteki boş parça
})

test('hücre: ; " ve satır sonu içeren metin tırnaklanır, tırnak ikilenir', () => {
  assert.equal(csvHucre('a;b'), '"a;b"')
  assert.equal(csvHucre('Dedi ki "merhaba"'), '"Dedi ki ""merhaba"""')
  assert.equal(csvHucre('iki\nsatır'), '"iki\nsatır"')
  assert.equal(csvHucre('düz metin, virgül serbest'), 'düz metin, virgül serbest')
})

test('formül enjeksiyonu: = + - @ sekme ve satır başı ile başlayan metin başına tek tırnak alır', () => {
  assert.equal(csvHucre('=1+1'), "'=1+1")
  assert.equal(csvHucre('+90 555'), "'+90 555")
  assert.equal(csvHucre('-2 puan'), "'-2 puan")
  assert.equal(csvHucre('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvHucre('\t=x'), "'\t=x")
  assert.equal(csvHucre('=HYPERLINK("http://k.example";"tıkla")'), '"\'=HYPERLINK(""http://k.example"";""tıkla"")"')
  assert.equal(csvHucre("'zaten tırnaklı"), "'zaten tırnaklı") // başında zaten tek tırnak: dokunulmaz
  assert.equal(csvHucre('Ali = Veli'), 'Ali = Veli') // başında değil
})

test('sayı sütunları: negatif sayı bozulmaz, geçersiz değer boş', () => {
  assert.equal(csvHucre(-2, { sayi: true }), '-2')
  assert.equal(csvHucre(0, { sayi: true }), '0')
  assert.equal(csvHucre(-0, { sayi: true }), '0')
  assert.equal(csvHucre(3, { sayi: true }), '3')
  assert.equal(csvHucre(1.5, { sayi: true }), '')
  assert.equal(csvHucre('=1+1', { sayi: true }), '') // sayı sütununa metin yazılamaz
  assert.equal(csvHucre(NaN, { sayi: true }), '')
  assert.equal(csvHucre(null), '')
  assert.equal(csvHucre(undefined, { sayi: true }), '')
})

test('csvOlustur: formül içeren metin hücreleri korunur, aynı satırdaki negatif sayı bozulmadan kalır', () => {
  const c = csvOlustur([{ ad: 'Ad' }, { ad: 'Puan', sayi: true }, { ad: 'Neden' }], [['=cmd', -2, '-1 geri alındı']])
  assert.equal(c, "﻿Ad;Puan;Neden\r\n'=cmd;-2;'-1 geri alındı\r\n")
})

test('tarih biçimi: GG.AA.YYYY', () => {
  assert.equal(tarihTr('2026-11-03'), '03.11.2026')
  assert.equal(tarihTr(null), '')
  assert.equal(tarihTr('geçersiz'), '')
})

const satir = (ek = {}) => ({
  sube: 'A',
  student_no: '101',
  full_name: 'Çağla Öz',
  arti: 1,
  eksi: 3,
  net: -2,
  tarihsiz: 0,
  dokum: [
    { odevUnite: 3, turAdi: 'Kontrol', puan: -3, tarih: '2027-02-02', tarihsiz: false, aciklama: '4 gerekli, 1 yazdı' },
    { odevUnite: 2, turAdi: 'Otomatik artı', puan: 1, tarih: null, tarihsiz: true, aciklama: 'Sınav sonucuna göre otomatik' },
  ],
  ...ek,
})

test('özet CSV: sütunlar, eksi adet olarak, net işaretli', () => {
  const c = ozetCsv([satir(), satir({ sube: 'B', full_name: '=Kötü Ad', student_no: '102', arti: 2, eksi: 0, net: 2 })], 1)
  assert.equal(
    c,
    '﻿Şube;Öğrenci No;Ad Soyad;Artı;Eksi;Net;Dönem;Tarihsiz kalem\r\n' +
      "A;101;Çağla Öz;1;3;-2;1. dönem;0\r\n" +
      "B;102;'=Kötü Ad;2;0;2;1. dönem;0\r\n"
  )
})

test('döküm CSV: her hareket bir satır, eksi puan sayı, tarihsiz işaretli, tarih Türkçe biçimde', () => {
  const c = dokumCsv([satir()], 'tumu')
  assert.equal(
    c,
    '﻿Şube;Öğrenci No;Ad Soyad;Ödev ünitesi;Tarih;Tür;Puan;Dönem;Açıklama\r\n' +
      'A;101;Çağla Öz;3;02.02.2027;Kontrol;-3;2. dönem;4 gerekli, 1 yazdı\r\n' +
      'A;101;Çağla Öz;2;;Otomatik artı;1;tarihsiz;Sınav sonucuna göre otomatik\r\n'
  )
})

test('döküm CSV: formülle başlayan elle düzeltme nedeni korunur', () => {
  const s = satir({ dokum: [{ odevUnite: 2, turAdi: 'Elle düzeltme', puan: 2, tarih: '2026-11-20', tarihsiz: false, aciklama: '=HYPERLINK("x")' }] })
  const c = dokumCsv([s], 'tumu')
  assert.ok(c.includes('"\'=HYPERLINK(""x"")"'))
})

test('dönem adı ve dosya adı (yalnızca ASCII)', () => {
  assert.equal(donemAdi('tumu'), 'Tümü')
  assert.equal(donemAdi(1), '1. dönem')
  assert.equal(donemAdi(2), '2. dönem')
  assert.equal(csvDosyaAdi('ozet', 7, 'A', 'tumu'), 'odev-ozeti-7-A-tumu.csv')
  assert.equal(csvDosyaAdi('dokum', 7, '', 1), 'odev-dokumu-7-tum-subeler-1-donem.csv')
  assert.equal(csvDosyaAdi('ozet', 5, 'Ç', 2), 'odev-ozeti-5-sube-2-donem.csv') // ASCII dışı şube adı güvenli ada çevrilir
})
