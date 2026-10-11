import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni } from '../lib/hatalar'
import { sezonVeSinavlar, uniteSonuclariGetir } from '../lib/siralamaVeri'
import {
  FONKSIYON_YOK_MESAJI,
  CIKTI_GENISLIGI,
  baslikMetni,
  ekranOlcegi,
  fonksiyonYokMu,
  ogrenciSatirlari,
  otomatikSutunSayisi,
  paylasimDestekleniyorMu,
  paylasimHataMesaji,
  pngDosyaAdi,
  satirOlculeri,
  sonuclariSirala,
  sutunlaraBol,
} from '../lib/uniteSonuclari'
import { denemeDosyasi, pngIndir, pngPaylas, pngUret } from '../lib/pngIndir'
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

  // Ekranda çıktı alanı kabın genişliğine sığdırılır (kaydırma yok). Yalnızca görünümü etkiler, PNG'yi değil.
  const kapRef = useRef(null)
  const ciktiRef = useRef(null)
  const [olcek, setOlcek] = useState(1)
  const [ciktiYuksekligi, setCiktiYuksekligi] = useState(0)
  const gorunur = guncel && satirlar.length > 0
  useEffect(() => {
    if (!gorunur) return
    const olc = () => {
      setOlcek(ekranOlcegi(kapRef.current.clientWidth))
      setCiktiYuksekligi(ciktiRef.current.offsetHeight)
    }
    olc()
    const gozlemci = new ResizeObserver(olc)
    gozlemci.observe(kapRef.current)
    gozlemci.observe(ciktiRef.current)
    return () => gozlemci.disconnect()
  }, [gorunur])

  // PNG: cihaz ekranı ne olursa olsun çıktı alanı 1500 px genişlikte, 2x piksel oranıyla üretilir.
  // İki ayrı işlem: İndir (doğrudan dosya) ve Paylaş (paylaşma menüsü; desteklenmiyorsa düğme gösterilmez).
  const [png, setPng] = useState({ durum: 'bos', mesaj: '' }) // durum: 'bos' | 'uretiliyor' | 'tamam' | 'hata'
  const [paylasabilir, setPaylasabilir] = useState(false)
  // Destek sayfa açılınca bir kez denenir; boş değil, gerçek küçük bir PNG dosyasıyla (bazı tarayıcılar boş dosyayı reddeder)
  useEffect(() => setPaylasabilir(paylasimDestekleniyorMu(navigator, denemeDosyasi())), [])
  // Seçim değişince eski sonuç mesajı silinir
  useEffect(() => setPng({ durum: 'bos', mesaj: '' }), [kademe, uniteNo])

  async function pngAl(islem) {
    setPng({ durum: 'uretiliyor', mesaj: '' })
    let blob
    try {
      blob = await pngUret(ciktiRef.current)
    } catch (e) {
      console.error('PNG hatası:', e)
      setPng({ durum: 'hata', mesaj: 'Resim oluşturulamadı. Sayfayı yenileyip tekrar dene.' })
      return
    }
    const ad = pngDosyaAdi(kademe, uniteNo)
    if (islem === 'indir') {
      pngIndir(blob, ad)
      setPng({ durum: 'tamam', mesaj: 'Resim indirildi.' })
      return
    }
    try {
      const sonuc = await pngPaylas(blob, ad)
      // Menü iptal edilirse hiçbir şey indirilmez ve mesaj gösterilmez
      setPng(sonuc === 'paylasildi' ? { durum: 'tamam', mesaj: 'Resim paylaşma menüsüne gönderildi.' } : { durum: 'bos', mesaj: '' })
    } catch (e) {
      console.error('Paylaşma hatası:', e)
      setPng({ durum: 'hata', mesaj: paylasimHataMesaji(e) })
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-10 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
            <div>
              <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Ünite Sonuçları</h1>
              <p className="text-gray-400 mt-1">
                {sezon ? `Sezon ${sezon.name} · sonuç listesini resim olarak indirebilirsin` : 'Velilere paylaşılacak sonuç listesi'}
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
              {gorunur && (
                <div className="mt-5">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => pngAl('indir')}
                      disabled={png.durum === 'uretiliyor'}
                      className="w-full sm:w-auto min-h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold text-lg py-3 px-8 rounded-xl transition-colors"
                    >
                      {png.durum === 'uretiliyor' ? 'Resim hazırlanıyor…' : 'İndir (PNG)'}
                    </button>
                    {paylasabilir && (
                      <button
                        type="button"
                        onClick={() => pngAl('paylas')}
                        disabled={png.durum === 'uretiliyor'}
                        className="w-full sm:w-auto min-h-14 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-extrabold text-lg py-3 px-8 rounded-xl border border-gray-500 transition-colors"
                      >
                        Paylaş
                      </button>
                    )}
                  </div>
                  {png.mesaj && (
                    <p className={`text-sm mt-2 ${png.durum === 'hata' ? 'text-red-300' : 'text-green-400'}`}>{png.mesaj}</p>
                  )}
                </div>
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

      </div>

      {gorunur && (
        <div ref={kapRef} className="max-w-[1500px] mx-auto" style={{ height: ciktiYuksekligi * olcek }}>
          <div style={{ width: CIKTI_GENISLIGI, transform: `scale(${olcek})`, transformOrigin: 'top left' }}>
            <div ref={ciktiRef} className={`cikti ${sutunSayisi === 1 ? 'cikti-tek' : ''}`} lang="tr">
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
        </div>
      )}
    </div>
  )
}
