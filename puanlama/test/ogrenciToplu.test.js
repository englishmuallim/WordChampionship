import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AYRILMA_NEDENLERI,
  DIGER,
  bugunTarihi,
  arsivFormuDogrula,
  nedenGosterimi,
  secimiDegistir,
  hepsiniSec,
  gorunenlerleKesistir,
  seciliOgrenciler,
  topluOnizleme,
  sonucMesaji,
} from '../src/lib/ogrenciToplu.js'
import { puanSayilariHaritasi } from '../src/lib/ogrenciYonetimi.js'

// Tüm veriler uydurmadır; gerçek öğrenci verisine hiçbir yerde dokunulmaz.
const o = (id, no, ad, grade, sube, aktif = true) => ({
  id,
  student_no: no,
  full_name: ad,
  grade,
  class_name: sube,
  is_active: aktif,
})
const a = o('a', '99001', 'TEST BIR', 8, 'T')
const b = o('b', '99002', 'TEST IKI', 8, 'T')
const c = o('c', '99003', 'TEST UC PUANLI', 8, 'T')
const d = o('d', '99004', 'TEST DORT', 7, 'U')
const e = o('e', '99005', 'TEST BES AYRILMIS', 8, 'T', false)
const BUGUN = '2026-10-11'
const puan = puanSayilariHaritasi([
  { student_id: 'c', toplam: 1, aktif_sezon: 1 }, // aktif sezonda puanı var
  { student_id: 'd', toplam: 2, aktif_sezon: 0 }, // yalnızca eski sezonda puanı var
])
const baglam = { puanSayilari: puan, bugun: BUGUN, tumOgrenciler: [a, b, c, d, e] }

// ---------- tarih ----------
test('bugün İstanbul saatine göre bulunur (gece yarısı sınırı)', () => {
  assert.equal(bugunTarihi(new Date('2026-10-10T20:59:00Z')), '2026-10-10') // 23:59 İstanbul
  assert.equal(bugunTarihi(new Date('2026-10-10T21:00:00Z')), '2026-10-11') // 00:00 İstanbul
  assert.equal(bugunTarihi(new Date('2026-10-10T21:30:00Z')), '2026-10-11') // sunucu UTC'de hâlâ 10'u, İstanbul 11'i gösterir
})

// ---------- arşiv formu ----------
test('arşiv formu: bugünün tarihi ve listeden neden kabul edilir', () => {
  const s = arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: 'Nakil', nedenMetni: '' }, BUGUN)
  assert.deepEqual(s.hatalar, [])
  assert.deepEqual(s.deger, { left_at: BUGUN, left_reason: 'Nakil' })
  assert.deepEqual(AYRILMA_NEDENLERI, ['Nakil', 'Okuldan ayrıldı', 'Sürekli devamsız', 'Yurt dışına gitti', 'Şube kapatıldı'])
})

test('arşiv formu: neden isteğe bağlıdır (boş seçim = neden yok)', () => {
  const s = arsivFormuDogrula({ tarih: '2026-09-30', nedenSecimi: '', nedenMetni: 'yok sayılır' }, BUGUN)
  assert.deepEqual(s.deger, { left_at: '2026-09-30', left_reason: null })
})

test('arşiv formu: gelecek tarih, boş ve geçersiz tarih reddedilir', () => {
  assert.deepEqual(arsivFormuDogrula({ tarih: '2026-10-12', nedenSecimi: '' }, BUGUN).hatalar, ['Ayrılma tarihi gelecekte olamaz.'])
  assert.deepEqual(arsivFormuDogrula({ tarih: '', nedenSecimi: '' }, BUGUN).hatalar, ['Ayrılma tarihini seç.'])
  for (const t of ['2026-02-30', '11.10.2026', 'abc', '1999-12-31']) {
    assert.deepEqual(arsivFormuDogrula({ tarih: t, nedenSecimi: '' }, BUGUN).hatalar, ['Ayrılma tarihi geçerli değil.'], t)
  }
})

