import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni } from '../lib/hatalar'
import { tumOgrencileriGetir } from '../lib/ogrenciler'
import { sezonVeSinavlar, siralamaGetir, sinavPuanlariniGetir } from '../lib/siralamaVeri'
import {
  duzenleSirala,
  gizliSatirVar,
  hucreMetni,
  secimAnahtari,
  sinavBasligi,
  sinavlariSirala,
  subeListesi,
  subeyeGoreSuz,
  tabloSatirlari,
  veriGuncelMi,
} from '../lib/siralama'
import { KADEMELER } from '../components/ExamForm'
import { etiketSinifi, girdiSinifi, kart } from '../lib/stil'

// Sol tarafta sabit kalan sütunların genişlikleri ve sol boşlukları (yana kaydırırken görünür kalsınlar)
const SABIT = { sira1: 56, sira2: 56, no: 88, ad: 208 }
const SOL = { sira1: 0, sira2: SABIT.sira1, no: SABIT.sira1 + SABIT.sira2, ad: SABIT.sira1 + SABIT.sira2 + SABIT.no }

function sabit(ad, ust) {
  return { position: 'sticky', left: SOL[ad], width: SABIT[ad], minWidth: SABIT[ad], zIndex: ust ? 3 : 2 }
}

export default function Ranking() {
  const [sezon, setSezon] = useState(null)
  const [tumSinavlar, setTumSinavlar] = useState([])
  const [erisimli, setErisimli] = useState(new Set()) // ham puanlarını görmeye yetkili olunan öğrenciler
  const [hazir, setHazir] = useState(false)
  const [hata, setHata] = useState('')

  const [kademe, setKademe] = useState('5')
  const [sube, setSube] = useState('')
  const [ayrilanlar, setAyrilanlar] = useState(false)
  const [duzen, setDuzen] = useState('kademe')

  // Çekilen veri tek pakette tutulur ve hangi seçime (kademe + ayrılanlar) ait olduğunu bilir.
  // Böylece eski seçimin satırları yeni seçimin sınavlarıyla asla birleştirilmez.
  const [veri, setVeri] = useState(null) // { anahtar, sinavlar, satirlar, puanlar }

  // --- İlk yükleme: aktif sezon, sınavlar, erişim bilgisi ---
  useEffect(() => {
    let iptal = false
    async function yukle() {
      const [sv, ogr] = await Promise.all([sezonVeSinavlar(), tumOgrencileriGetir()])
      if (iptal) return
      if (sv.error || ogr.error) setHata(hataMetni(sv.error ?? ogr.error))
      else {
        setSezon(sv.sezon)
        setTumSinavlar(sv.sinavlar)
        setErisimli(new Set(ogr.data.map((o) => o.id)))
      }
      setHazir(true)
    }
    yukle()
    return () => {
      iptal = true
    }
  }, [])

  // --- Seçilen kademenin sıralaması ve ünite puanları ---
  useEffect(() => {
    if (!sezon) return
    let iptal = false
    setHata('')
    const anahtar = secimAnahtari(kademe, ayrilanlar)
    const sinavlar = sinavlariSirala(tumSinavlar.filter((s) => s.grade === Number(kademe)))
    Promise.all([
      siralamaGetir(sezon.id, Number(kademe), ayrilanlar),
      sinavPuanlariniGetir(sinavlar.map((s) => s.id)),
    ]).then(([sira, ham]) => {
      if (iptal) return
      if (sira.error || ham.error) {
        // Gerçek bir hata görünür kalır: hata kutusu bir sonraki seçime kadar silinmez.
        setHata(hataMetni(sira.error ?? ham.error))
        setVeri(null)
      } else {
        setVeri({ anahtar, sinavlar, satirlar: sira.data, puanlar: ham.data })
        // Seçili şube yeni listede yoksa (örn. ayrılanlar gizlenince) filtreyi kaldır
        setSube((s) => (s && !sira.data.some((r) => r.class_name === s) ? '' : s))
      }
    })
    return () => {
      iptal = true
    }
  }, [sezon, kademe, ayrilanlar, tumSinavlar])

  // Veri şu anki seçime ait değilse (yeni veri yolda) tablo kurulmaz.
  const guncel = veriGuncelMi(veri, kademe, ayrilanlar)
  const kademeSinavlari = guncel ? veri.sinavlar : []
  const tablo = useMemo(
    () =>
      guncel
        ? tabloSatirlari({ satirlar: veri.satirlar, sinavlar: veri.sinavlar, puanlar: veri.puanlar, erisimli })
        : [],
    [guncel, veri, erisimli]
  )
  const subeler = useMemo(() => (guncel ? subeListesi(veri.satirlar) : []), [guncel, veri])
  const gorunen = useMemo(() => duzenleSirala(subeyeGoreSuz(tablo, sube), duzen), [tablo, sube, duzen])
  const uyumsuzSayisi = gorunen.filter((s) => s.uyumsuz).length

  function kademeSec(v) {
    setKademe(v)
    setSube('')
  }

  const baslikSinifi = 'py-2 px-3 text-gray-400 bg-gray-900 whitespace-nowrap'

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Sıralama</h1>
            <p className="text-gray-400 mt-1">{sezon ? `Sezon ${sezon.name}` : 'Kademe bazlı puan sıralaması'}</p>
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
          <>
            <section className={kart}>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className={etiketSinifi} htmlFor="s-kademe">
                    Kademe
                  </label>
                  <select id="s-kademe" className={girdiSinifi} value={kademe} onChange={(e) => kademeSec(e.target.value)}>
                    {KADEMELER.map((k) => (
                      <option key={k} value={k}>
                        {k}. kademe
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="s-sube">
                    Şube
                  </label>
                  <select id="s-sube" className={girdiSinifi} value={sube} onChange={(e) => setSube(e.target.value)}>
                    <option value="">Tümü</option>
                    {subeler.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="s-duzen">
                    Sıralama düzeni
                  </label>
                  <select id="s-duzen" className={girdiSinifi} value={duzen} onChange={(e) => setDuzen(e.target.value)}>
                    <option value="kademe">Kademe sırasına göre</option>
                    <option value="sube">Şube içi sıraya göre</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ayrilanlar}
                    onChange={(e) => setAyrilanlar(e.target.checked)}
                    className="w-5 h-5 accent-blue-500"
                  />
                  Ayrılanları göster
                </label>
              </div>
            </section>

            <section className={kart}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm text-gray-400">
                  {!guncel ? (
                    hata ? (
                      'Veri alınamadı.'
                    ) : (
                      'Yükleniyor…'
                    )
                  ) : (
                    <>
                      Gösterilen <b className="text-blue-400">{gorunen.length}</b> öğrenci
                      {sube && (
                        <>
                          {' '}
                          ({kademe}-{sube}; kademede toplam {tablo.length})
                        </>
                      )}
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  <b>K</b> = kopya · <b>—</b> = girmedi · boş = kayıt yok · aynı puan aynı sırayı paylaşır
                </p>
              </div>

              {guncel && gizliSatirVar(gorunen) && kademeSinavlari.length > 0 && (
                <p className="text-sm text-amber-300 bg-amber-900/20 border border-amber-700 rounded px-3 py-2 mb-3">
                  Ünite puanları yalnızca yetkili olduğun şubeler için gösterilir. Diğer şubelerin ünite hücreleri
                  (gri) boş kalır; toplam puan ve sıralar herkes için görünür.
                </p>
              )}
              {guncel && uyumsuzSayisi > 0 && (
                <p className="text-sm text-red-200 bg-red-900/30 border border-red-700 rounded px-3 py-2 mb-3">
                  ⚠ {uyumsuzSayisi} satırda ünite puanlarının toplamı sıralamadaki toplamla uyuşmuyor. Simgenin üzerine
                  gelince ayrıntı görünür.
                </p>
              )}
              {guncel && kademeSinavlari.length === 0 && (
                <p className="text-sm text-gray-500 mb-3">
                  Bu kademe için sınav tanımlı değil; ünite sütunu yok. Sınavları "Sezon ve Sınavlar" sayfasından ekleyebilirsin.
                </p>
              )}

              {!guncel ? null : gorunen.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">Bu seçimde öğrenci yok.</p>
              ) : (
                <div className="overflow-x-auto max-h-[36rem] overflow-y-auto border border-gray-700 rounded-lg">
                  <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 z-[4]">
                      <tr>
                        <th className={baslikSinifi} style={sabit('sira1', true)} title="Kademedeki sıra">
                          Kademe sırası
                        </th>
                        <th className={baslikSinifi} style={sabit('sira2', true)} title="Şubedeki sıra">
                          Şube sırası
                        </th>
                        <th className={baslikSinifi} style={sabit('no', true)}>
                          Öğrenci No
                        </th>
                        <th className={baslikSinifi} style={sabit('ad', true)}>
                          Ad Soyad
                        </th>
                        <th className={baslikSinifi}>Şube</th>
                        {kademeSinavlari.map((s) => {
                          const b = sinavBasligi(s)
                          return (
                            <th key={s.id} className={`${baslikSinifi} text-center`} title={b.aciklama}>
                              {b.kisa}
                            </th>
                          )
                        })}
                        <th className={`${baslikSinifi} text-center`} title="Girdi + kopya: kopya çeken öğrenci sınava girmiş sayılır">
                          Girdiği sınav
                        </th>
                        <th className={`${baslikSinifi} text-center`}>Toplam puan</th>
                        <th className={`${baslikSinifi} text-center`}>Kopya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gorunen.map((s) => (
                        <tr key={s.ogrenciId} className={s.aktif ? '' : 'text-gray-500'}>
                          <td className="py-2 px-3 font-black text-blue-400 text-center bg-gray-800 border-b border-gray-700/60" style={sabit('sira1')}>
                            {s.kademeSirasi}
                          </td>
                          <td className="py-2 px-3 font-bold text-center bg-gray-800 border-b border-gray-700/60" style={sabit('sira2')}>
                            {s.subeSirasi}
                          </td>
                          <td className="py-2 px-3 bg-gray-800 border-b border-gray-700/60" style={sabit('no')}>
                            {s.no}
                          </td>
                          <td className="py-2 px-3 font-semibold bg-gray-800 border-b border-gray-700/60" style={sabit('ad')}>
                            {s.ad}
                            {s.kopya > 0 && (
                              <span
                                className="ml-2 inline-block px-1.5 rounded border border-red-600 bg-red-900/50 text-red-200 text-xs font-bold"
                                title={`${s.kopya} sınavda kopya`}
                              >
                                K
                              </span>
                            )}
                            {!s.aktif && (
                              <span className="ml-2 inline-block px-1.5 rounded border border-gray-600 bg-gray-700 text-gray-300 text-xs font-bold">
                                Ayrıldı
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 border-b border-gray-700/60">{s.sube ?? '—'}</td>
                          {s.hucreler.map((h) => (
                            <td
                              key={h.sinavId}
                              className={`py-2 px-3 text-center border-b border-gray-700/60 ${
                                h.durum === 'gizli' ? 'bg-gray-900/70' : ''
                              } ${h.durum === 'kopya' ? 'text-red-300 font-bold' : ''} ${
                                h.durum === 'girmedi' ? 'text-gray-500' : ''
                              }`}
                            >
                              {hucreMetni(h)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-center border-b border-gray-700/60">{s.sinavSayisi}</td>
                          <td className="py-2 px-3 text-center font-black text-green-400 border-b border-gray-700/60">
                            {s.toplam}
                            {s.uyumsuz && (
                              <span className="ml-1 text-red-400 cursor-help" title={s.uyumsuz}>
                                ⚠
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center border-b border-gray-700/60">
                            {s.kopya > 0 ? (
                              <span className="inline-block px-2 rounded border border-red-600 bg-red-900/50 text-red-200 font-bold">
                                {s.kopya}
                              </span>
                            ) : (
                              <span className="text-gray-600">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
