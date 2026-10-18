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
  istanbulBugunu,
  hizliDugmeler,
  yapildiMi,
  secimDegistir,
  satirDegisti,
  satirAlanlari,
  gorunenSatirlar,
  kontrolOnizleme,
  kaydedilecekKontroller,
  ekstraVarMi,
  kaydedilecekEkstralar,
  iptalSatiri,
  elleDuzeltmeDogrula,
  elleDuzeltmeSatiri,
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

// ======================== Sayfa yardımcıları (Aşama 3a) ========================

test('İstanbul günü: UTC 21:00 ve sonrası ertesi gündür (gün sınırı)', () => {
  assert.equal(istanbulBugunu(new Date('2026-11-10T20:59:59Z')), '2026-11-10')
  assert.equal(istanbulBugunu(new Date('2026-11-10T21:00:00Z')), '2026-11-11')
  assert.equal(istanbulBugunu(new Date('2026-11-10T23:30:00Z')), '2026-11-11')
  assert.equal(istanbulBugunu(new Date('2026-11-11T00:00:00Z')), '2026-11-11')
})

test('İstanbul günü: ay ve yıl sınırları; sayı/metin girdisi; geçersiz girdi null', () => {
  assert.equal(istanbulBugunu(new Date('2026-12-31T21:30:00Z')), '2027-01-01')
  assert.equal(istanbulBugunu(new Date('2026-03-31T21:00:00Z')), '2026-04-01')
  assert.equal(istanbulBugunu(new Date('2028-02-28T21:00:00Z')), '2028-02-29') // artık yıl
  assert.equal(istanbulBugunu(Date.UTC(2026, 10, 10, 21, 0)), '2026-11-11')
  assert.equal(istanbulBugunu('2026-11-10T21:00:00Z'), '2026-11-11')
  assert.equal(istanbulBugunu('geçersiz'), null)
})

test('İstanbul günü: ileri tarih denetimiyle birlikte (UTC 22:00 = İstanbul ertesi gün, o gün seçilebilir)', () => {
  const bugun = istanbulBugunu(new Date('2026-11-10T22:00:00Z')) // 11 Kasım 01:00 İstanbul
  assert.equal(bugun, '2026-11-11')
  assert.equal(kontrolTarihiDogrula('2026-11-11', bugun).gecerli, true)
  assert.equal(kontrolTarihiDogrula('2026-11-12', bugun).gecerli, false)
})

