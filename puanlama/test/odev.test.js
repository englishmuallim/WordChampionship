import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bantHesapla,
  tarihGecerliMi,
  donemBul,
  kontrolTarihiDogrula,
  gecerliKontroller,
  kontrolSonuclari,
  oncekiToplam,
  toplamDogrula,
  odevDurumu,
  odevSatirlariniSirala,
  ogrenciOzeti,
} from '../src/lib/odev.js'

const girdi = (n) => ({ status: 'girdi', correct_count: n })
let sayac = 0
// kontrol satırı: tarih, toplam yazılan, gereken (kayıt anındaki bant)
const k = (tarih, toplam, gereken, ek = {}) => ({
  id: `k${++sayac}`,
  kontrol_tarihi: tarih,
  toplam_yazilan: toplam,
  gereken,
  iptal: false,
  created_at: `2026-11-01T10:00:${String(sayac).padStart(2, '0')}Z`,
  ...ek,
})
const duz = (tur, puan, tarih, ek = {}) => ({ id: `d${++sayac}`, tur, puan, tarih, neden: null, created_at: `2026-11-02T10:00:${String(sayac).padStart(2, '0')}Z`, ...ek })
const yazma = (g) => ({ tur: 'yazma', gereken: g })

// ---------- Bant ----------
test('bant: tüm sınır değerler (25 soru)', () => {
  const beklenen = [
    [0, { tur: 'yazma', gereken: 5 }],
    [1, { tur: 'yazma', gereken: 4 }],
    [3, { tur: 'yazma', gereken: 4 }],
    [4, { tur: 'yazma', gereken: 3 }],
    [7, { tur: 'yazma', gereken: 3 }],
    [8, { tur: 'yazma', gereken: 2 }],
    [12, { tur: 'yazma', gereken: 2 }],
    [13, { tur: 'yazma', gereken: 1 }],
    [14, { tur: 'yazma', gereken: 1 }],
    [15, { tur: 'odevsiz', otomatikArti: 1 }],
    [24, { tur: 'odevsiz', otomatikArti: 1 }],
    [25, { tur: 'odevsiz', otomatikArti: 2 }],
  ]
  for (const [dogru, bant] of beklenen) assert.deepEqual(bantHesapla(girdi(dogru), 25), bant, `${dogru} doğru`)
})

test('bant: girmedi ve kopya 5 kez; kayıt yok belirsiz', () => {
  assert.deepEqual(bantHesapla({ status: 'girmedi', correct_count: null }, 25), { tur: 'yazma', gereken: 5 })
  assert.deepEqual(bantHesapla({ status: 'kopya', correct_count: null }, 25), { tur: 'yazma', gereken: 5 })
  assert.deepEqual(bantHesapla(undefined, 25), { tur: 'belirsiz' })
  assert.deepEqual(bantHesapla(null, 25), { tur: 'belirsiz' })
})

test('bant: soru sayısı 25 değilse tanımsız; geçersiz doğru sayısı tanımsız', () => {
  assert.equal(bantHesapla(girdi(10), 20).tur, 'tanimsiz')
  assert.equal(bantHesapla(girdi(20), 20).tur, 'tanimsiz')
  assert.equal(bantHesapla(undefined, 20).tur, 'tanimsiz')
  assert.equal(bantHesapla(girdi(26), 25).tur, 'tanimsiz')
  assert.equal(bantHesapla(girdi(-1), 25).tur, 'tanimsiz')
  assert.equal(bantHesapla(girdi(7.5), 25).tur, 'tanimsiz')
  assert.equal(bantHesapla({ status: 'baska', correct_count: 10 }, 25).tur, 'tanimsiz')
})

test('girmedi işaretli öğrenci sonradan puan alırsa bant yeniden hesaplanır', () => {
  assert.equal(bantHesapla({ status: 'girmedi' }, 25).gereken, 5)
  assert.equal(bantHesapla(girdi(14), 25).gereken, 1)
})

