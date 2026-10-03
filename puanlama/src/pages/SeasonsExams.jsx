import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hataMetni } from '../lib/hatalar'
import SeasonCard from '../components/SeasonCard'
import ExamForm from '../components/ExamForm'
import ExamList from '../components/ExamList'
import ExamEditModal from '../components/ExamEditModal'

export default function SeasonsExams() {
  const [sezon, setSezon] = useState(null)
  const [sinavlar, setSinavlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [duzenlenen, setDuzenlenen] = useState(null)

  // Sezonun sınavlarını (ve her sınava ait puan kaydı sayısını) çeker.
  const sinavlariYukle = useCallback(async (sezonId) => {
    const { data, error } = await supabase
      .from('wc_exams')
      .select('*, wc_exam_scores(count)')
      .eq('season_id', sezonId)
      .order('grade')
      .order('unit_no')
    if (error) {
      setHata(hataMetni(error))
      return null
    }
    const liste = data.map((s) => ({ ...s, puanSayisi: s.wc_exam_scores?.[0]?.count ?? 0 }))
    setSinavlar(liste)
    return liste
  }, [])

  useEffect(() => {
    let iptal = false
    async function yukle() {
      const { data, error } = await supabase.from('wc_seasons').select('*').eq('is_active', true).maybeSingle()
      if (iptal) return
      if (error) {
        setHata(hataMetni(error))
      } else if (data) {
        setSezon(data)
        await sinavlariYukle(data.id)
      }
      if (!iptal) setYukleniyor(false)
    }
    yukle()
    return () => {
      iptal = true
    }
  }, [sinavlariYukle])

  async function sinavEkle(degerler) {
    setHata('')
    const { error } = await supabase.from('wc_exams').insert({ season_id: sezon.id, ...degerler })
    if (error) {
      return { hata: hataMetni(error, { tur: 'sinav', grade: degerler.grade, unit: degerler.unit_no }) }
    }
    const liste = await sinavlariYukle(sezon.id)
    return liste ? { sinavlar: liste } : { hata: 'Sınav eklendi ama liste yenilenemedi. Sayfayı yenileyin.' }
  }

  async function sinavGuncelle(degerler) {
    const { data, error } = await supabase
      .from('wc_exams')
      .update(degerler)
      .eq('id', duzenlenen.id)
      .select('id')
    if (error) return hataMetni(error, { tur: 'sinav', grade: degerler.grade, unit: degerler.unit_no })
    if (!data?.length) return 'Sınav güncellenemedi (yetki yok ya da kayıt bulunamadı).'
    await sinavlariYukle(sezon.id)
    setDuzenlenen(null)
    return ''
  }

  async function sinavSil(sinav) {
    if (!window.confirm(`${sinav.grade}. kademe ${sinav.unit_no}. ünite sınavı silinecek. Emin misiniz?`)) return
    setHata('')
    const { data, error } = await supabase.from('wc_exams').delete().eq('id', sinav.id).select('id')
    if (error) return setHata(hataMetni(error))
    if (!data?.length) return setHata('Sınav silinemedi (yetki yok ya da kayıt bulunamadı).')
    await sinavlariYukle(sezon.id)
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Sezon ve Sınavlar</h1>
            <p className="text-gray-400 mt-1">Sezon bilgisi ve kademe bazlı sınav tanımları</p>
          </div>
          <Link
            to="/"
            className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
          >
            ← Ana sayfa
          </Link>
        </header>

        {hata && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{hata}</div>
        )}

        {yukleniyor ? (
          <p className="text-gray-400">Yükleniyor…</p>
        ) : !sezon ? (
          <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">
            Aktif sezon bulunamadı.
          </div>
        ) : (
          <>
            <SeasonCard season={sezon} onSaved={setSezon} />
            <ExamForm sinavlar={sinavlar} onEkle={sinavEkle} />
            <ExamList sinavlar={sinavlar} onDuzenle={setDuzenlenen} onSil={sinavSil} />
          </>
        )}
      </div>

      {duzenlenen && (
        <ExamEditModal sinav={duzenlenen} onKaydet={sinavGuncelle} onKapat={() => setDuzenlenen(null)} />
      )}
    </div>
  )
}