test('arşiv formu: "Diğer" seçilince serbest metin zorunlu, boşluklar sadeleşir, 200 karakter sınırı', () => {
  assert.deepEqual(arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: DIGER, nedenMetni: '   ' }, BUGUN).hatalar, ['"Diğer" seçildiğinde nedeni yaz.'])
  const s = arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: DIGER, nedenMetni: '  Taşındı,   başka   şehir ' }, BUGUN)
  assert.equal(s.deger.left_reason, 'Taşındı, başka şehir')
  assert.equal(arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: DIGER, nedenMetni: 'x'.repeat(200) }, BUGUN).hatalar.length, 0)
  assert.match(arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: DIGER, nedenMetni: 'x'.repeat(201) }, BUGUN).hatalar[0], /en fazla 200/)
  assert.deepEqual(arsivFormuDogrula({ tarih: BUGUN, nedenSecimi: 'Uydurma neden' }, BUGUN).hatalar, ['Ayrılma nedeni listede yok.'])
})

test('mevcut serbest metin nedenler (listede olmasa da) olduğu gibi gösterilir', () => {
  assert.equal(nedenGosterimi('6. kademe: yalnizca A subesi aktif'), '6. kademe: yalnizca A subesi aktif')
  assert.equal(nedenGosterimi('  Nakil '), 'Nakil')
  assert.equal(nedenGosterimi(null), '')
  assert.equal(nedenGosterimi(undefined), '')
})

// ---------- seçim ----------
test('seçim: tek tek aç/kapat, görünenlerin hepsini seç, seçili öğrencileri sırayla ver', () => {
  let s = new Set()
  s = secimiDegistir(s, 'a')
  s = secimiDegistir(s, 'c')
  assert.deepEqual([...s].sort(), ['a', 'c'])
  s = secimiDegistir(s, 'a')
  assert.deepEqual([...s], ['c'])
  assert.deepEqual([...hepsiniSec([a, b, d])].sort(), ['a', 'b', 'd'])
  assert.deepEqual(seciliOgrenciler(new Set(['d', 'a']), [a, b, c, d]).map((x) => x.id), ['a', 'd'])
})

test('seçim: süzgeç değişince GÖRÜNMEYEN satırlar seçimden düşer; değişmiyorsa aynı nesne döner', () => {
  const secili = new Set(['a', 'b', 'd'])
  const kesisim = gorunenlerleKesistir(secili, [a, b, c]) // d artık görünmüyor
  assert.deepEqual([...kesisim].sort(), ['a', 'b'])
  assert.equal(gorunenlerleKesistir(secili, [a, b, c, d]), secili) // hiçbir şey düşmedi: aynı nesne
  assert.equal(gorunenlerleKesistir(new Set(['a']), []).size, 0)
})

// ---------- toplu: arşivle ----------
test('toplu arşivle: yalnızca aktifler işlenir, zaten ayrılmış olan atlanır, istek biçimi doğru', () => {
  const t = topluOnizleme('arsivle', [a, b, e], { tarih: BUGUN, nedenSecimi: 'Nakil' }, baglam)
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.islenecek.map((x) => x.id), ['a', 'b'])
  assert.deepEqual(t.atlanan.map((x) => [x.ogrenci.id, x.neden]), [['e', 'Zaten ayrılmış.']])
  assert.deepEqual(t.istek, {
    fonksiyon: 'wc_ogrenci_arsivle',
    parametreler: { p_ids: ['a', 'b'], p_left_at: BUGUN, p_reason: 'Nakil' },
  })
  assert.match(t.onay, /^2 öğrenci ayrıldı olarak arşivlenecek \(ayrılma tarihi: 11\.10\.2026, neden: Nakil\)/)
  assert.match(t.onay, /Puan kayıtları silinmez/)
  assert.match(t.onay, /1 öğrenci işlem gerektirmediği için atlanacak/)
})

test('toplu arşivle: neden yoksa "belirtilmedi"; puanlı öğrenci de arşivlenebilir; hatalı form uygulanamaz', () => {
  const t = topluOnizleme('arsivle', [c], { tarih: BUGUN, nedenSecimi: '' }, baglam)
  assert.equal(t.uygulanabilir, true) // puanları silinmediği için arşivlemek serbest
  assert.match(t.onay, /neden: belirtilmedi/)
  assert.equal(t.istek.parametreler.p_reason, null)
  const gelecek = topluOnizleme('arsivle', [a], { tarih: '2026-12-01', nedenSecimi: '' }, baglam)
  assert.equal(gelecek.uygulanabilir, false)
  assert.equal(gelecek.istek, null)
  assert.deepEqual(gelecek.hatalar, ['Ayrılma tarihi gelecekte olamaz.'])
  const hepsiAyrilmis = topluOnizleme('arsivle', [e], { tarih: BUGUN, nedenSecimi: '' }, baglam)
  assert.equal(hepsiAyrilmis.uygulanabilir, false)
  assert.deepEqual(hepsiAyrilmis.hatalar, ['Seçilenlerin hepsi zaten ayrılmış.'])
})