// ---------- Tarih ve dönem ----------
test('dönem: Ocak dahil Eylül-Ocak 1. dönem, Şubat ve sonrası 2. dönem', () => {
  assert.equal(donemBul('2026-09-01'), 1)
  assert.equal(donemBul('2026-12-31'), 1)
  assert.equal(donemBul('2027-01-01'), 1)
  assert.equal(donemBul('2027-01-31'), 1)
  assert.equal(donemBul('2027-02-01'), 2)
  assert.equal(donemBul('2027-06-30'), 2)
  assert.equal(donemBul('2026-08-31'), 2)
})

test('dönem: tarihsiz ya da geçersiz tarih null; saat dilimi sonucu değiştirmez (metinden okunur)', () => {
  assert.equal(donemBul(null), null)
  assert.equal(donemBul(undefined), null)
  assert.equal(donemBul(''), null)
  assert.equal(donemBul('2027-13-01'), null)
  assert.equal(donemBul('2027-02-30'), null)
  assert.equal(donemBul('31.01.2027'), null)
})

test('tarih geçerliliği: artık yıl', () => {
  assert.equal(tarihGecerliMi('2028-02-29'), true)
  assert.equal(tarihGecerliMi('2027-02-29'), false)
  assert.equal(tarihGecerliMi('2100-02-29'), false)
  assert.equal(tarihGecerliMi('2026-04-31'), false)
})

test('kontrol tarihi: ileri tarih olamaz, bugün ve geçmiş olur', () => {
  assert.equal(kontrolTarihiDogrula('2026-11-10', '2026-11-10').gecerli, true)
  assert.equal(kontrolTarihiDogrula('2026-09-01', '2026-11-10').gecerli, true)
  const ileri = kontrolTarihiDogrula('2026-11-11', '2026-11-10')
  assert.equal(ileri.gecerli, false)
  assert.match(ileri.hata, /ileri olamaz/)
  assert.equal(kontrolTarihiDogrula('', '2026-11-10').gecerli, false)
})

// ---------- Kontrol sonuçları (birikimli toplam) ----------
test('2 kez gerekli: 1. hafta 0 → -2; 2. hafta toplam 1 → -1; 3. hafta toplam 2 → tamamlandı (artı yok)', () => {
  const s = kontrolSonuclari(gecerliKontroller([k('2026-11-10', 0, 2), k('2026-11-17', 1, 2), k('2026-11-24', 2, 2)]))
  assert.deepEqual(s.map((x) => x.etki), [-2, -1, 0])
  assert.deepEqual(s.map((x) => x.durum), ['eksi', 'eksi', 'tamamlandi'])
})

test('ilk kontrolde kalan 0 ise +1 artı (1 gerekip 1, 2 gerekip 2 yazan)', () => {
  assert.equal(kontrolSonuclari(gecerliKontroller([k('2026-11-10', 1, 1)]))[0].etki, 1)
  assert.equal(kontrolSonuclari(gecerliKontroller([k('2026-11-10', 2, 2)]))[0].etki, 1)
  assert.equal(kontrolSonuclari(gecerliKontroller([k('2026-11-10', 5, 5)]))[0].etki, 1)
})

test('ilk kontrolde 2 gerekirken 1 yazan: -1 ve artı hakkı kalkar (tamamlayınca artı yok)', () => {
  const s = kontrolSonuclari(gecerliKontroller([k('2026-11-10', 1, 2), k('2026-11-17', 2, 2)]))
  assert.deepEqual(s.map((x) => x.etki), [-1, 0])
})

test('gereken sayıdan fazla yazmak ekstra artı vermez', () => {
  assert.equal(kontrolSonuclari(gecerliKontroller([k('2026-11-10', 4, 2)]))[0].etki, 1)
})

test('önceki toplam: seçilen tarihten önceki son kontrol; yoksa 0', () => {
  const g = gecerliKontroller([k('2026-11-10', 1, 3), k('2026-11-17', 2, 3)])
  assert.equal(oncekiToplam(g, '2026-11-10'), 0)
  assert.equal(oncekiToplam(g, '2026-11-17'), 1)
  assert.equal(oncekiToplam(g, '2026-11-24'), 2)
})