test('hızlı düğmeler: 0\'dan gerekene kadar', () => {
  assert.deepEqual(hizliDugmeler(1), [0, 1])
  assert.deepEqual(hizliDugmeler(3), [0, 1, 2, 3])
  assert.deepEqual(hizliDugmeler(5), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(hizliDugmeler(0), [])
  assert.deepEqual(hizliDugmeler(null), [])
  assert.deepEqual(hizliDugmeler(undefined), [])
})

test('yapıldı/yapılmadı: gerekene ulaştı mı; seçim yoksa null', () => {
  assert.equal(yapildiMi(3, 3), true)
  assert.equal(yapildiMi(4, 3), true)
  assert.equal(yapildiMi(2, 3), false)
  assert.equal(yapildiMi(0, 1), false)
  assert.equal(yapildiMi(undefined, 3), null)
})

test('seçim değiştirme: yeni seçim, bekleyen seçimi geri alma, kayıtlı değer geri alınamaz', () => {
  assert.equal(secimDegistir(undefined, 2, undefined), 2) // ilk tıklama
  assert.equal(secimDegistir(2, 3, undefined), 3) // başka düğme
  assert.equal(secimDegistir(2, 2, undefined), undefined) // bekleyen seçime yeniden basmak: geri al
  assert.equal(secimDegistir(3, 3, 2), 2) // bekleyen (kayıtlı 2'den farklı) seçim: kayıtlı değere dön
  assert.equal(secimDegistir(2, 2, 2), 2) // kayıtlı değere basmak bir şey değiştirmez
  assert.equal(secimDegistir(1, 2, 2), 2) // kayıtlıya geri dönmek serbest
})

test('satır değişti mi: yeni ya da farklı seçim, bekleyen ekstra', () => {
  assert.equal(satirDegisti(undefined, undefined, false), false)
  assert.equal(satirDegisti(2, undefined, false), true)
  assert.equal(satirDegisti(2, 2, false), false)
  assert.equal(satirDegisti(3, 2, false), true)
  assert.equal(satirDegisti(undefined, 2, false), false) // kayıtlı olan, kaydedilecek bir şey değil
  assert.equal(satirDegisti(undefined, undefined, true), true)
  assert.equal(satirDegisti(2, 2, true), true)
})

test('satır alanları: sınıf modu yalnızca ad, düğmeler ve yapıldı/yapılmadı; gizlenenler', () => {
  const sinif = satirAlanlari('acik', true)
  assert.deepEqual([sinif.dugmeler, sinif.yapildiRozeti, sinif.gereken, sinif.oncekiToplam, sinif.hesap, sinif.bantDegistiRozeti], [true, true, false, false, false, false])
  const ogretmen = satirAlanlari('acik', false)
  assert.deepEqual([ogretmen.dugmeler, ogretmen.yapildiRozeti, ogretmen.gereken, ogretmen.oncekiToplam, ogretmen.hesap, ogretmen.bantDegistiRozeti], [true, false, true, true, true, true])
  assert.equal(satirAlanlari('tamamlandi', true).dugmeler, true)
})

test('satır alanları: "Ödev yok" iki modda da görünür; "Sonuç bekleniyor" ve tanımsız yalnızca öğretmen modunda', () => {
  assert.equal(satirAlanlari('odevsiz', true).etiket, 'Ödev yok')
  assert.equal(satirAlanlari('odevsiz', false).etiket, 'Ödev yok')
  assert.equal(satirAlanlari('belirsiz', true).etiket, null)
  assert.equal(satirAlanlari('belirsiz', false).etiket, 'Sonuç bekleniyor')
  assert.equal(satirAlanlari('tanimsiz', true).etiket, null)
  assert.match(satirAlanlari('tanimsiz', false).etiket, /tanımsız/)
  // düğme yalnızca yazma bandında; ekstra yalnızca ödevsizde (iki modda da)
  for (const mod of [true, false]) {
    assert.equal(satirAlanlari('odevsiz', mod).dugmeler, false)
    assert.equal(satirAlanlari('odevsiz', mod).ekstra, true)
    assert.equal(satirAlanlari('belirsiz', mod).dugmeler, false)
    assert.equal(satirAlanlari('acik', mod).ekstra, false)
  }
})

test('tamamlananları gizle', () => {
  const l = [{ durum: 'acik' }, { durum: 'tamamlandi' }, { durum: 'odevsiz' }]
  assert.equal(gorunenSatirlar(l, false).length, 3)
  assert.deepEqual(gorunenSatirlar(l, true).map((s) => s.durum), ['acik', 'odevsiz'])
})

test('önizleme: ilk kontrol, kalan 0 → +1; kalan > 0 → -kalan; sonraki kontrol, kalan 0 → tamamlandı', () => {
  const bant = yazma(2)
  assert.equal(kontrolOnizleme({ bant, tarih: '2026-11-10', secim: 2 }).etiket, '+1')
  assert.equal(kontrolOnizleme({ bant, tarih: '2026-11-10', secim: 0 }).etiket, '-2')
  assert.equal(kontrolOnizleme({ bant, tarih: '2026-11-10', secim: 1 }).etiket, '-1')
  const onceki = [k('2026-11-10', 0, 2)]
  assert.equal(kontrolOnizleme({ bant, kontrolSatirlari: onceki, tarih: '2026-11-17', secim: 1 }).etiket, '-1')
  assert.equal(kontrolOnizleme({ bant, kontrolSatirlari: onceki, tarih: '2026-11-17', secim: 2 }).etiket, 'tamamlandı')
})

test('önizleme: seçim yok, ödevsiz ve belirsiz bantta önizleme yok; aynı tarihteki kayıtlı satırın yerine geçer', () => {
  assert.equal(kontrolOnizleme({ bant: yazma(2), tarih: '2026-11-10', secim: undefined }).etiket, null)
  assert.equal(kontrolOnizleme({ bant: { tur: 'odevsiz', otomatikArti: 1 }, tarih: '2026-11-10', secim: 1 }).etiket, null)
  assert.equal(kontrolOnizleme({ bant: { tur: 'belirsiz' }, tarih: '2026-11-10', secim: 1 }).etiket, null)
  // kayıtlı 0 (−2) iken aynı tarihte 2 seçilirse önizleme +1 (kayıtlı satır geçici satırla değişmiş sayılır)
  const kayitli = [k('2026-11-10', 0, 2)]
  const o = kontrolOnizleme({ bant: yazma(2), kontrolSatirlari: kayitli, tarih: '2026-11-10', secim: 2 })
  assert.equal(o.etiket, '+1')
})

test('önizleme: geriye dönük tarih, ilk kontrolü kaydırır', () => {
  // 17'si kayıtlı (kalan 0, ilk kontrol → +1). 10'u için seçim 1 yapılırsa 10 ilk kontrol olur (-1), 17 artık "tamamlandı"
  const kayitli = [k('2026-11-17', 2, 2)]
  const o = kontrolOnizleme({ bant: yazma(2), kontrolSatirlari: kayitli, tarih: '2026-11-10', secim: 1 })
  assert.equal(o.etiket, '-1')
})

test('önizleme gerçek kayıtları değiştirmez', () => {
  const kayitli = [k('2026-11-10', 0, 2)]
  const kopya = JSON.parse(JSON.stringify(kayitli))
  kontrolOnizleme({ bant: yazma(2), kontrolSatirlari: kayitli, tarih: '2026-11-17', secim: 1 })
  assert.deepEqual(kayitli, kopya)
})

const ogr = (id, bant, kontrolSatirlari = [], duzeltmeSatirlari = []) => ({ student_id: id, bant, kontrolSatirlari, duzeltmeSatirlari })

test('kaydedilecek kontroller: yeni seçim yazılır, gereken güncel banttan; kayıtlıyla aynı olan yazılmaz', () => {
  const r = kaydedilecekKontroller({
    ogrenciler: [
      ogr('a', yazma(3)), // seçim 1 → yazılır
      ogr('b', yazma(2), [k('2026-11-10', 1, 2)]), // kayıtlı 1, seçim 1 → yazılmaz
      ogr('c', yazma(2), [k('2026-11-10', 1, 2)]), // kayıtlı 1, seçim 2 → yazılır (düzeltme)
      ogr('d', yazma(2)), // seçim yok → yazılmaz
    ],
    secimler: { a: 1, b: 1, c: 2 },
    tarih: '2026-11-10',
    kaynakExamId: 'E1',
  })
  assert.deepEqual(r.yazilacak, [
    { student_id: 'a', kaynak_exam_id: 'E1', kontrol_tarihi: '2026-11-10', toplam_yazilan: 1, gereken: 3, iptal: false },
    { student_id: 'c', kaynak_exam_id: 'E1', kontrol_tarihi: '2026-11-10', toplam_yazilan: 2, gereken: 2, iptal: false },
  ])
  assert.equal(r.gecersiz, 0)
})

test('kaydedilecek kontroller: yazma bandında olmayanlar yazılmaz; geçersiz toplam yazılmaz ve sayılır', () => {
  const r = kaydedilecekKontroller({
    ogrenciler: [ogr('a', { tur: 'odevsiz', otomatikArti: 2 }), ogr('b', { tur: 'belirsiz' }), ogr('c', { tur: 'tanimsiz', neden: 'soru-sayisi' }), ogr('d', yazma(2))],
    secimler: { a: 1, b: 1, c: 1, d: 99 },
    tarih: '2026-11-10',
    kaynakExamId: 'E1',
  })
  assert.deepEqual(r.yazilacak, [])
  assert.equal(r.gecersiz, 1)
})

test('kaydedilecek kontroller: iptal edilmiş eski kayıt yoksa sayılır, yeni seçim yazılır; bant yazma ama seçim 0 da yazılır', () => {
  const iptalliKayit = [k('2026-11-10', 1, 2, { created_at: '2026-11-10T08:00:00Z' }), k('2026-11-10', 1, 2, { iptal: true, created_at: '2026-11-10T09:00:00Z' })]
  const r = kaydedilecekKontroller({
    ogrenciler: [ogr('a', yazma(2), iptalliKayit), ogr('b', yazma(2))],
    secimler: { a: 1, b: 0 },
    tarih: '2026-11-10',
    kaynakExamId: 'E1',
  })
  assert.deepEqual(r.yazilacak.map((y) => [y.student_id, y.toplam_yazilan]), [['a', 1], ['b', 0]])
})

test('kaydedilecek ekstralar: yalnızca ödevsiz bantta, tek sefer; tarih = kontrol tarihi', () => {
  const odevsiz = { tur: 'odevsiz', otomatikArti: 1 }
  const r = kaydedilecekEkstralar({
    ogrenciler: [
      ogr('a', odevsiz),
      ogr('b', odevsiz, [], [duz('ekstra_arti', 1, '2026-11-03')]), // zaten yapılmış
      ogr('c', yazma(2)), // yazma bandı: ekstra yok
      ogr('d', { tur: 'belirsiz' }),
      ogr('e', odevsiz), // işaretlenmemiş
    ],
    ekstraSecimleri: { a: true, b: true, c: true, d: true, e: false },
    tarih: '2026-11-10',
    kaynakExamId: 'E1',
  })
  assert.deepEqual(r, [{ student_id: 'a', kaynak_exam_id: 'E1', tur: 'ekstra_arti', puan: 1, tarih: '2026-11-10', neden: null }])
  assert.equal(ekstraVarMi([duz('elle', 1, '2026-11-03')]), false)
  assert.equal(ekstraVarMi([duz('ekstra_arti', 1, '2026-11-03')]), true)
  assert.equal(ekstraVarMi(undefined), false)
})

test('iptal satırı: tarihteki geçerli kaydın değerleriyle iptal=true; kayıt yoksa null', () => {
  const kayit = [k('2026-11-10', 1, 2), k('2026-11-17', 2, 2)]
  assert.deepEqual(iptalSatiri({ studentId: 's1', kaynakExamId: 'E1', kontrolSatirlari: kayit, tarih: '2026-11-10' }), {
    student_id: 's1',
    kaynak_exam_id: 'E1',
    kontrol_tarihi: '2026-11-10',
    toplam_yazilan: 1,
    gereken: 2,
    iptal: true,
  })
  assert.equal(iptalSatiri({ studentId: 's1', kaynakExamId: 'E1', kontrolSatirlari: kayit, tarih: '2026-11-24' }), null)
  // zaten iptal edilmiş tarih için tekrar iptal satırı üretilmez
  const iptalli = [k('2026-11-10', 1, 2, { created_at: '2026-11-10T08:00:00Z' }), k('2026-11-10', 1, 2, { iptal: true, created_at: '2026-11-10T09:00:00Z' })]
  assert.equal(iptalSatiri({ studentId: 's1', kaynakExamId: 'E1', kontrolSatirlari: iptalli, tarih: '2026-11-10' }), null)
})

test('elle düzeltme doğrulaması: puan sıfırdan farklı tam sayı, neden zorunlu, tarih geçerli ve ileri değil', () => {
  const bugun = '2026-11-10'
  assert.equal(elleDuzeltmeDogrula({ puan: 2, neden: 'Puan düzeltildi', tarih: bugun, bugun }).gecerli, true)
  assert.equal(elleDuzeltmeDogrula({ puan: -1, neden: 'Defter yok', tarih: '2026-11-01', bugun }).gecerli, true)
  assert.equal(elleDuzeltmeDogrula({ puan: 0, neden: 'x', tarih: bugun, bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1.5, neden: 'x', tarih: bugun, bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1, neden: '', tarih: bugun, bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1, neden: '   ', tarih: bugun, bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1, neden: undefined, tarih: bugun, bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1, neden: 'x', tarih: '2026-11-11', bugun }).gecerli, false)
  assert.equal(elleDuzeltmeDogrula({ puan: 1, neden: 'x', tarih: '', bugun }).gecerli, false)
  const buyuk = elleDuzeltmeDogrula({ puan: 11, neden: 'x', tarih: bugun, bugun })
  assert.equal(buyuk.gecerli, true)
  assert.match(buyuk.uyari, /Emin misin/)
})

test('elle düzeltme satırı: neden kırpılır, tür elle', () => {
  assert.deepEqual(elleDuzeltmeSatiri({ studentId: 's1', kaynakExamId: 'E1', puan: -2, neden: '  Geri alındı  ', tarih: '2026-11-10' }), {
    student_id: 's1',
    kaynak_exam_id: 'E1',
    tur: 'elle',
    puan: -2,
    tarih: '2026-11-10',
    neden: 'Geri alındı',
  })
})

// ======================== Ödev Özeti (Aşama 4a) ========================
import {
  hareketAciklamasi,
  ogrenciDokumu,
  ozetSatirlariniHazirla,
  ozetSirala,
  ozetToplami,
  sinavUyarilari,
} from '../src/lib/odev.js'

// sahte sezon: iki sınav (1. ve 2. ünite), 25 soru
const SINAV1 = { id: 'E1', unit_no: 1, exam_date: '2026-10-20', question_count: 25 }
const SINAV2 = { id: 'E2', unit_no: 2, exam_date: '2027-01-26', question_count: 25 }
const ogrenci = (id, ad, no, sube = 'A', aktif = true) => ({ id, full_name: ad, student_no: no, class_name: sube, is_active: aktif })
const puan = (exam, ogr, dogru, status = 'girdi') => ({ exam_id: exam, student_id: ogr, status, correct_count: status === 'girdi' ? dogru : null })
const kon = (ogr, exam, tarih, toplam, gereken, ek = {}) => ({ id: `k${++sayac}`, student_id: ogr, kaynak_exam_id: exam, kontrol_tarihi: tarih, toplam_yazilan: toplam, gereken, iptal: false, created_at: `2026-11-01T10:00:${String(sayac).padStart(2, '0')}Z`, ...ek })
const dz = (ogr, exam, tur, p, tarih, neden = null) => ({ id: `d${++sayac}`, student_id: ogr, kaynak_exam_id: exam, tur, puan: p, tarih, neden, created_at: `2026-11-02T10:00:${String(sayac).padStart(2, '0')}Z` })

function ornekVeri() {
  return {
    ogrenciler: [ogrenci('z', 'Zeynep Çelik', '3'), ogrenci('a', 'Ali Yılmaz', '1'), ogrenci('c', 'Çağla Öz', '2'), ogrenci('g', 'Ayrılan Öğrenci', '9', 'A', false)],
    sinavlar: [SINAV2, SINAV1], // sırasız verilir
    puanlar: [
      puan('E1', 'z', 25), // +2 otomatik (20 Ekim: 1. dönem)
      puan('E1', 'a', 10), // 2 gerekli
      puan('E1', 'c', 20), // +1 otomatik
      puan('E2', 'c', 3), // 4 gerekli (2. ünite sonucu → 3. ünite ödevi)
    ],
    kontroller: [
      kon('a', 'E1', '2026-11-03', 0, 2), // -2 (1. dönem)
      kon('a', 'E1', '2026-11-10', 1, 2), // -1
      kon('c', 'E2', '2027-02-02', 1, 4), // -3 (2. dönem)
      kon('c', 'E2', '2027-02-09', 2, 4, { iptal: true, created_at: '2027-02-09T12:00:00Z' }), // iptal edilmiş
    ],
    duzeltmeler: [dz('z', 'E1', 'ekstra_arti', 1, '2026-10-27'), dz('a', 'E1', 'elle', 2, '2026-11-20', 'Puan düzeltildi')],
  }
}

test('özet: artı, eksi, net; ekstra, elle düzeltme sayılır; iptal edilen kayıt sayılmaz; A-Z sıralı', () => {
  const s = ozetSatirlariniHazirla({ ...ornekVeri(), donem: 'tumu' })
  assert.deepEqual(s.map((x) => x.full_name), ['Ali Yılmaz', 'Ayrılan Öğrenci', 'Çağla Öz', 'Zeynep Çelik'])
  const al = (ad) => s.find((x) => x.full_name === ad)
  assert.deepEqual([al('Zeynep Çelik').arti, al('Zeynep Çelik').eksi, al('Zeynep Çelik').net], [3, 0, 3]) // 2 otomatik + 1 ekstra
  assert.deepEqual([al('Ali Yılmaz').arti, al('Ali Yılmaz').eksi, al('Ali Yılmaz').net], [2, 3, -1]) // elle +2; eksi 2+1
  // Çağla: 1. ünite 20 doğru → +1 otomatik; 2. ünite 3 doğru → 4 gerekli, kontrol 1 → -3 (iptal edilen 9 Şubat sayılmaz)
  assert.deepEqual([al('Çağla Öz').arti, al('Çağla Öz').eksi, al('Çağla Öz').net], [1, 3, -2])
  assert.equal(al('Ayrılan Öğrenci').aktif, false)
  assert.deepEqual([al('Ayrılan Öğrenci').arti, al('Ayrılan Öğrenci').eksi], [0, 0]) // sınav kaydı yok: belirsiz
})

test('özet: dönem süzgeci hareketin tarihine göre', () => {
  const al = (d, ad) => ozetSatirlariniHazirla({ ...ornekVeri(), donem: d }).find((x) => x.full_name === ad)
  // Çağla: +1 (Ekim, 1. dönem), -3 (Şubat, 2. dönem)
  assert.deepEqual([al(1, 'Çağla Öz').arti, al(1, 'Çağla Öz').eksi], [1, 0])
  assert.deepEqual([al(2, 'Çağla Öz').arti, al(2, 'Çağla Öz').eksi], [0, 3])
  // Ali: tüm hareketleri 1. dönemde (Kasım)
  assert.deepEqual([al(1, 'Ali Yılmaz').arti, al(1, 'Ali Yılmaz').eksi], [2, 3])
  assert.deepEqual([al(2, 'Ali Yılmaz').arti, al(2, 'Ali Yılmaz').eksi], [0, 0])
})

test('özet: Ödev Kontrolü ile aynı sayılar (odevDurumu ile birebir)', () => {
  const v = ornekVeri()
  const s = ozetSatirlariniHazirla({ ...v, donem: 'tumu' }).find((x) => x.full_name === 'Ali Yılmaz')
  const d = odevDurumu({
    bant: bantHesapla(v.puanlar.find((p) => p.exam_id === 'E1' && p.student_id === 'a'), 25),
    sinavTarihi: SINAV1.exam_date,
    kontrolSatirlari: v.kontroller.filter((x) => x.student_id === 'a'),
    duzeltmeSatirlari: v.duzeltmeler.filter((x) => x.student_id === 'a'),
  })
  assert.deepEqual([s.arti, s.eksi, s.net], [d.arti, d.eksi, d.net])
})

test('özet: tarihsiz hareket yalnızca tümünde sayılır ve her durumda bildirilir', () => {
  const v = ornekVeri()
  v.sinavlar = [{ ...SINAV1, exam_date: null }, SINAV2]
  const z = (donem) => ozetSatirlariniHazirla({ ...v, donem }).find((x) => x.full_name === 'Zeynep Çelik')
  assert.deepEqual([z('tumu').arti, z('tumu').tarihsiz], [3, 1]) // otomatik +2 tarihsiz; ekstra +1 tarihli
  assert.deepEqual([z(1).arti, z(1).tarihsiz], [1, 1]) // yalnızca ekstra (Ekim)
  assert.deepEqual([z(2).arti, z(2).tarihsiz], [0, 1])
})

test('özet: girdi dizileri bozulmaz', () => {
  const v = ornekVeri()
  const kopya = JSON.parse(JSON.stringify(v))
  ozetSatirlariniHazirla({ ...v, donem: 'tumu' })
  assert.deepEqual(v, kopya)
})

test('özet: sıralama ölçütleri (ad / net azalan / net artan; eşitlikte ad)', () => {
  const s = ozetSatirlariniHazirla({ ...ornekVeri(), donem: 'tumu' })
  assert.deepEqual(ozetSirala(s, 'ad').map((x) => x.full_name), ['Ali Yılmaz', 'Ayrılan Öğrenci', 'Çağla Öz', 'Zeynep Çelik'])
  assert.deepEqual(ozetSirala(s, 'net-azalan').map((x) => x.full_name), ['Zeynep Çelik', 'Ayrılan Öğrenci', 'Ali Yılmaz', 'Çağla Öz']) // 3, 0, -1, -2
  assert.deepEqual(ozetSirala(s, 'net-artan').map((x) => x.full_name), ['Çağla Öz', 'Ali Yılmaz', 'Ayrılan Öğrenci', 'Zeynep Çelik'])
  assert.deepEqual(ozetSirala(s).map((x) => x.full_name), ozetSirala(s, 'ad').map((x) => x.full_name))
  const esit = [{ net: 1, full_name: 'Çağla', student_no: '2' }, { net: 1, full_name: 'Ali', student_no: '1' }, { net: 1, full_name: 'Zeynep', student_no: '3' }]
  assert.deepEqual(ozetSirala(esit, 'net-azalan').map((x) => x.full_name), ['Ali', 'Çağla', 'Zeynep'])
})

test('özet toplamı', () => {
  const s = ozetSatirlariniHazirla({ ...ornekVeri(), donem: 'tumu' })
  assert.deepEqual(ozetToplami(s), { ogrenci: 4, arti: 6, eksi: 6, net: 0, tarihsiz: 0 })
  assert.deepEqual(ozetToplami([]), { ogrenci: 0, arti: 0, eksi: 0, net: 0, tarihsiz: 0 })
})

test('döküm: ünite, tarih, tür, puan, açıklama; sıra ve dönem süzgeci', () => {
  const s = ozetSatirlariniHazirla({ ...ornekVeri(), donem: 'tumu' }).find((x) => x.full_name === 'Ali Yılmaz')
  assert.deepEqual(
    s.dokum.map((d) => [d.odevUnite, d.tarih, d.turAdi, d.puan, d.aciklama]),
    [
      [2, '2026-11-03', 'Kontrol', -2, '2 gerekli, 0 yazdı'],
      [2, '2026-11-10', 'Kontrol', -1, '2 gerekli, 1 yazdı'],
      [2, '2026-11-20', 'Elle düzeltme', 2, 'Puan düzeltildi'],
    ]
  )
  const cagla = ozetSatirlariniHazirla({ ...ornekVeri(), donem: 2 }).find((x) => x.full_name === 'Çağla Öz')
  assert.deepEqual(cagla.dokum.map((d) => [d.odevUnite, d.puan]), [[3, -3]]) // yalnızca 2. dönem
})

test('döküm: tarihsiz satır sonda ve işaretli; yalnızca tümünde yer alır', () => {
  const odevler = [{ odevUnite: 2, hareketler: [{ tur: 'otomatik', puan: 2, tarih: null }, { tur: 'ekstra', puan: 1, tarih: '2026-10-27', neden: null }] }]
  const tumu = ogrenciDokumu(odevler, 'tumu')
  assert.deepEqual(tumu.map((d) => [d.tur, d.tarihsiz]), [['ekstra', false], ['otomatik', true]])
  assert.equal(ogrenciDokumu(odevler, 1).length, 1)
  assert.equal(ogrenciDokumu(odevler, 2).length, 0)
  assert.equal(hareketAciklamasi({ tur: 'kontrol', gereken: 3, toplam: 1 }), '3 gerekli, 1 yazdı')
  assert.equal(hareketAciklamasi({ tur: 'elle', neden: 'x' }), 'x')
})

test('kontrol hareketleri toplam ve gereken taşır (döküm açıklaması için)', () => {
  const d = odevDurumu({ bant: yazma(3), kontrolSatirlari: [k('2026-11-10', 1, 3)] })
  const h = d.hareketler.find((x) => x.tur === 'kontrol')
  assert.deepEqual([h.puan, h.toplam, h.gereken], [-2, 1, 3])
})

test('sınav uyarıları: tarihi girilmemiş (otomatik artı varsa) ve 25 soru olmayan sınavlar adıyla', () => {
  const sinavlar = [
    { id: 'E1', unit_no: 1, exam_date: null, question_count: 25 },
    { id: 'E2', unit_no: 2, exam_date: '2027-01-26', question_count: 25 },
    { id: 'E3', unit_no: 3, exam_date: null, question_count: 20 },
    { id: 'E4', unit_no: 4, exam_date: null, question_count: 25 }, // puan kaydı yok: uyarı yok
    { id: 'E5', unit_no: 5, exam_date: null, question_count: 25 }, // yalnızca yazma bandı: otomatik artı yok, tarih önemsiz
  ]
  const puanlar = [puan('E1', 'a', 25), puan('E2', 'a', 25), puan('E3', 'a', 10), puan('E5', 'a', 5)]
  const u = sinavUyarilari(sinavlar, puanlar)
  assert.deepEqual(u.tarihsiz.map((x) => x.mesaj), ['1. ünite sınavının tarihi girilmemiş: otomatik artılar dönemlere ayrılamıyor'])
  assert.equal(u.tanimsiz.length, 1)
  assert.match(u.tanimsiz[0].mesaj, /^3\. ünite sınavı 20 soru: ödev bantları 25 soruluk sınav içindir/)
  assert.deepEqual(sinavUyarilari(sinavlar, []), { tarihsiz: [], tanimsiz: [] })
})
