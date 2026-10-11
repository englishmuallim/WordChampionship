import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni } from '../lib/hatalar'
import { sezonVeSinavlar, uniteSonuclariGetir } from '../lib/siralamaVeri'
import {
  FONKSIYON_YOK_MESAJI,
  baslikMetni,
  fonksiyonYokMu,
  ogrenciSatirlari,
  otomatikSutunSayisi,
  satirOlculeri,
  sonuclariSirala,
  sutunlaraBol,
} from '../lib/uniteSonuclari'
import { KADEMELER } from '../components/ExamForm'
import { etiketSinifi, girdiSinifi, kart } from '../lib/stil'
import logo from '../assets/okul-logo.png'
import './uniteSonuclari.css'

export default function UnitResults() {
  const [sezon, setSezon] = useState(null)
  const [tumSinavlar, setTumSinavlar] = useState([])
  const [hazir, setHazir] = useState(false)
  const [hata, setHata] = useState('')

  const [kademe, setKademe] = useState(5)
  const [unite, setUnite] = useState('')
  const [sutunSecimi, setSutunSecimi] = useState('oto') // 'oto' | '1' | '2' | '3'

  // Çekilen veri, hangi seçime (kademe + ünite) ait olduğunu bilir: eski seçimin verisi yeni başlıkla gösterilmez.
  const [veri, setVeri] = useState(null) // { anahtar, kayitlar }

  useEffect(() => {
    let iptal = false
    sezonVeSinavlar().then((sv) => {
      if (iptal) return
      if (sv.error) setHata(hataMetni(sv.error))
      else {
        setSezon(sv.sezon)
        setTumSinavlar(sv.sinavlar)
      }
      setHazir(true)
    })
    return () => {
      iptal = true
    }
  }, [])

  // Seçilen kademenin tanımlı üniteleri
  const uniteler = useMemo(
    () => tumSinavlar.filter((s) => s.grade === kademe).map((s) => s.unit_no).sort((a, b) => a - b),
    [tumSinavlar, kademe]
  )

  // Kademe değişince (ya da sınavlar yüklenince) ünite seçimi geçerli değilse en son üniteye alınır
  useEffect(() => {
    setUnite((u) => (uniteler.includes(Number(u)) ? u : uniteler.length ? String(uniteler[uniteler.length - 1]) : ''))
  }, [uniteler])

  const uniteNo = Number(unite)
  const anahtar = `${kademe}|${uniteNo}`

  useEffect(() => {
    if (!sezon || !uniteNo) return
    let iptal = false
    setHata('')
    uniteSonuclariGetir(sezon.id, kademe, uniteNo).then(({ data, error }) => {
      if (iptal) return
      if (error) {
        setHata(fonksiyonYokMu(error) ? FONKSIYON_YOK_MESAJI : hataMetni(error))
        setVeri(null)
      } else {
        setVeri({ anahtar: `${kademe}|${uniteNo}`, kayitlar: data })
      }
    })
    return () => {
      iptal = true
    }
  }, [sezon, kademe, uniteNo])

  const guncel = Boolean(veri) && veri.anahtar === anahtar
  const satirlar = useMemo(
    () => (guncel ? sonuclariSirala(ogrenciSatirlari(veri.kayitlar, uniteNo, kademe)) : []),
    [guncel, veri, uniteNo, kademe]
  )
  const sutunSayisi = sutunSecimi === 'oto' ? otomatikSutunSayisi(satirlar.length) : Number(sutunSecimi)
  const sutunlar = useMemo(() => sutunlaraBol(satirlar, sutunSayisi), [satirlar, sutunSayisi])
  const olcu = satirOlculeri(sutunlar[0]?.length ?? 0)
  const baslik = baslikMetni(kademe, uniteNo || 1)

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="yazdirma-gizle space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Ünite Sonuçları</h1>
              <p className="text-gray-400 mt-1">
                {sezon ? `Sezon ${sezon.name} · aşağıdaki beyaz alanın ekran görüntüsünü alabilirsin` : 'Velilere paylaşılacak sonuç listesi'}
              </p>
            </div>
            <Link
              to="/"
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
            >
              ← Ana sayfa
            </Link>
          </header>

          {hata && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{hata}</div>}

          {!hazir ? (
            <p className="text-gray-400">Yükleniyor…</p>
          ) : !sezon ? (
            <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">
              Aktif sezon bulunamadı.
            </div>
          ) : (
            <section className={kart}>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className={etiketSinifi} htmlFor="u-kademe">
                    Kademe
                  </label>
                  <select
                    id="u-kademe"
                    className={girdiSinifi}
                    value={kademe}
                    onChange={(e) => setKademe(Number(e.target.value))}
                  >
                    {KADEMELER.map((k) => (
                      <option key={k} value={k}>
                        {k}. kademe
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="u-unite">
                    Ünite
                  </label>
                  <select
                    id="u-unite"
                    className={girdiSinifi}
                    value={unite}
                    disabled={uniteler.length === 0}
                    onChange={(e) => setUnite(e.target.value)}
                  >
                    {uniteler.length === 0 && <option value="">Sınav tanımlı değil</option>}
                    {uniteler.map((u) => (
                      <option key={u} value={u}>
                        {u}. ünite
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="u-sutun">
                    Sütun sayısı
                  </label>
                  <select id="u-sutun" className={girdiSinifi} value={sutunSecimi} onChange={(e) => setSutunSecimi(e.target.value)}>
                    <option value="oto">Otomatik ({otomatikSutunSayisi(satirlar.length)})</option>
                    <option value="1">1 sütun</option>
                    <option value="2">2 sütun</option>
                    <option value="3">3 sütun</option>
                  </select>
                </div>
                <p className="text-sm text-gray-400 pb-2">
                  {guncel ? (
                    <>
                      Listede <b className="text-blue-400">{satirlar.length}</b> öğrenci
                    </>
                  ) : hata ? (
                    'Veri alınamadı.'
                  ) : (
                    'Yükleniyor…'
                  )}
                </p>
              </div>
              {guncel && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-4 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
                >
                  Yazdır (A4 yatay)
                </button>
              )}
              {uniteler.length === 0 && (
                <p className="text-sm text-gray-500 mt-3">Bu kademe için sınav tanımlı değil.</p>
              )}
              {guncel && satirlar.length === 0 && (
                <p className="text-sm text-gray-500 mt-3">Bu ünitede listelenecek öğrenci yok.</p>
              )}
            </section>
          )}
        </div>

        {guncel && satirlar.length > 0 && (
          <div className="cikti-kap overflow-x-auto border border-gray-700 rounded-lg">
            <div className={`cikti ${sutunSayisi === 1 ? 'cikti-tek' : ''}`} lang="tr">
              <div className="cikti-serit">
                <img src={logo} alt="" />
                <div className="cikti-baslik">
                  <h1>{baslik.okul}</h1>
                  <h2>{baslik.yarisma}</h2>
                  <h3>{baslik.sonuc}</h3>
                </div>
              </div>
              <div className="cikti-sutunlar">
                {sutunlar.map((sutun, i) => (
                  <table key={i} style={{ fontSize: olcu.yazi }}>
                    <thead>
                      <tr style={{ height: olcu.satir }}>
                        <th>CLASS</th>
                        <th>NAME</th>
                        <th>TRUE</th>
                        <th>SCORE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sutun.map((s) => (
                        <tr key={s.ogrenciId} className={s.tamPuan ? 'tam-puan' : ''} style={{ height: olcu.satir }}>
                          <td>{s.sinif}</td>
                          <td>{s.ad}</td>
                          <td>{s.dogru}</td>
                          <td>{s.puan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