test('toplam doğrulama: aralık hata, azalma yalnızca uyarı', () => {
  assert.equal(toplamDogrula(0, 0).gecerli, true)
  assert.equal(toplamDogrula(10, 0).gecerli, true)
  assert.equal(toplamDogrula(11, 0).gecerli, false)
  assert.equal(toplamDogrula(-1, 0).gecerli, false)
  assert.equal(toplamDogrula(1.5, 0).gecerli, false)
  const az = toplamDogrula(1, 2)
  assert.equal(az.gecerli, true)
  assert.match(az.uyari, /azalmaz/)
})

// ---------- Geçerli kontroller: sıra, aynı gün, iptal ----------
test('geriye dönük giriş: sonradan girilen daha eski tarihli kontrol "ilk kontrol" olur', () => {
  // 17'si önce girildi (kalan 0 → +1 görünürdü), sonra 10'u girildi
  const satirlar = [k('2026-11-17', 2, 2), k('2026-11-10', 1, 2)]
  const s = kontrolSonuclari(gecerliKontroller(satirlar))
  assert.deepEqual(s.map((x) => [x.tarih, x.etki]), [['2026-11-10', -1], ['2026-11-17', 0]])
})

test('aynı gün çift kayıt: en son eklenen geçerli; girişin sırası sonucu değiştirmez', () => {
  const eski = k('2026-11-10', 0, 2, { created_at: '2026-11-10T08:00:00Z' })
  const yeni = k('2026-11-10', 2, 2, { created_at: '2026-11-10T09:00:00Z' })
  assert.equal(gecerliKontroller([eski, yeni])[0].toplam_yazilan, 2)
  assert.equal(gecerliKontroller([yeni, eski])[0].toplam_yazilan, 2)
})

test('iptal: aynı tarihin en son satırı iptalse o kontrol yok sayılır; sonra yeniden girilirse geçerli olur', () => {
  const ilk = k('2026-11-10', 0, 2, { created_at: '2026-11-10T08:00:00Z' })
  const iptal = k('2026-11-10', 0, 2, { iptal: true, created_at: '2026-11-10T09:00:00Z' })
  assert.deepEqual(gecerliKontroller([ilk, iptal]), [])
  const yeniden = k('2026-11-10', 1, 2, { created_at: '2026-11-10T10:00:00Z' })
  assert.equal(gecerliKontroller([ilk, iptal, yeniden])[0].toplam_yazilan, 1)
})

test('gecerliKontroller girdiyi bozmaz', () => {
  const satirlar = [k('2026-11-17', 1, 2), k('2026-11-10', 0, 2)]
  const kopya = JSON.parse(JSON.stringify(satirlar))
  gecerliKontroller(satirlar)
  assert.deepEqual(satirlar, kopya)
})

// ---------- Bir ödevin durumu ----------
test('ödevsiz bant: otomatik artı sınav tarihiyle; ekstra tek sefer', () => {
  const d25 = odevDurumu({ bant: bantHesapla(girdi(25), 25), sinavTarihi: '2026-10-20' })
  assert.equal(d25.durum, 'odevsiz')
  assert.equal(d25.arti, 2)
  assert.equal(d25.ekstraYapilabilir, true)
  const ekstrali = odevDurumu({
    bant: bantHesapla(girdi(25), 25),
    sinavTarihi: '2026-10-20',
    duzeltmeSatirlari: [duz('ekstra_arti', 1, '2026-10-27'), duz('ekstra_arti', 1, '2026-10-28')],
  })
  assert.equal(ekstrali.arti, 3) // 2 otomatik + 1 ekstra (ikinci ekstra sayılmaz)
  assert.equal(ekstrali.ekstraYapildi, true)
  assert.equal(ekstrali.ekstraYapilabilir, false)
  const d20 = odevDurumu({
    bant: bantHesapla(girdi(20), 25),
    sinavTarihi: '2026-10-20',
    duzeltmeSatirlari: [duz('ekstra_arti', 1, '2026-10-27')],
  })
  assert.equal(d20.arti, 2) // 1 + 1
})

