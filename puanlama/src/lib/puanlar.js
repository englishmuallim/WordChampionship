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

// Kaydı giren kişilerin adları: Map(id -> ad). Yetki yoksa (öğretmen başkasını göremez) o kişi haritada olmaz.
export async function personelAdlari(idler) {
  if (!idler.length) return new Map()
  const { data } = await supabase.from('wc_staff').select('id, full_name').in('id', idler)
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

// Değişen satırları tek istekte yazar: ya hepsi yazılır ya hiçbiri.
// Şube/kademe kaydı, entered_by ve updated_at alanlarını veritabanı kendisi doldurur.
export async function puanlariYaz(satirlar) {
  const { error } = await supabase.from('wc_exam_scores').upsert(satirlar, { onConflict: 'exam_id,student_id' })
  return { error }
}
