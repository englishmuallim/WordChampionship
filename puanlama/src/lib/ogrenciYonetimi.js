// Öğrenci yönetimi mantığı (arayüzden bağımsız, saf fonksiyonlar).
// Tek öğrenci ekleme/düzenleme/silme kuralları. Alan kuralları ogrenciDogrulama.js'tedir
// ve içe aktarmayla ortaktır.
import { alanlariDogrula } from './ogrenciDogrulama.js'

// ---------------------------------------------------------------------------------------------
// Puan kaydı sayıları  (wc_ogrenci_puan_sayilari fonksiyonunun çıktısı)
// ---------------------------------------------------------------------------------------------

// rpc satırları [{ student_id, toplam, aktif_sezon }] -> Map(id -> { toplam, aktifSezon }).
// Yalnızca puan kaydı olan öğrenciler gelir; haritada olmayan öğrencinin puanı yoktur.
export function puanSayilariHaritasi(satirlar) {
  return new Map(satirlar.map((r) => [r.student_id, { toplam: r.toplam, aktifSezon: r.aktif_sezon }]))
}

// puanSayilari null ise "bilinmiyor" demektir (sayılar alınamadı): güvenli tarafta kalınır.
export function puanBilgisi(ogrenciId, puanSayilari) {
  if (!puanSayilari) return null
  return puanSayilari.get(ogrenciId) ?? { toplam: 0, aktifSezon: 0 }
}

// Aktif sezonda puan kaydı olan öğrencinin kademesi değiştirilemez (veritabanı tetikleyicisi de engeller).
export function kademeKilidi(ogrenciId, puanSayilari) {
  const p = puanBilgisi(ogrenciId, puanSayilari)
  if (!p) return { kilitli: true, neden: 'Puan bilgisi alınamadığı için kademe şimdilik değiştirilemez.' }
  if (p.aktifSezon > 0) {
    return { kilitli: true, neden: `Aktif sezonda ${p.aktifSezon} puan kaydı olduğu için kademe değiştirilemez.` }
  }
  return { kilitli: false, neden: '' }
}

// Yalnızca hiç puan kaydı olmayan öğrenci silinebilir (yanlış eklenmiş kayıt için). Puan silinemez.
export function silmeDurumu(ogrenciId, puanSayilari) {
  const p = puanBilgisi(ogrenciId, puanSayilari)
  if (!p) return { izin: false, neden: 'Puan bilgisi alınamadığı için şimdilik silinemez.' }
  if (p.toplam > 0) return { izin: false, neden: `Puan kaydı olduğu için silinemez (${p.toplam} kayıt).` }
  return { izin: true, neden: '' }
}

export function silmeOnayMetni(ogrenci) {
  return `${ogrenci.full_name} (${ogrenci.student_no}) silinecek. Bu işlem geri alınamaz. Emin misiniz?`
}

// ---------------------------------------------------------------------------------------------
// Tek öğrenci formu
// ---------------------------------------------------------------------------------------------

export function bosForm() {
  return { student_no: '', full_name: '', grade: '5', class_name: '' }
}

export function formdanOgrenci(o) {
  return {
    student_no: o.student_no ?? '',
    full_name: o.full_name ?? '',
    grade: String(o.grade ?? ''),
    class_name: o.class_name ?? '',
  }
}

// Hata kodunun hangi form alanına ait olduğu (hata mesajı o alanın altında gösterilir)
const KOD_ALANI = {
  no_bos: 'no',
  no_gecersiz: 'no',
  no_tekrar: 'no',
  ad_bos: 'ad',
  ad_uzun: 'ad',
  kademe_gecersiz: 'kademe',
  kademe_birlesik: 'kademe',
  kademe_kilitli: 'kademe',
  sube_bos: 'sube',
  sube_gecersiz: 'sube',
  sube_kademe_uyusmaz: 'sube',
}
export const hataAlani = (kod) => KOD_ALANI[kod] ?? 'genel'

// Formu doğrular: alan kuralları (içe aktarmayla ortak) + aynı okulda aynı öğrenci no tekrarı +
// (düzenlemede) puanlı öğrencinin kademesinin kilidi.
//  form      : { student_no, full_name, grade, class_name } (metin)
//  mevcutlar : yüklü öğrenci listesi (id, student_no, full_name, grade, ...)
//  ayar      : { duzenlenenId, puanSayilari }
// Dönen: { deger, hatalar: [{ kod, mesaj, alan }] }  (deger: hata yoksa temizlenmiş öğrenci)
export function ogrenciFormunuDogrula(form, mevcutlar, { duzenlenenId = null, puanSayilari = null } = {}) {
  const sonuc = alanlariDogrula(
    { no: form.student_no, ad: form.full_name, kademe: form.grade, sube: form.class_name },
    'form'
  )
  const hatalar = [...sonuc.hatalar]

  if (sonuc.no !== null) {
    const diger = mevcutlar.find((o) => o.student_no === sonuc.no && o.id !== duzenlenenId)
    if (diger) {
      hatalar.push({ kod: 'no_tekrar', mesaj: `Bu öğrenci numarası zaten kayıtlı: ${sonuc.no} (${diger.full_name}).` })
    }
  }

  if (duzenlenenId && sonuc.deger) {
    const eski = mevcutlar.find((o) => o.id === duzenlenenId)
    if (eski && eski.grade !== sonuc.deger.grade) {
      const kilit = kademeKilidi(duzenlenenId, puanSayilari)
      if (kilit.kilitli) hatalar.push({ kod: 'kademe_kilitli', mesaj: kilit.neden })
    }
  }

  const alanli = hatalar.map((h) => ({ ...h, alan: hataAlani(h.kod) }))
  return { deger: alanli.length ? null : sonuc.deger, hatalar: alanli }
}

// Hata listesini alana göre gruplar: { no: [...], ad: [...], kademe: [...], sube: [...], genel: [...] }
export function hatalariAlanaGoreAyir(hatalar) {
  const ayrilmis = { no: [], ad: [], kademe: [], sube: [], genel: [] }
  for (const h of hatalar) ayrilmis[h.alan ?? hataAlani(h.kod)].push(h.mesaj)
  return ayrilmis
}

// Düzenlemede yalnızca DEĞİŞEN alanları döndürür (güncelleme isteği yalnızca bunları gönderir).
export function degisenAlanlar(eski, yeni) {
  const degisen = {}
  for (const alan of ['student_no', 'full_name', 'grade', 'class_name']) {
    if (String(eski[alan] ?? '') !== String(yeni[alan] ?? '')) degisen[alan] = yeni[alan]
  }
  return degisen
}