test('yazma bandı: açık ödev, kalan ve ilerleme; tamamlayınca durum tamamlandı', () => {
  const bos = odevDurumu({ bant: yazma(2) })
  assert.deepEqual([bos.durum, bos.kalan, bos.sonToplam, bos.arti, bos.eksi], ['acik', 2, 0, 0, 0])
  const bir = odevDurumu({ bant: yazma(2), kontrolSatirlari: [k('2026-11-10', 1, 2)] })
  assert.deepEqual([bir.durum, bir.kalan, bir.eksi], ['acik', 1, 1])
  const tam = odevDurumu({ bant: yazma(2), kontrolSatirlari: [k('2026-11-10', 0, 2), k('2026-11-17', 1, 2), k('2026-11-24', 2, 2)] })
  assert.deepEqual([tam.durum, tam.kalan, tam.arti, tam.eksi, tam.net], ['tamamlandi', 0, 0, 3, -3])
})

test('ilk kontrolde tamamlayan: +1 artı, durum tamamlandı', () => {
  const d = odevDurumu({ bant: yazma(1), kontrolSatirlari: [k('2026-11-10', 1, 1)] })
  assert.deepEqual([d.durum, d.arti, d.eksi, d.net], ['tamamlandi', 1, 0, 1])
})

test('sınav kaydı yok: belirsiz, artı/eksi yok', () => {
  const d = odevDurumu({ bant: bantHesapla(undefined, 25) })
  assert.deepEqual([d.durum, d.arti, d.eksi, d.kalan], ['belirsiz', 0, 0, null])
})

test('bant sonradan yükselirse: geçmiş kontroller kendi gereken değeriyle kalır, ödev yeniden açılır, bayrak çıkar', () => {
  // 13 doğru → 1 kez; 1 kez yazdı (ilk kontrol, +1). Sonra puan 10'a düzeltildi → 2 kez gerekli.
  const satirlar = [k('2026-11-10', 1, 1)]
  const d = odevDurumu({ bant: yazma(2), kontrolSatirlari: satirlar })
  assert.equal(d.arti, 1) // geçmiş +1 silinmez
  assert.equal(d.durum, 'acik')
  assert.equal(d.kalan, 1)
  assert.equal(d.bantDegisti, true)
  // sonraki kontrol yeni bantla değerlendirilir
  const sonra = odevDurumu({ bant: yazma(2), kontrolSatirlari: [...satirlar, k('2026-11-17', 1, 2)] })
  assert.deepEqual([sonra.arti, sonra.eksi, sonra.kalan], [1, 1, 1])
})

test('bant sonradan düşerse ya da ödevsiz banda geçerse: eski eksiler kalır, bayrak çıkar; geri alma elle düzeltmeyle', () => {
  const satirlar = [k('2026-11-10', 0, 3)] // 3 gerekiyordu, 0 yazdı → -3
  const dusuk = odevDurumu({ bant: yazma(1), kontrolSatirlari: satirlar })
  assert.equal(dusuk.eksi, 3)
  assert.equal(dusuk.bantDegisti, true)
  const odevsiz = odevDurumu({ bant: bantHesapla(girdi(20), 25), sinavTarihi: '2026-10-20', kontrolSatirlari: satirlar })
  assert.equal(odevsiz.durum, 'odevsiz')
  assert.equal(odevsiz.arti, 1)
  assert.equal(odevsiz.eksi, 3)
  assert.equal(odevsiz.bantDegisti, true)
  const geriAlinmis = odevDurumu({
    bant: bantHesapla(girdi(20), 25),
    sinavTarihi: '2026-10-20',
    kontrolSatirlari: satirlar,
    duzeltmeSatirlari: [duz('elle', 3, '2026-11-20', { neden: 'Puan düzeltildi' })],
  })
  assert.deepEqual([geriAlinmis.arti, geriAlinmis.eksi, geriAlinmis.net], [4, 3, 1])
})

