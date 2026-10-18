import { supabase } from './supabase'

// Ödev Kontrolü veri okuma/yazma. Erişim kuralları (RLS) veritabanındadır: yönetici hepsini, öğretmen yalnızca
// yetkili şubelerinin öğrencilerini okur ve yazar. Tablolar yalnızca eklemeye açıktır (güncelleme/silme yok).

// Bir kaynak sınavın tüm kayıtlarını okur. Supabase tek istekte en çok 1000 satır verdiği için sayfa sayfa çeker;
// sayfalar tutarlı olsun diye benzersiz `id`'ye göre sıralanır.
async function tumSatirlar(tablo, sutunlar, kaynakExamId) {
  const sayfa = 1000
  const hepsi = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await supabase
      .from(tablo)
      .select(sutunlar)
      .eq('kaynak_exam_id', kaynakExamId)
      .order('id')
      .range(bas, bas + sayfa - 1)
    if (error) return { error }
    hepsi.push(...data)
    if (data.length < sayfa) break
  }
  return { data: hepsi }
}

export const odevKontrolleriniGetir = (kaynakExamId) =>
  tumSatirlar('wc_odev_kontrolleri', 'id, student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken, iptal, entered_by, created_at', kaynakExamId)

export const odevDuzeltmeleriniGetir = (kaynakExamId) =>
  tumSatirlar('wc_odev_duzeltmeleri', 'id, student_id, kaynak_exam_id, tur, puan, tarih, neden, entered_by, created_at', kaynakExamId)

// Satırlar tek istekte eklenir: ya hepsi yazılır ya hiçbiri. entered_by, created_at, grade_at_entry ve
// class_name_at_entry alanlarını veritabanı kendisi doldurur (istemciden gelenler zaten ezilir).
export async function odevKontrolleriniYaz(satirlar) {
  const { error } = await supabase.from('wc_odev_kontrolleri').insert(satirlar)
  return { error }
}

export async function odevDuzeltmeleriniYaz(satirlar) {
  const { error } = await supabase.from('wc_odev_duzeltmeleri').insert(satirlar)
  return { error }
}

// --- Ödev Özeti: birden çok kaynak sınavın kayıtları (sezonun bir kademedeki tüm sınavları) ---

// Kayıtlar benzersiz `id`'ye göre sıralı ve 1000'er sayfa çekilir (Supabase tek istekte en çok 1000 satır verir).
async function tumSatirlarIn(tablo, sutunlar, kaynakExamIdleri) {
  if (!kaynakExamIdleri.length) return { data: [] }
  const sayfa = 1000
  const hepsi = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await supabase
      .from(tablo)
      .select(sutunlar)
      .in('kaynak_exam_id', kaynakExamIdleri)
      .order('id')
      .range(bas, bas + sayfa - 1)
    if (error) return { error }
    hepsi.push(...data)
    if (data.length < sayfa) break
  }
  return { data: hepsi }
}

// Verilen kaynak sınavların ödev kontrolleri ve düzeltmeleri. Dönen: { kontroller, duzeltmeler } ya da { error }
export async function odevKayitlariniGetir(kaynakExamIdleri) {
  const [kontrol, duzeltme] = await Promise.all([
    tumSatirlarIn('wc_odev_kontrolleri', 'id, student_id, kaynak_exam_id, kontrol_tarihi, toplam_yazilan, gereken, iptal, created_at', kaynakExamIdleri),
    tumSatirlarIn('wc_odev_duzeltmeleri', 'id, student_id, kaynak_exam_id, tur, puan, tarih, neden, created_at', kaynakExamIdleri),
  ])
  const error = kontrol.error ?? duzeltme.error
  return error ? { error } : { kontroller: kontrol.data, duzeltmeler: duzeltme.data }
}
