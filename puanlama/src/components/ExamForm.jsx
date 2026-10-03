import { useState } from 'react'
import { tamSayi } from '../lib/format'
import { anaDugme, etiketSinifi, girdiSinifi, kart } from '../lib/stil'

export const KADEMELER = [5, 6, 7, 8]

// Bir kademede mevcut en yüksek ünite no'nun bir fazlası (hiç yoksa 1)
export function sonrakiUnite(sinavlar, kademe) {
  const nolar = sinavlar.filter((s) => s.grade === kademe).map((s) => s.unit_no)
  return nolar.length ? Math.max(...nolar) + 1 : 1
}

// onEkle(degerler) -> { hata } veya { sinavlar } döndüren async fonksiyon
export default function ExamForm({ sinavlar, onEkle }) {
  const [kademe, setKademe] = useState(5)
  const [unite, setUnite] = useState(String(sonrakiUnite(sinavlar, 5)))
  const [tarih, setTarih] = useState('')
  const [soru, setSoru] = useState('25')
  const [puan, setPuan] = useState('4')
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [kaydediyor, setKaydediyor] = useState(false)

  const soruN = tamSayi(soru, 1, 200)
  const puanN = tamSayi(puan, 1, 100)
  const toplam = soruN && puanN ? soruN * puanN : null

  function kademeDegisti(deger) {
    const k = Number(deger)
    setKademe(k)
    setUnite(String(sonrakiUnite(sinavlar, k)))
    setHata('')
    setBilgi('')
  }

  async function gonder(e) {
    e.preventDefault()
    setHata('')
    setBilgi('')

    const uniteN = tamSayi(unite, 1)
    if (!uniteN) return setHata('Ünite no 1 veya daha büyük bir tam sayı olmalı.')
    if (!soruN) return setHata('Soru sayısı 1 ile 200 arasında bir tam sayı olmalı.')
    if (!puanN) return setHata('Soru başı puan 1 ile 100 arasında bir tam sayı olmalı.')

    setKaydediyor(true)
    const sonuc = await onEkle({
      grade: kademe,
      unit_no: uniteN,
      exam_date: tarih || null,
      question_count: soruN,
      points_per_question: puanN,
    })
    setKaydediyor(false)

    if (sonuc.hata) return setHata(sonuc.hata)
    // Kademe, tarih, soru sayısı ve soru başı puan aynı kalır; ünite no bir sonrakine geçer.
    setBilgi(`${kademe}. kademe ${uniteN}. ünite eklendi.`)
    setUnite(String(sonrakiUnite(sonuc.sinavlar, kademe)))
  }

  return (
    <section className={kart}>
      <h2 className="text-xl font-semibold text-gray-200 mb-4">Sınav Ekle</h2>
      <form onSubmit={gonder} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className={etiketSinifi} htmlFor="yeni-kademe">
              Kademe
            </label>
            <select
              id="yeni-kademe"
              className={girdiSinifi}
              value={kademe}
              onChange={(e) => kademeDegisti(e.target.value)}
            >
              {KADEMELER.map((k) => (
                <option key={k} value={k}>
                  {k}. kademe
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiketSinifi} htmlFor="yeni-unite">
              Ünite no
            </label>
            <input
              id="yeni-unite"
              type="number"
              min="1"
              step="1"
              className={girdiSinifi}
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
            />
          </div>
          <div>
            <label className={etiketSinifi} htmlFor="yeni-tarih">
              Tarih (isteğe bağlı)
            </label>
            <input
              id="yeni-tarih"
              type="date"
              className={girdiSinifi}
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
          </div>
          <div>
            <label className={etiketSinifi} htmlFor="yeni-soru">
              Soru sayısı
            </label>
            <input
              id="yeni-soru"
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
            <label className={etiketSinifi} htmlFor="yeni-puan">
              Soru başı puan
            </label>
            <input
              id="yeni-puan"
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
        {bilgi && (
          <div className="bg-green-900/40 border border-green-600 text-green-200 px-4 py-2 rounded text-sm">
            {bilgi}
          </div>
        )}

        <button type="submit" disabled={kaydediyor} className={anaDugme}>
          {kaydediyor ? 'Ekleniyor…' : 'Sınavı Ekle'}
        </button>
      </form>
    </section>
  )
}
