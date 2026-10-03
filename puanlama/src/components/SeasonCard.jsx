import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hataMetni } from '../lib/hatalar'
import { tarihYaz } from '../lib/format'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme, kart } from '../lib/stil'

export default function SeasonCard({ season, onSaved }) {
  const [duzenle, setDuzenle] = useState(false)
  const [ad, setAd] = useState('')
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')
  const [hata, setHata] = useState('')
  const [kaydediyor, setKaydediyor] = useState(false)

  function duzenlemeyiAc() {
    setAd(season.name)
    setBas(season.start_date ?? '')
    setBit(season.end_date ?? '')
    setHata('')
    setDuzenle(true)
  }

  async function kaydet(e) {
    e.preventDefault()
    const yeniAd = ad.trim()
    if (!yeniAd) return setHata('Sezon adı boş olamaz.')
    if (bas && bit && bit < bas) return setHata('Bitiş tarihi başlangıç tarihinden önce olamaz.')

    setKaydediyor(true)
    setHata('')
    const { data, error } = await supabase
      .from('wc_seasons')
      .update({ name: yeniAd, start_date: bas || null, end_date: bit || null })
      .eq('id', season.id)
      .select()
      .maybeSingle()
    setKaydediyor(false)

    if (error) return setHata(hataMetni(error, { tur: 'sezon' }))
    if (!data) return setHata('Sezon güncellenemedi (yetki yok ya da kayıt bulunamadı).')
    onSaved(data)
    setDuzenle(false)
  }

  return (
    <section className={kart}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-gray-200">Aktif Sezon</h2>
        {!duzenle && (
          <button onClick={duzenlemeyiAc} className={ikincilDugme}>
            Düzenle
          </button>
        )}
      </div>

      {!duzenle ? (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-gray-400">Ad</dt>
            <dd className="text-2xl font-bold text-green-400">{season.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-400">Başlangıç</dt>
            <dd className="text-lg font-semibold">{tarihYaz(season.start_date)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-400">Bitiş</dt>
            <dd className="text-lg font-semibold">{tarihYaz(season.end_date)}</dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={kaydet} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={etiketSinifi} htmlFor="sezon-ad">
                Sezon adı
              </label>
              <input id="sezon-ad" className={girdiSinifi} value={ad} onChange={(e) => setAd(e.target.value)} />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="sezon-bas">
                Başlangıç tarihi
              </label>
              <input
                id="sezon-bas"
                type="date"
                className={girdiSinifi}
                value={bas}
                onChange={(e) => setBas(e.target.value)}
              />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="sezon-bit">
                Bitiş tarihi
              </label>
              <input
                id="sezon-bit"
                type="date"
                className={girdiSinifi}
                value={bit}
                onChange={(e) => setBit(e.target.value)}
              />
            </div>
          </div>
          {hata && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">{hata}</div>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={kaydediyor} className={anaDugme}>
              {kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setDuzenle(false)} className={ikincilDugme}>
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
