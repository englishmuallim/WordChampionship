import { useState } from 'react'
import { tamSayi } from '../lib/format'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme } from '../lib/stil'
import { KADEMELER } from './ExamForm'

// onKaydet(degerler) -> hata metni (başarılıysa boş metin)
export default function ExamEditModal({ sinav, onKaydet, onKapat }) {
  const [kademe, setKademe] = useState(sinav.grade)
  const [unite, setUnite] = useState(String(sinav.unit_no))
  const [tarih, setTarih] = useState(sinav.exam_date ?? '')
  const [soru, setSoru] = useState(String(sinav.question_count))
  const [puan, setPuan] = useState(String(sinav.points_per_question))
  const [hata, setHata] = useState('')
  const [kaydediyor, setKaydediyor] = useState(false)

  const puanKaydiVar = sinav.puanSayisi > 0
  const soruN = tamSayi(soru, 1, 200)
  const puanN = tamSayi(puan, 1, 100)
  const toplam = soruN && puanN ? soruN * puanN : null

  async function kaydet(e) {
    e.preventDefault()
    setHata('')
    const uniteN = tamSayi(unite, 1)
    if (!uniteN) return setHata('Ünite no 1 veya daha büyük bir tam sayı olmalı.')
    if (!soruN) return setHata('Soru sayısı 1 ile 200 arasında bir tam sayı olmalı.')
    if (!puanN) return setHata('Soru başı puan 1 ile 100 arasında bir tam sayı olmalı.')

    const hesapDegisiyor = soruN !== sinav.question_count || puanN !== sinav.points_per_question
    if (puanKaydiVar && hesapDegisiyor) {
      const onay = window.confirm(
        `Bu sınav için ${sinav.puanSayisi} puan kaydı var. Soru sayısı veya soru başı puan değişirse mevcut puanların hesabı da değişir. Devam edilsin mi?`
      )
      if (!onay) return
    }

    setKaydediyor(true)
    const sonuc = await onKaydet({
      grade: kademe,
      unit_no: uniteN,
      exam_date: tarih || null,
      question_count: soruN,
      points_per_question: puanN,
    })
    setKaydediyor(false)
    if (sonuc) setHata(sonuc)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-xl font-bold text-gray-100 mb-4">
          Sınavı Düzenle ({sinav.grade}. kademe, {sinav.unit_no}. ünite)
        </h3>
        <form onSubmit={kaydet} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={etiketSinifi} htmlFor="d-kademe">
                Kademe
              </label>
              <select
                id="d-kademe"
                className={girdiSinifi}
                value={kademe}
                disabled={puanKaydiVar}
                onChange={(e) => setKademe(Number(e.target.value))}
              >
                {KADEMELER.map((k) => (
                  <option key={k} value={k}>
                    {k}. kademe
                  </option>
                ))}
              </select>
              {puanKaydiVar && (
                <p className="text-xs text-amber-400 mt-1">Puan kaydı olduğu için kademe değiştirilemez.</p>
              )}
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="d-unite">
                Ünite no
              </label>
              <input
                id="d-unite"
                type="number"
                min="1"
                step="1"
                className={girdiSinifi}
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className={etiketSinifi} htmlFor="d-tarih">
                Tarih (isteğe bağlı)
              </label>
              <input
                id="d-tarih"
                type="date"
                className={girdiSinifi}
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
              />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="d-soru">
                Soru sayısı
              </label>
              <input
                id="d-soru"
                type="number"
                min="1"
                max="200"
                step="1"
                className={girdiSinifi}
                value={soru}
                onChange={(e) => setSoru(e.target.value)}
              />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="d-puan">
                Soru başı puan
              </label>
              <input
                id="d-puan"
                type="number"
                min="1"
                max="100"
                step="1"
                className={girdiSinifi}
                value={puan}
                onChange={(e) => setPuan(e.target.value)}
              />
            </div>
          </div>

          <p className="text-sm text-gray-400">
            Sınav toplam puanı: <span className="font-bold text-blue-400">{toplam ?? '—'}</span>
          </p>

          {hata && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">{hata}</div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={kaydediyor} className={anaDugme}>
              {kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={onKapat} className={ikincilDugme}>
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