test('elle düzeltmeler: artı ve eksi, neden saklanır', () => {
  const d = odevDurumu({
    bant: yazma(2),
    duzeltmeSatirlari: [duz('elle', -1, '2026-11-12', { neden: 'Defter getirmedi' }), duz('elle', 2, '2026-11-13', { neden: 'Hata düzeltme' })],
  })
  assert.deepEqual([d.arti, d.eksi, d.net], [2, 1, 1])
  assert.equal(d.hareketler.find((h) => h.puan === -1).neden, 'Defter getirmedi')
})

// ---------- Liste düzeni ----------
test('liste: açık ödevler üstte, tamamlayanlar altta; her grupta Türkçe A-Z', () => {
  const o = (full_name, durum, student_no = full_name) => ({ full_name, student_no, durum })
  const sirali = odevSatirlariniSirala([
    o('Zeynep', 'tamamlandi'),
    o('Çağla', 'acik'),
    o('Ali', 'odevsiz'),
    o('Veli', 'acik'),
    o('Burak', 'belirsiz'),
    o('Ayşe', 'tamamlandi'),
    o('Can', 'tanimsiz'),
  ]).map((s) => s.full_name)
  assert.deepEqual(sirali, ['Çağla', 'Veli', 'Burak', 'Can', 'Ali', 'Ayşe', 'Zeynep'])
})

test('liste: girdiyi bozmaz', () => {
  const girdiListe = [{ full_name: 'Z', student_no: '1', durum: 'acik' }, { full_name: 'A', student_no: '2', durum: 'acik' }]
  const kopya = [...girdiListe]
  odevSatirlariniSirala(girdiListe)
  assert.deepEqual(girdiListe, kopya)
})

// ---------- Özet ----------
test('özet: dönem filtresi hareketin tarihine göre; tarihsiz yalnızca tümünde sayılır', () => {
  const o2 = odevDurumu({
    bant: bantHesapla(girdi(25), 25),
    sinavTarihi: '2026-12-15', // 1. dönem: +2
    kontrolSatirlari: [],
  })
  const o3 = odevDurumu({
    bant: yazma(2),
    kontrolSatirlari: [k('2027-01-20', 0, 2), k('2027-02-03', 1, 2)], // Ocak: -2 (1. dönem), Şubat: -1 (2. dönem)
  })
  const o4 = odevDurumu({ bant: bantHesapla(girdi(20), 25), sinavTarihi: null }) // tarihsiz +1
  const odevler = [
    { odevUnite: 2, hareketler: o2.hareketler },
    { odevUnite: 3, hareketler: o3.hareketler },
    { odevUnite: 4, hareketler: o4.hareketler },
  ]
  const tumu = ogrenciOzeti(odevler, 'tumu')
  assert.deepEqual([tumu.arti, tumu.eksi, tumu.net, tumu.tarihsiz], [3, 3, 0, 1])
  const d1 = ogrenciOzeti(odevler, 1)
  assert.deepEqual([d1.arti, d1.eksi, d1.net], [2, 2, 0])
  const d2 = ogrenciOzeti(odevler, 2)
  assert.deepEqual([d2.arti, d2.eksi, d2.net], [0, 1, -1])
  assert.equal(d2.tarihsiz, 1) // tarihsiz hareket her durumda bildirilir
  assert.deepEqual(tumu.unite.map((u) => [u.odevUnite, u.arti, u.eksi]), [[2, 2, 0], [3, 0, 3], [4, 1, 0]])
})

test('özet: ocak/şubat sınırı kontrol tarihine göre', () => {
  const d = odevDurumu({ bant: yazma(1), kontrolSatirlari: [k('2027-01-31', 0, 1), k('2027-02-01', 0, 1)] })
  const ozet = ogrenciOzeti([{ odevUnite: 3, hareketler: d.hareketler }], 1)
  assert.equal(ozet.eksi, 1) // yalnızca 31 Ocak
  assert.equal(ogrenciOzeti([{ odevUnite: 3, hareketler: d.hareketler }], 2).eksi, 1) // yalnızca 1 Şubat
})
