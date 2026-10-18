import { useState } from 'react'
import { elleDuzeltmeDogrula } from '../lib/odev'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme } from '../lib/stil'

// Elle düzeltme: bir öğrencinin ödev puanına neden belirterek artı ya da eksi ekler (kayıt silinmez; hatayı geri
// almak için ters işaretli yeni kayıt eklenir). onKaydet({ puan, neden, tarih }) hata metni döner ('' = başarılı).
export default function ElleDuzeltmeKutusu({ ogrenciAdi, bugun, onKaydet, onKapat }) {
  const [puan, setPuan] = useState('')
  const [neden, setNeden] = useState('')
  const [tarih, setTarih] = useState(bugun)
  const [hata, setHata] = useState('')
  const [kaydediyor, setKaydediyor] = useState(false)

  async function kaydet() {
    const p = puan.trim() === '' ? NaN : Number(puan)
    const d = elleDuzeltmeDogrula({ puan: p, neden, tarih, bugun })
    if (!d.gecerli) return setHata(d.hata)
    if (d.uyari && !window.confirm(d.uyari)) return
    setHata('')
    setKaydediyor(true)
    const sonuc = await onKaydet({ puan: p, neden: neden.trim(), tarih })
    setKaydediyor(false)
    if (sonuc) setHata(sonuc)
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-600 rounded-xl p-6 shadow-2xl space-y-4">
        <h2 className="text-xl font-bold text-gray-100">Elle düzeltme · {ogrenciAdi}</h2>
        <p className="text-sm text-gray-400">
          Ödev puanına artı ya da eksi ekler. Kayıt silinemez: yanlışı düzeltmek için ters işaretli yeni bir düzeltme
          ekle (ör. yanlışlıkla verilen -2 için +2).
        </p>
        <div>
          <label className={etiketSinifi} htmlFor="d-puan">
            Puan (artı için 2, eksi için -1 gibi)
          </label>
          <input id="d-puan" type="number" step="1" value={puan} onChange={(e) => setPuan(e.target.value)} className={girdiSinifi} />
        </div>
        <div>
          <label className={etiketSinifi} htmlFor="d-neden">
            Neden (zorunlu)
          </label>
          <textarea id="d-neden" rows={3} value={neden} onChange={(e) => setNeden(e.target.value)} className={girdiSinifi} />
        </div>
        <div>
          <label className={etiketSinifi} htmlFor="d-tarih">
            Tarih (dönem bu tarihe göre belirlenir)
          </label>
          <input id="d-tarih" type="date" max={bugun} value={tarih} onChange={(e) => setTarih(e.target.value)} className={girdiSinifi} />
        </div>
        {hata && <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">{hata}</div>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onKapat} disabled={kaydediyor} className={ikincilDugme}>
            Vazgeç
          </button>
          <button type="button" onClick={kaydet} disabled={kaydediyor} className={anaDugme}>
            {kaydediyor ? 'Kaydediliyor…' : 'Düzeltmeyi kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
