import { supabase } from './supabase'
import { puanSayilariHaritasi } from './ogrenciYonetimi'

// Tüm öğrencileri okur. Supabase tek istekte en çok 1000 satır verdiği için sayfa sayfa çeker.
export async function tumOgrencileriGetir() {
  const sayfa = 1000
  const hepsi = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_no, full_name, grade, class_name, is_active, left_at, left_reason')
      .order('student_no')
      .order('id')
      .range(bas, bas + sayfa - 1)
    if (error) return { error }
    hepsi.push(...data)
    if (data.length < sayfa) break
  }
  return { data: hepsi }
}

// Öğrencileri tek istekte yazar (yeni ise ekler, okul içinde aynı öğrenci no varsa günceller).
// Tek istek olduğu için ya hepsi yazılır ya hiçbiri. is_active ve left_* alanlarına dokunulmaz.
export async function ogrencileriYaz(satirlar) {
  const { error } = await supabase.from('students').upsert(satirlar, { onConflict: 'school_id,student_no' })
  return { error }
}

// Aktif sezonda / toplamda öğrenci başına puan kaydı sayıları (wc_ogrenci_puan_sayilari).
// Dönen: { harita: Map(id -> { toplam, aktifSezon }) } ya da { error }. Yalnızca puanı olan öğrenciler haritada yer alır.
// (Supabase tek istekte en çok 1000 satır verir; puanı olan öğrenci sayısı bunun altında olduğu sürece yeterlidir.)
export async function puanSayilariGetir() {
  const { data, error } = await supabase.rpc('wc_ogrenci_puan_sayilari')
  if (error) return { error }
  return { harita: puanSayilariHaritasi(data) }
}

// Tek öğrenci ekler. deger: { student_no, full_name, grade, class_name } (doğrulanmış).
export async function ogrenciEkle(okulId, deger) {
  const { error } = await supabase.from('students').insert({ school_id: okulId, ...deger })
  return { error }
}

// Tek öğrenciyi günceller (yalnızca verilen alanlar). Erişim kuralları satırı gizlerse 0 satır etkilenir;
// bunu sessizce başarı saymamak için etkilenen satır sayısı kontrol edilir.
export async function ogrenciGuncelle(id, degisenler) {
  const { data, error } = await supabase.from('students').update(degisenler).eq('id', id).select('id')
  if (error) return { error }
  if (!data?.length) return { mesaj: 'Öğrenci güncellenemedi (yetki yok ya da kayıt bulunamadı).' }
  return {}
}

// Tek öğrenciyi siler. Puan kaydı olan öğrenciyi veritabanı zaten silmez (yabancı anahtar).
export async function ogrenciSil(id) {
  const { data, error } = await supabase.from('students').delete().eq('id', id).select('id')
  if (error) return { error }
  if (!data?.length) return { mesaj: 'Öğrenci silinemedi (yetki yok ya da kayıt bulunamadı).' }
  return {}
}

// Toplu işlemi (arşivle, geri al, şube değiştir, kademe değiştir) tek istekte uygular.
// istek: ogrenciToplu.js topluOnizleme'nin ürettiği { fonksiyon, parametreler }. Sunucu fonksiyonları yönetici
// kontrolü, okul filtresi ve girdi doğrulaması yapar; etkilenen sayı beklenenden farklıysa HEPSİNİ geri alır.
// Dönen: { sayi } ya da { error }.
export async function topluIslemUygula(istek) {
  const { data, error } = await supabase.rpc(istek.fonksiyon, istek.parametreler)
  return error ? { error } : { sayi: data }
}
