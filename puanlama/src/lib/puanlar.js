import { supabase } from './supabase'

// Bir sınavın kayıtlı puanları (RLS: yönetici hepsini, öğretmen yalnızca yetkili olduğu şubeleri görür).
// Dönen: { harita: Map(student_id -> kayıt), son: { ad, zaman } | null }
export async function sinavPuanlariniGetir(sinavId) {
  const { data, error } = await supabase
    .from('wc_exam_scores')
    .select('student_id, status, correct_count, entered_by, updated_at')
    .eq('exam_id', sinavId)
  if (error) return { error }

  const harita = new Map(data.map((k) => [k.student_id, k]))
  return { harita, kayitlar: data }
}

// Kaydı giren kişilerin adları: Map(id -> ad). wc_personel_adlari yalnızca id ve ad soyad döndürür ve
// hem yönetici hem öğretmen çağırabilir (öğretmen kendi profilinden başkasını doğrudan okuyamaz).
// Ad kozmetik bir bilgidir: fonksiyon yoksa ya da hata verirse sayfa bozulmaz, ad "bilinmiyor" görünür.
export async function personelAdlari(idler) {
  if (!idler.length) return new Map()
  const { data, error } = await supabase.rpc('wc_personel_adlari', { p_idler: idler })
  if (error) {
    console.error('Personel adları okunamadı:', error.code, error.message)
    return new Map()
  }
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

// Değişen satırları tek istekte yazar: ya hepsi yazılır ya hiçbiri.
// Şube/kademe kaydı, entered_by ve updated_at alanlarını veritabanı kendisi doldurur.
export async function puanlariYaz(satirlar) {
  const { error } = await supabase.from('wc_exam_scores').upsert(satirlar, { onConflict: 'exam_id,student_id' })
  return { error }
}
