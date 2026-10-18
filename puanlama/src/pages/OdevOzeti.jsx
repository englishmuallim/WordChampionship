import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni, odevTablosuYokMu, ODEV_TABLOSU_YOK_MESAJI } from '../lib/hatalar'
import { tarihYaz } from '../lib/format'
import { tumOgrencileriGetir } from '../lib/ogrenciler'
import { sezonVeSinavlar, sinavPuanlariniGetir } from '../lib/siralamaVeri'
import { odevKayitlariniGetir } from '../lib/odevVeri'
import { ozetSatirlariniHazirla, ozetSirala, ozetToplami, sinavUyarilari } from '../lib/odev'
import { csvDosyaAdi, dokumCsv, ozetCsv } from '../lib/csv'
import { metinIndir } from '../lib/dosyaIndir'
import { KADEMELER } from '../components/ExamForm'
import { etiketSinifi, girdiSinifi, ikincilDugme, kart } from '../lib/stil'

const imzali = (n) => (n > 0 ? `+${n}` : String(n))
// Artı ve eksi sayıları: sıfır ise "0" ve soluk renk (kırmızı "-0" görünmesin)
const ArtiSayi = ({ n }) => (n > 0 ? <span className="text-green-400">+{n}</span> : <span className="text-gray-500">0</span>)
const EksiSayi = ({ n }) => (n > 0 ? <span className="text-red-400">-{n}</span> : <span className="text-gray-500">0</span>)

// Bir kademenin sınav puanları ile ödev kayıtlarını yükler
async function kademeVerisiYukle(sinavIdleri) {
  const [puan, kayit] = await Promise.all([sinavPuanlariniGetir(sinavIdleri), odevKayitlariniGetir(sinavIdleri)])
  const hata = puan.error ?? kayit.error
  if (hata) return { hata: odevTablosuYokMu(hata) ? ODEV_TABLOSU_YOK_MESAJI : hataMetni(hata) }
  return { puanlar: puan.data, kontroller: kayit.kontroller, duzeltmeler: kayit.duzeltmeler }
}

