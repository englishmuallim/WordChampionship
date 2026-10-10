import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  puanSayilariHaritasi,
  puanBilgisi,
  kademeKilidi,
  silmeDurumu,
  silmeOnayMetni,
  bosForm,
  formdanOgrenci,
  hataAlani,
  ogrenciFormunuDogrula,
  hatalariAlanaGoreAyir,
  degisenAlanlar,
} from '../src/lib/ogrenciYonetimi.js'

// Test verisi tamamen uydurmadır; gerçek öğrenci verisine hiçbir yerde dokunulmaz.
const ogr = (id, no, ad, grade, sube, aktif = true) => ({
  id,
  student_no: no,
  full_name: ad,
  grade,
  class_name: sube,
  is_active: aktif,
})
const liste = [ogr('a', '99001', 'TEST BIR', 5, 'A'), ogr('b', '99002', 'TEST IKI', 6, 'B'), ogr('c', '99003', 'TEST UC', 7, 'C')]
const form = (no, ad, kademe, sube) => ({ student_no: no, full_name: ad, grade: kademe, class_name: sube })

test('puan sayıları: rpc satırları haritaya çevrilir; haritada olmayan öğrencinin puanı yoktur', () => {
  const h = puanSayilariHaritasi([
    { student_id: 'a', toplam: 3, aktif_sezon: 2 },
    { student_id: 'b', toplam: 1, aktif_sezon: 0 },
  ])
  assert.deepEqual(puanBilgisi('a', h), { toplam: 3, aktifSezon: 2 })
  assert.deepEqual(puanBilgisi('b', h), { toplam: 1, aktifSezon: 0 })
  assert.deepEqual(puanBilgisi('c', h), { toplam: 0, aktifSezon: 0 }) // kaydı yok
  assert.equal(puanBilgisi('a', null), null) // sayılar alınamadı: bilinmiyor
})

test('kademe kilidi: yalnızca AKTİF sezonda puanı olanın kademesi kilitlenir', () => {
  const h = puanSayilariHaritasi([
    { student_id: 'a', toplam: 2, aktif_sezon: 2 },
    { student_id: 'b', toplam: 4, aktif_sezon: 0 }, // yalnızca eski sezonda puanı var
  ])
  assert.equal(kademeKilidi('a', h).kilitli, true)
  assert.match(kademeKilidi('a', h).neden, /Aktif sezonda 2 puan kaydı olduğu için kademe değiştirilemez/)
  assert.equal(kademeKilidi('b', h).kilitli, false) // yıl sonu terfisi mümkün kalır
  assert.equal(kademeKilidi('c', h).kilitli, false) // puanı yok
  // sayılar alınamadıysa güvenli tarafta: kilitli
  assert.equal(kademeKilidi('c', null).kilitli, true)
})

test('silme: yalnızca hiç puan kaydı olmayan öğrenci silinebilir (eski sezon puanı da engeller)', () => {
  const h = puanSayilariHaritasi([
    { student_id: 'a', toplam: 2, aktif_sezon: 2 },
    { student_id: 'b', toplam: 1, aktif_sezon: 0 },
  ])
  assert.deepEqual(silmeDurumu('c', h), { izin: true, neden: '' })
  assert.equal(silmeDurumu('a', h).izin, false)
  assert.match(silmeDurumu('a', h).neden, /Puan kaydı olduğu için silinemez \(2 kayıt\)/)
  assert.equal(silmeDurumu('b', h).izin, false) // yalnızca eski sezonda puanı olsa da silinemez
  assert.equal(silmeDurumu('c', null).izin, false) // bilinmiyor: silinemez
})

test('silme onay metni ad ve numarayı içerir ve geri alınamayacağını söyler', () => {
  const m = silmeOnayMetni(liste[0])
  assert.match(m, /TEST BIR \(99001\)/)
  assert.match(m, /geri alınamaz/)
})

test('form: boş form ve mevcut öğrenciden form kurulumu', () => {
  assert.deepEqual(bosForm(), { student_no: '', full_name: '', grade: '5', class_name: '' })
  assert.deepEqual(formdanOgrenci(ogr('a', '99001', 'TEST BIR', 5, null)), form('99001', 'TEST BIR', '5', ''))
})

test('form: geçerli girdi temizlenir (ad boşlukları, şube harfi)', () => {
  const s = ogrenciFormunuDogrula(form(' 99010 ', '  test   yeni ', '8', '8-d'), liste)
  assert.deepEqual(s.hatalar, [])
  assert.deepEqual(s.deger, { student_no: '99010', full_name: 'test yeni', grade: 8, class_name: 'D' })
})

test('form: alan hataları içe aktarmayla aynı kodları verir ve doğru alana bağlanır; mesaj dili "alan"dır', () => {
  const s = ogrenciFormunuDogrula(form('', '', '9', 'AB'), liste)
  assert.equal(s.deger, null)
  assert.deepEqual(s.hatalar.map((h) => [h.kod, h.alan]), [
    ['no_bos', 'no'],
    ['ad_bos', 'ad'],
    ['kademe_gecersiz', 'kademe'],
    ['sube_gecersiz', 'sube'],
  ])
  const birlesik = ogrenciFormunuDogrula(form('1', 'A', '5-A', 'A'), liste)
  assert.equal(birlesik.hatalar[0].mesaj, 'Kademe alanında "5-A" var; Kademe ve Şube ayrı alanlarda olmalı.')
  const uyusmaz = ogrenciFormunuDogrula(form('1', 'A', '5', '6-A'), liste)
  assert.equal(uyusmaz.hatalar[0].kod, 'sube_kademe_uyusmaz')
})