test('toplu işlem: boş seçim uygulanamaz', () => {
  for (const islem of ['arsivle', 'geri_al', 'sube', 'kademe']) {
    const t = topluOnizleme(islem, [], {}, baglam)
    assert.equal(t.uygulanabilir, false, islem)
    assert.deepEqual(t.hatalar, ['Hiç öğrenci seçilmedi.'])
  }
})

// ---------- toplu: geri al ----------
test('toplu geri al: yalnızca ayrılmışlar işlenir; hepsi zaten aktifse uygulanamaz', () => {
  const t = topluOnizleme('geri_al', [a, e], {}, baglam)
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.islenecek.map((x) => x.id), ['e'])
  assert.deepEqual(t.atlanan.map((x) => x.neden), ['Zaten aktif.'])
  assert.deepEqual(t.istek, { fonksiyon: 'wc_ogrenci_geri_al', parametreler: { p_ids: ['e'] } })
  assert.match(t.onay, /ayrılma tarihi ve nedeni silinecek/)
  assert.equal(topluOnizleme('geri_al', [a, b], {}, baglam).uygulanabilir, false)
})

// ---------- toplu: şube ----------
test('toplu şube: kademe değişmez, istek yalnızca şube taşır; aynı şubedekiler atlanır', () => {
  const t = topluOnizleme('sube', [a, b, d], { sube: 'u' }, baglam) // d zaten U
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.islenecek.map((x) => x.id), ['a', 'b'])
  assert.deepEqual(t.atlanan.map((x) => [x.ogrenci.id, x.neden]), [['d', 'Zaten U şubesinde.']])
  assert.deepEqual(t.istek, { fonksiyon: 'wc_ogrenci_sube_degistir', parametreler: { p_ids: ['a', 'b'], p_sube: 'U' } })
  // İSTEK PUAN KAYITLARINA DOKUNACAK HİÇBİR ŞEY TAŞIMAZ: yalnızca öğrenci kimlikleri ve yeni şube
  assert.deepEqual(Object.keys(t.istek.parametreler).sort(), ['p_ids', 'p_sube'])
  assert.match(t.onay, /Puan kayıtlarındaki eski şube bilgisi değişmez/)
})

test('toplu şube: puanlı öğrencinin şubesi değişebilir (kademe değişmediği için serbest)', () => {
  const t = topluOnizleme('sube', [c], { sube: 'V' }, baglam)
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.engellenen, [])
})

test('toplu şube: geçersiz harf reddedilir; yeni şube oluşacaksa uyarı verilir', () => {
  for (const kotu of ['', 'AB', '7', '5-A']) {
    const t = topluOnizleme('sube', [a], { sube: kotu }, baglam)
    assert.equal(t.uygulanabilir, false, kotu)
  }
  const yeni = topluOnizleme('sube', [a, d], { sube: 'K' }, baglam)
  assert.deepEqual(yeni.uyarilar, ['7. kademede K şubesi henüz yok; bu işlemle yeni şube oluşacak.', '8. kademede K şubesi henüz yok; bu işlemle yeni şube oluşacak.'].sort())
  const var_ = topluOnizleme('sube', [a], { sube: 'U' }, baglam) // 8. kademede U yok (U yalnızca 7. kademede)
  assert.equal(var_.uyarilar.length, 1)
  const mevcut = topluOnizleme('sube', [d], { sube: 'T' }, { ...baglam, tumOgrenciler: [a, b, c, d, e, o('x', '1', 'Y', 7, 'T')] })
  assert.deepEqual(mevcut.uyarilar, []) // 7. kademede T zaten var
})

// ---------- toplu: kademe ----------
test('toplu kademe: puansız ve yalnızca eski sezonda puanı olan öğrenciler serbest; istek biçimi doğru', () => {
  const t = topluOnizleme('kademe', [a, d], { kademe: '6', sube: '' }, baglam) // d: eski sezon puanı
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.islenecek.map((x) => x.id), ['a', 'd'])
  assert.deepEqual(t.istek, {
    fonksiyon: 'wc_ogrenci_kademe_degistir',
    parametreler: { p_ids: ['a', 'd'], p_kademe: 6, p_sube: null },
  })
  assert.match(t.onay, /2 öğrencinin kademesi 6 yapılacak \(şubeleri korunur\)/)
})

