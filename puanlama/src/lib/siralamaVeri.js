import { supabase } from './supabase'

// Aktif sezon ve sezonun tüm sınavları (kademe süzgeci sayfada yapılır)
export async function sezonVeSinavlar() {
  const { data: sezon, error } = await supabase.from('wc_seasons').select('*').eq('is_active', true).maybeSingle()
  if (error) return { error }
  if (!sezon) return { sezon: null, sinavlar: [] }
  const { data: sinavlar, error: sErr } = await supabase
    .from('wc_exams')
    .select('id, grade, unit_no, exam_date, question_count, points_per_question')
    .eq('season_id', sezon.id)
    .order('grade')
    .order('unit_no')
  if (sErr) return { error: sErr }
  return { sezon, sinavlar }
}

// Bir kademenin sıralaması. Sıra numaraları veritabanında hesaplanır (kademenin tamamı üzerinden),
// şube süzgeci sayfada uygulanır.
export async function siralamaGetir(sezonId, kademe, ayrilanlarDahil) {
  const { data, error } = await supabase.rpc('wc_ranking', {
    p_season_id: sezonId,
    p_grade: kademe,
    p_class_name: null,
    p_include_left: ayrilanlarDahil,
  })
  return error ? { error } : { data }
}

// Verilen sınavların ham puan kayıtları. Erişim kuralları nedeniyle yönetici hepsini, öğretmen yalnızca
// yetkili olduğu şubelerin kayıtlarını alır. Supabase tek istekte en çok 1000 satır verdiği için sayfa sayfa çekilir.
export async function sinavPuanlariniGetir(sinavIdleri) {
  if (!sinavIdleri.length) return { data: [] }
  const sayfa = 1000
  const hepsi = []
  for (let bas = 0; ; bas += sayfa) {
    const { data, error } = await supabase
      .from('wc_exam_scores')
      .select('exam_id, student_id, status, correct_count')
      .in('exam_id', sinavIdleri)
      .order('exam_id')
      .order('student_id')
      .range(bas, bas + sayfa - 1)
    if (error) return { error }
    hepsi.push(...data)
    if (data.length < sayfa) break
  }
  return { data: hepsi }
}
