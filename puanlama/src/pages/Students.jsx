import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni } from '../lib/hatalar'
import { sadelestir } from '../lib/metin'
import { tumOgrencileriGetir } from '../lib/ogrenciler'
import { KADEMELER } from '../components/ExamForm'
import { anaDugme, girdiSinifi, etiketSinifi, kart } from '../lib/stil'

export default function Students() {
  const [ogrenciler, setOgrenciler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('')
  const [arama, setArama] = useState('')

  useEffect(() => {
    let iptal = false
    tumOgrencileriGetir().then(({ data, error }) => {
      if (iptal) return
      if (error) setHata(hataMetni(error))
      else setOgrenciler(data)
      setYukleniyor(false)
    })
    return () => {
      iptal = true
    }
  }, [])

  // Şube seçenekleri seçili kademeye göre (kademe seçilmediyse hepsi)
  const subeler = useMemo(() => {
    const kume = ogrenciler.filter((o) => !kademe || o.grade === Number(kademe))
    return [...new Set(kume.map((o) => o.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [ogrenciler, kademe])

  const gosterilen = useMemo(() => {
    const aranan = sadelestir(arama).trim()
    return ogrenciler
      .filter((o) => !kademe || o.grade === Number(kademe))
      .filter((o) => !sube || o.class_name === sube)
      .filter((o) => !aranan || sadelestir(o.full_name).includes(aranan) || sadelestir(o.student_no).includes(aranan))
      .sort(
        (a, b) =>
          a.grade - b.grade ||
          (a.class_name ?? '').localeCompare(b.class_name ?? '', 'tr') ||
          a.full_name.localeCompare(b.full_name, 'tr')
      )
  }, [ogrenciler, kademe, sube, arama])

  const pasifSayisi = ogrenciler.filter((o) => o.is_active === false).length

  function kademeDegisti(deger) {
    setKademe(deger)
    setSube('') // önceki kademenin şubesi yeni kademede olmayabilir
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Öğrenciler</h1>
            <p className="text-gray-400 mt-1">Kayıtlı öğrenci listesi</p>
          </div>
          <div className="flex gap-3">
            <Link to="/ogrenciler/ice-aktar" className={anaDugme}>
              İçe Aktar
            </Link>
            <Link
              to="/"
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold flex items-center"
            >
              ← Ana sayfa
            </Link>
          </div>
        </header>

        {hata && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{hata}</div>}

        <section className={kart}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={etiketSinifi} htmlFor="f-kademe">
                Kademe
              </label>
              <select id="f-kademe" className={girdiSinifi} value={kademe} onChange={(e) => kademeDegisti(e.target.value)}>
                <option value="">Tümü</option>
                {KADEMELER.map((k) => (
                  <option key={k} value={k}>
                    {k}. kademe
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="f-sube">
                Şube
              </label>
              <select id="f-sube" className={girdiSinifi} value={sube} onChange={(e) => setSube(e.target.value)}>
                <option value="">Tümü</option>
                {subeler.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="f-arama">
                Ara (ad veya numara)
              </label>
              <input
                id="f-arama"
                className={girdiSinifi}
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="örn. cagri"
              />
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-3">
            Toplam <b className="text-gray-200">{ogrenciler.length}</b> öğrenci
            {pasifSayisi > 0 && <> ({pasifSayisi} pasif)</>} · Gösterilen{' '}
            <b className="text-blue-400">{gosterilen.length}</b>
          </p>

          {yukleniyor ? (
            <p className="text-gray-400">Yükleniyor…</p>
          ) : gosterilen.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              {ogrenciler.length === 0 ? 'Henüz öğrenci yok. "İçe Aktar" ile ekleyebilirsin.' : 'Filtreye uyan öğrenci yok.'}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto border border-gray-700 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 px-3">Öğrenci No</th>
                    <th className="py-2 px-3">Ad Soyad</th>
                    <th className="py-2 px-3">Kademe</th>
                    <th className="py-2 px-3">Şube</th>
                    <th className="py-2 px-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {gosterilen.map((o) => (
                    <tr key={o.id} className="border-b border-gray-700/60">
                      <td className="py-2 px-3">{o.student_no}</td>
                      <td className="py-2 px-3 font-semibold">{o.full_name}</td>
                      <td className="py-2 px-3">{o.grade}</td>
                      <td className="py-2 px-3">{o.class_name ?? '—'}</td>
                      <td className="py-2 px-3">
                        {o.is_active === false ? (
                          <span className="text-amber-300">Pasif</span>
                        ) : (
                          <span className="text-green-400">Aktif</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