test('toplu kademe: yeni şube isteğe bağlıdır; verilirse isteğe girer ve kademeyle uyuşmalıdır', () => {
  const t = topluOnizleme('kademe', [a], { kademe: 7, sube: 'b' }, baglam)
  assert.equal(t.uygulanabilir, true)
  assert.equal(t.istek.parametreler.p_sube, 'B')
  assert.match(t.onay, /şubesi B yapılacak/)
  const uyusmaz = topluOnizleme('kademe', [a], { kademe: 7, sube: '6-A' }, baglam)
  assert.equal(uyusmaz.uygulanabilir, false)
  assert.match(uyusmaz.hatalar[0], /uyuşmuyor/)
})

test('toplu kademe: aktif sezonda puanı olan tek bir öğrenci HEPSİNİ engeller (hepsi ya da hiçbiri)', () => {
  const t = topluOnizleme('kademe', [a, b, c], { kademe: '7', sube: '' }, baglam)
  assert.equal(t.uygulanabilir, false)
  assert.equal(t.istek, null)
  assert.deepEqual(t.engellenen.map((x) => x.ogrenci.id), ['c'])
  assert.match(t.engellenen[0].neden, /Aktif sezonda 1 puan kaydı olduğu için kademe değiştirilemez/)
  assert.match(t.hatalar[0], /1 öğrencinin kademesi değiştirilemiyor/)
  assert.match(t.hatalar[0], /hiçbir öğrenciye uygulanmayacak/)
  assert.match(t.hatalar[0], /TEST UC PUANLI \(99003\)/)
})

test('toplu kademe: puan bilgisi alınamadıysa güvenli tarafta hepsi engellenir', () => {
  const t = topluOnizleme('kademe', [a], { kademe: '7' }, { ...baglam, puanSayilari: null })
  assert.equal(t.uygulanabilir, false)
  assert.equal(t.engellenen.length, 1)
})

test('toplu kademe: puanlı öğrenci yalnızca ŞUBE değiştiriyorsa (kademe aynı) engellenmez', () => {
  const t = topluOnizleme('kademe', [c], { kademe: '8', sube: 'V' }, baglam)
  assert.equal(t.uygulanabilir, true)
  assert.deepEqual(t.engellenen, [])
  assert.deepEqual(t.istek.parametreler, { p_ids: ['c'], p_kademe: 8, p_sube: 'V' })
})

test('toplu kademe: zaten o kademedekiler atlanır; hepsi öyleyse uygulanamaz; kademe 5-8 dışı reddedilir', () => {
  const kismen = topluOnizleme('kademe', [a, d], { kademe: '7' }, baglam) // d zaten 7
  assert.deepEqual(kismen.islenecek.map((x) => x.id), ['a'])
  assert.deepEqual(kismen.atlanan.map((x) => x.neden), ['Zaten 7. kademede.'])
  const hepsi = topluOnizleme('kademe', [a, b], { kademe: '8' }, baglam)
  assert.equal(hepsi.uygulanabilir, false)
  assert.deepEqual(hepsi.hatalar, ['Seçilen öğrencilerin hepsi zaten bu kademede.'])
  for (const k of ['9', '4', '', 'abc']) assert.equal(topluOnizleme('kademe', [a], { kademe: k }, baglam).uygulanabilir, false, k)
})

test('bilinmeyen işlem uygulanamaz; sonuç mesajları', () => {
  assert.equal(topluOnizleme('sil', [a], {}, baglam).uygulanabilir, false)
  assert.equal(sonucMesaji('arsivle', {}, 3), '3 öğrenci arşivlendi.')
  assert.equal(sonucMesaji('geri_al', {}, 2), '2 öğrenci arşivden geri alındı.')
  assert.equal(sonucMesaji('sube', { sube: 'u' }, 4), '4 öğrencinin şubesi U yapıldı.')
  assert.equal(sonucMesaji('kademe', { kademe: '7' }, 1), '1 öğrencinin kademesi 7 yapıldı.')
})