test('form: aynı öğrenci numarası zaten kayıtlıysa anlaşılır hata (kim olduğu yazılır)', () => {
  const s = ogrenciFormunuDogrula(form('99002', 'BASKA AD', '6', 'B'), liste)
  assert.equal(s.deger, null)
  assert.deepEqual(s.hatalar.map((h) => [h.kod, h.alan]), [['no_tekrar', 'no']])
  assert.equal(s.hatalar[0].mesaj, 'Bu öğrenci numarası zaten kayıtlı: 99002 (TEST IKI).')
  // sayı olarak girilse de aynı numara sayılır
  assert.equal(ogrenciFormunuDogrula(form(' 99002 ', 'X', '6', 'B'), liste).hatalar[0].kod, 'no_tekrar')
})

test('form: düzenlemede kendi numarası çakışma sayılmaz; başkasının numarası sayılır', () => {
  const kendi = ogrenciFormunuDogrula(form('99002', 'TEST IKI YENI', '6', 'B'), liste, { duzenlenenId: 'b' })
  assert.deepEqual(kendi.hatalar, [])
  const baskasi = ogrenciFormunuDogrula(form('99003', 'TEST IKI', '6', 'B'), liste, { duzenlenenId: 'b' })
  assert.deepEqual(baskasi.hatalar.map((h) => h.kod), ['no_tekrar'])
})

test('form: düzenlemede puanlı öğrencinin kademesini değiştirmek engellenir; şube/ad serbesttir', () => {
  const h = puanSayilariHaritasi([{ student_id: 'a', toplam: 1, aktif_sezon: 1 }])
  const kademe = ogrenciFormunuDogrula(form('99001', 'TEST BIR', '6', 'A'), liste, { duzenlenenId: 'a', puanSayilari: h })
  assert.deepEqual(kademe.hatalar.map((x) => [x.kod, x.alan]), [['kademe_kilitli', 'kademe']])
  const sube = ogrenciFormunuDogrula(form('99001', 'TEST BIR YENI', '5', 'Z'), liste, { duzenlenenId: 'a', puanSayilari: h })
  assert.deepEqual(sube.hatalar, [])
  assert.equal(sube.deger.class_name, 'Z')
  // puanı olmayan öğrencinin kademesi değişebilir
  const serbest = ogrenciFormunuDogrula(form('99002', 'TEST IKI', '7', 'B'), liste, { duzenlenenId: 'b', puanSayilari: h })
  assert.deepEqual(serbest.hatalar, [])
  // kademe aynı kalıyorsa kilit hata vermez
  const ayni = ogrenciFormunuDogrula(form('99001', 'TEST BIR', '5', 'A'), liste, { duzenlenenId: 'a', puanSayilari: h })
  assert.deepEqual(ayni.hatalar, [])
  // puan sayıları alınamadıysa (null) kademe değişikliği güvenli tarafta engellenir
  const bilinmiyor = ogrenciFormunuDogrula(form('99002', 'TEST IKI', '7', 'B'), liste, { duzenlenenId: 'b', puanSayilari: null })
  assert.deepEqual(bilinmiyor.hatalar.map((x) => x.kod), ['kademe_kilitli'])
})

test('form: ekleme (düzenleme değil) kademe kilidine takılmaz', () => {
  const s = ogrenciFormunuDogrula(form('99020', 'YENI', '7', 'A'), liste, { puanSayilari: null })
  assert.deepEqual(s.hatalar, [])
})

test('hata alanı ve gruplama', () => {
  assert.equal(hataAlani('no_tekrar'), 'no')
  assert.equal(hataAlani('kademe_kilitli'), 'kademe')
  assert.equal(hataAlani('bilinmeyen'), 'genel')
  const g = hatalariAlanaGoreAyir([
    { kod: 'no_bos', mesaj: 'a', alan: 'no' },
    { kod: 'ad_bos', mesaj: 'b' },
    { kod: 'x', mesaj: 'c' },
  ])
  assert.deepEqual(g, { no: ['a'], ad: ['b'], kademe: [], sube: [], genel: ['c'] })
})

test('değişen alanlar: yalnızca farklı olanlar döner; boş şube ile null aynı sayılır', () => {
  const eski = ogr('a', '99001', 'TEST BIR', 5, 'A')
  assert.deepEqual(degisenAlanlar(eski, { student_no: '99001', full_name: 'TEST BIR', grade: 5, class_name: 'A' }), {})
  assert.deepEqual(degisenAlanlar(eski, { student_no: '99001', full_name: 'YENI AD', grade: 5, class_name: 'B' }), {
    full_name: 'YENI AD',
    class_name: 'B',
  })
  assert.deepEqual(degisenAlanlar(eski, { student_no: '99005', full_name: 'TEST BIR', grade: 6, class_name: 'A' }), {
    student_no: '99005',
    grade: 6,
  })
  const subesiz = ogr('x', '1', 'A', 5, null)
  assert.deepEqual(degisenAlanlar(subesiz, { student_no: '1', full_name: 'A', grade: 5, class_name: '' }), {})
})
