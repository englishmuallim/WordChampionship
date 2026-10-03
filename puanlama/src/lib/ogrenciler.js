import { supabase } from './supabase'

// Tüm öğrencileri okur. Supabase tek istekte en çok 1000 satır verdiği için sayfa sayfa çeker.
export async function tumOgrencileriGetir() {
  const sayfa = 1000
  const hepsi = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_no, full_name, grade, class_name, is_active')
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