export default function OdevOzeti() {
  const [sezon, setSezon] = useState(null)
  const [sinavlar, setSinavlar] = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')

  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('') // '' = tümü (öğretmen için: yetkili olduğu tüm şubeler)
  const [donem, setDonem] = useState('tumu') // 'tumu' | '1' | '2'
  const [ayrilanlar, setAyrilanlar] = useState(false)
  const [siralama, setSiralama] = useState('ad') // 'ad' | 'net-azalan' | 'net-artan'
  const [acik, setAcik] = useState(new Set()) // dökümü açık öğrenciler

  const [veri, setVeri] = useState(null) // { kademe, puanlar, kontroller, duzeltmeler }

  // --- İlk yükleme: aktif sezon, sınavlar, öğrenciler ---
  useEffect(() => {
    let iptal = false
    async function yukle() {
      const [sv, ogr] = await Promise.all([sezonVeSinavlar(), tumOgrencileriGetir()])
      if (iptal) return
      if (sv.error || ogr.error) setHata(hataMetni(sv.error ?? ogr.error))
      else {
        setSezon(sv.sezon)
        setSinavlar(sv.sinavlar)
        setOgrenciler(ogr.data)
      }
      setYukleniyor(false)
    }
    yukle()
    return () => {
      iptal = true
    }
  }, [])

  const kademeSinavlari = useMemo(() => sinavlar.filter((s) => s.grade === Number(kademe)), [sinavlar, kademe])
  const kademeOgrencileri = useMemo(() => ogrenciler.filter((o) => o.grade === Number(kademe)), [ogrenciler, kademe])
  const kademeler = useMemo(() => KADEMELER.filter((k) => ogrenciler.some((o) => o.grade === k)), [ogrenciler])
  const subeler = useMemo(
    () => [...new Set(kademeOgrencileri.map((o) => o.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [kademeOgrencileri]
  )

  // --- Seçilen kademenin verisi (sezondaki tüm sınavlar) ---
  useEffect(() => {
    setVeri(null)
    if (!kademe) return
    const idler = kademeSinavlari.map((s) => s.id)
    let iptal = false
    setHata('')
    kademeVerisiYukle(idler).then((d) => {
      if (iptal) return
      if (d.hata) setHata(d.hata)
      else setVeri({ kademe, ...d })
    })
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kademe, sinavlar])

  const hazir = Boolean(veri && veri.kademe === kademe)
  const donemDegeri = donem === 'tumu' ? 'tumu' : Number(donem)

  // --- Özet satırları (Ödev Kontrolü ile aynı hesap) ---
  const satirlar = useMemo(() => {
    if (!hazir) return []
    const liste = kademeOgrencileri.filter((o) => (ayrilanlar || o.is_active !== false) && (!sube || o.class_name === sube))
    return ozetSirala(
      ozetSatirlariniHazirla({
        ogrenciler: liste,
        sinavlar: kademeSinavlari,
        puanlar: veri.puanlar,
        kontroller: veri.kontroller,
        duzeltmeler: veri.duzeltmeler,
        donem: donemDegeri,
      }),
      siralama
    )
  }, [hazir, veri, kademeOgrencileri, kademeSinavlari, ayrilanlar, sube, donemDegeri, siralama])
  const toplam = useMemo(() => ozetToplami(satirlar), [satirlar])
  const uyarilar = useMemo(() => (hazir ? sinavUyarilari(kademeSinavlari, veri.puanlar) : { tarihsiz: [], tanimsiz: [] }), [hazir, veri, kademeSinavlari])

  function kademeSec(v) {
    setKademe(v)
    setSube('')
    setAcik(new Set())
  }
  const dokumuAcKapa = (id) =>
    setAcik((a) => {
      const yeni = new Set(a)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  // Net başlığı: azalan → artan → ad sırası
  const netSirala = () => setSiralama((s) => (s === 'net-azalan' ? 'net-artan' : s === 'net-artan' ? 'ad' : 'net-azalan'))

  function csvIndir(tur) {
    const metin = tur === 'dokum' ? dokumCsv(satirlar, donemDegeri) : ozetCsv(satirlar, donemDegeri)
    metinIndir(metin, csvDosyaAdi(tur, kademe, sube, donemDegeri))
  }

  const donemAdi = donem === 'tumu' ? 'tüm dönemler' : `${donem}. dönem`

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Ödev Özeti</h1>
            <p className="text-gray-400 mt-1">{sezon ? `Sezon ${sezon.name} · sözlü notu için ödev artı ve eksileri` : 'Öğrenci bazında ödev artı ve eksileri'}</p>
          </div>
          <Link
            to="/"
            className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
          >
            ← Ana sayfa
          </Link>
        </header>

        {hata && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{hata}</div>}

        {yukleniyor ? (
          <p className="text-gray-400">Yükleniyor…</p>
        ) : !sezon ? (
          <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">Aktif sezon bulunamadı.</div>
        ) : (
          <>
            <section className={kart}>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className={etiketSinifi} htmlFor="z-kademe">
                    Kademe
                  </label>
                  <select id="z-kademe" className={girdiSinifi} value={kademe} onChange={(e) => kademeSec(e.target.value)}>
                    <option value="">Seç…</option>
                    {kademeler.map((k) => (
                      <option key={k} value={k}>
                        {k}. kademe
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="z-sube">
                    Şube
                  </label>
                  <select id="z-sube" className={girdiSinifi} value={sube} disabled={!kademe} onChange={(e) => setSube(e.target.value)}>
                    <option value="">Tümü</option>
                    {subeler.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="z-donem">
                    Dönem
                  </label>
                  <select id="z-donem" className={girdiSinifi} value={donem} onChange={(e) => setDonem(e.target.value)}>
                    <option value="tumu">Tümü</option>
                    <option value="1">1. dönem (Eylül-Ocak)</option>
                    <option value="2">2. dönem (Şubat sonrası)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 pb-2 cursor-pointer">
                  <input type="checkbox" checked={ayrilanlar} onChange={(e) => setAyrilanlar(e.target.checked)} className="w-5 h-5 accent-blue-500" />
                  Ayrılanları göster
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Dönem her kaydın tarihine göredir (kontrol ve düzeltme tarihi; otomatik artıda sınav tarihi). Öğretmen yalnızca yetkili olduğu şubeleri görür.
              </p>
            </section>

            {kademe && !hazir && !hata && <p className="text-gray-400">Yükleniyor…</p>}

            {hazir && (
              <>
                {uyarilar.tarihsiz.length > 0 && (
                  <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded text-sm space-y-1">
                    {uyarilar.tarihsiz.map((u) => (
                      <p key={u.unite}>⚠ {u.mesaj}.</p>
                    ))}
                    <p className="text-amber-300/80">Tarihleri "Sezon ve Sınavlar" sayfasından girebilirsin.</p>
                  </div>
                )}
                {uyarilar.tanimsiz.length > 0 && (
                  <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded text-sm space-y-1">
                    {uyarilar.tanimsiz.map((u) => (
                      <p key={u.unite}>⚠ {u.mesaj}.</p>
                    ))}
                  </div>
                )}
                {donem !== 'tumu' && toplam.tarihsiz > 0 && (
                  <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded text-sm">
                    ⚠ {toplam.tarihsiz} kalem tarihsiz olduğu için {donemAdi} toplamlarına sayılmadı. "Tümü" seçince sayılır.
                  </div>
                )}

                <section className={kart}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm text-gray-400">
                      Gösterilen <b className="text-blue-400">{satirlar.length}</b> öğrenci · {donemAdi}
                      {sube ? ` · ${kademe}-${sube}` : ` · ${kademe}. kademe`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => csvIndir('ozet')} disabled={!satirlar.length} className={ikincilDugme}>
                        Özet CSV indir
                      </button>
                      <button type="button" onClick={() => csvIndir('dokum')} disabled={!satirlar.length} className={ikincilDugme}>
                        Döküm CSV indir
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-300 mb-3">Bu dosya öğrencilere ait notlar içerir; paylaşırken dikkat et.</p>

                  {satirlar.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">Bu seçimde öğrenci yok.</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-700 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-800">
                          <tr className="text-gray-400 border-b border-gray-700">
                            <th className="py-2 px-3">
                              <button type="button" onClick={() => setSiralama('ad')} className="font-bold hover:text-white" title="Ad soyada göre sırala">
                                Ad Soyad{siralama === 'ad' ? ' ▲' : ''}
                              </button>
                            </th>
                            {!sube && <th className="py-2 px-3">Şube</th>}
                            <th className="py-2 px-3 text-center">Artı</th>
                            <th className="py-2 px-3 text-center">Eksi</th>
                            <th className="py-2 px-3 text-center">
                              <button type="button" onClick={netSirala} className="font-bold hover:text-white" title="Nete göre sırala (azalan, artan, ad)">
                                Net{siralama === 'net-azalan' ? ' ▼' : siralama === 'net-artan' ? ' ▲' : ''}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {satirlar.map((s) => {
                            const acikMi = acik.has(s.ogrenciId)
                            return (
                              <FragmentSatir
                                key={s.ogrenciId}
                                s={s}
                                acikMi={acikMi}
                                subeGoster={!sube}
                                onTikla={() => dokumuAcKapa(s.ogrenciId)}
                              />
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-800 font-bold border-t border-gray-600">
                            <td className="py-2 px-3" colSpan={!sube ? 2 : 1}>
                              Toplam ({toplam.ogrenci} öğrenci)
                            </td>
                            <td className="py-2 px-3 text-center"><ArtiSayi n={toplam.arti} /></td>
                            <td className="py-2 px-3 text-center"><EksiSayi n={toplam.eksi} /></td>
                            <td className="py-2 px-3 text-center">{imzali(toplam.net)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Bir öğrencinin satırı ve (açıksa) ünite dökümü
function FragmentSatir({ s, acikMi, subeGoster, onTikla }) {
  const sutun = subeGoster ? 5 : 4
  // Dökümü ödev ünitesine göre grupla
  const gruplar = []
  for (const d of s.dokum) {
    let g = gruplar.find((x) => x.odevUnite === d.odevUnite)
    if (!g) {
      g = { odevUnite: d.odevUnite, satirlar: [] }
      gruplar.push(g)
    }
    g.satirlar.push(d)
  }
  return (
    <>
      <tr className={`border-b border-gray-700/60 hover:bg-gray-800/60 ${s.aktif ? '' : 'text-gray-500'}`}>
        <td className="py-2 px-3">
          <button type="button" onClick={onTikla} aria-expanded={acikMi} className="text-left font-semibold hover:text-blue-300 w-full">
            <span className="text-gray-500 mr-2">{acikMi ? '▾' : '▸'}</span>
            {s.full_name}
            {!s.aktif && (
              <span className="ml-2 inline-block px-1.5 rounded border border-gray-600 bg-gray-700 text-gray-300 text-xs font-bold">Ayrıldı</span>
            )}
            {s.tarihsiz > 0 && (
              <span className="ml-2 inline-block px-1.5 rounded border border-amber-600 bg-amber-900/40 text-amber-200 text-xs font-bold" title="Tarihi olmayan kalem(ler) var">
                ⚠ {s.tarihsiz} tarihsiz
              </span>
            )}
            {s.bantDegisti && (
              <span className="ml-2 inline-block px-1.5 rounded border border-amber-600 bg-amber-900/40 text-amber-200 text-xs font-bold" title="Sınav puanı değişti ya da ödev bandı değişti; eski kayıtlar olduğu gibi duruyor">
                bant değişti
              </span>
            )}
          </button>
        </td>
        {subeGoster && <td className="py-2 px-3">{s.sube ?? '—'}</td>}
        <td className="py-2 px-3 text-center font-bold"><ArtiSayi n={s.arti} /></td>
        <td className="py-2 px-3 text-center font-bold"><EksiSayi n={s.eksi} /></td>
        <td className={`py-2 px-3 text-center font-black ${s.net > 0 ? 'text-green-400' : s.net < 0 ? 'text-red-400' : 'text-gray-300'}`}>{imzali(s.net)}</td>
      </tr>
      {acikMi && (
        <tr className="border-b border-gray-700/60 bg-gray-900/60">
          <td colSpan={sutun} className="py-3 px-6">
            {gruplar.length === 0 ? (
              <p className="text-sm text-gray-500">Bu seçimde kayıt yok.</p>
            ) : (
              <div className="space-y-3">
                {gruplar.map((g) => {
                  const ozet = s.unite.find((u) => u.odevUnite === g.odevUnite)
                  return (
                    <div key={g.odevUnite}>
                      <p className="text-sm font-bold text-gray-300 mb-1">
                        {g.odevUnite}. ünite ödevi{' '}
                        {ozet && (
                          <span className="font-normal text-gray-400">
                            (<ArtiSayi n={ozet.arti} /> / <EksiSayi n={ozet.eksi} />)
                          </span>
                        )}
                      </p>
                      <table className="w-full text-xs">
                        <tbody>
                          {g.satirlar.map((d, i) => (
                            <tr key={i} className="text-gray-300">
                              <td className="py-1 pr-4 w-28">{d.tarih ? tarihYaz(d.tarih) : <span className="text-amber-300">tarihsiz</span>}</td>
                              <td className="py-1 pr-4 w-36">{d.turAdi}</td>
                              <td className={`py-1 pr-4 w-12 font-bold ${d.puan > 0 ? 'text-green-400' : 'text-red-400'}`}>{imzali(d.puan)}</td>
                              <td className="py-1 text-gray-400">{d.aciklama}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
