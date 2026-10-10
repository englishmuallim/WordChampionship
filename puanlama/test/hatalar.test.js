import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hataMetni, sunucuMesajiniCevir } from '../src/lib/hatalar.js'

// hataMetni hata ayıklama için console.error yazar; test çıktısını kirletmesin
const orijinalHata = console.error
const sessiz = (fn) => {
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.error = orijinalHata
  }
}

test('sunucu mesajı: kademe koruması öğrenci numarasıyla ve nedeniyle anlatılır', () => {
  const m = sunucuMesajiniCevir('Aktif sezonda puan kaydı olan öğrencinin kademesi değiştirilemez (öğrenci no: 99003).')
  assert.match(m, /^99003 numaralı öğrencinin aktif sezonda puan kaydı olduğu için kademesi değiştirilemez/)
  assert.match(m, /sıralamasına taşınırdı/)
})

test('sunucu mesajı: "Hiçbir değişiklik yapılmadı" sayılarla ve ne yapılacağıyla anlatılır', () => {
  const m = sunucuMesajiniCevir(
    'Seçilen 5 öğrenciden yalnızca 3 tanesi güncellenebildi (zaten ayrılmış ya da bulunamadı). Hiçbir değişiklik yapılmadı.'
  )
  assert.match(m, /Seçilen 5 öğrenciden yalnızca 3 tanesi işlenebildi/)
  assert.match(m, /Hiçbir değişiklik yapılmadı/)
  assert.match(m, /Sayfayı yenileyip tekrar dene/)
  // geri alma fonksiyonunun mesajı da aynı kalıba uyar
  assert.match(
    sunucuMesajiniCevir('Seçilen 2 öğrenciden yalnızca 0 tanesi geri alınabildi (zaten aktif ya da bulunamadı). Hiçbir değişiklik yapılmadı.'),
    /yalnızca 0 tanesi işlenebildi/
  )
})

test('sunucu mesajı: yönetici yetkisi; tanınmayan mesaj olduğu gibi döner', () => {
  assert.equal(sunucuMesajiniCevir('Bu işlem için yönetici yetkisi gerekir.'), 'Bu işlem için yönetici yetkisi gerekir.')
  for (const m of ['Ayrılma tarihi gelecekte olamaz.', 'Öğrenci listesi boş.', 'Kademe 5 ile 8 arasında olmalı.', 'Şube tek bir harf olmalı.']) {
    assert.equal(sunucuMesajiniCevir(m), m)
  }
  assert.equal(sunucuMesajiniCevir(undefined), '')
})

test('hataMetni: öğrenci numarası tekrarı (23505) ve puanlı öğrenciyi silme (23503) bağlama göre', () => {
  sessiz(() => {
    assert.equal(hataMetni({ code: '23505' }, { tur: 'ogrenci', no: '99001' }), 'Bu öğrenci numarası zaten kayıtlı (99001).')
    assert.equal(hataMetni({ code: '23505' }, { tur: 'ogrenci' }), 'Bu öğrenci numarası zaten kayıtlı.')
    assert.equal(hataMetni({ code: '23503' }, { tur: 'ogrenci' }), 'Bu öğrencinin puan kaydı olduğu için silinemez.')
    // diğer bağlamlar değişmedi
    assert.equal(hataMetni({ code: '23505' }, { tur: 'sinav', grade: 5, unit: 2 }), '5. kademe için 2. ünite bu sezonda zaten tanımlı.')
    assert.equal(hataMetni({ code: '23505' }, { tur: 'sezon' }), 'Bu adda başka bir sezon zaten var.')
    assert.equal(hataMetni({ code: '23503' }), 'Bu kayda bağlı puan kaydı olduğu için silinemez.')
    assert.equal(hataMetni({ code: '23505' }), 'Bu kayıt zaten var.')
  })
})

test('hataMetni: tetikleyici hatası (P0001) anlaşılır Türkçeye çevrilir; yetki ve bilinmeyen hatalar', () => {
  sessiz(() => {
    const m = hataMetni({
      code: 'P0001',
      message: 'Aktif sezonda puan kaydı olan öğrencinin kademesi değiştirilemez (öğrenci no: 99003).',
    })
    assert.match(m, /99003 numaralı öğrencinin/)
    assert.equal(hataMetni({ code: '42501' }), 'Bu işlem için yetkiniz yok.')
    assert.equal(hataMetni({ code: '23514' }), 'Girilen değerler geçersiz. Alanları kontrol edin.')
    assert.match(hataMetni({ code: 'XX000' }), /Beklenmeyen bir hata/)
    assert.equal(hataMetni(null), '')
  })
})
