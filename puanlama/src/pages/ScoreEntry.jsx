import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hataMetni } from '../lib/hatalar'
import { tarihYaz } from '../lib/format'
import { tumOgrencileriGetir } from '../lib/ogrenciler'
import { personelAdlari, puanlariYaz, sinavPuanlariniGetir } from '../lib/puanlar'
import {
  BOS_SATIR,
  kaydedilecekler,
  kayittanSatir,
  numaraSirala,
  ozetHesapla,
  satirDegerlendir,
  yapistirmaUygula,
} from '../lib/puanGirisi'
import ScorePasteBox from '../components/ScorePasteBox'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme, kart } from '../lib/stil'

const CIKIS_UYARISI = 'Kaydedilmemiş değişiklikler var. Devam edersen kaybolacaklar. Devam edilsin mi?'

const zamanYaz = (iso) =>
  new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// Bir sınavın kayıtlı puanlarını ve kaydeden kişilerin adlarını yükler
async function depoYukle(sinavId) {
  const r = await sinavPuanlariniGetir(sinavId)
  if (r.error) return { hata: hataMetni(r.error) }
  const idler = [...new Set(r.kayitlar.map((k) => k.entered_by).filter(Boolean))]
  return { sinavId, harita: r.harita, kayitlar: r.kayitlar, adlar: await personelAdlari(idler) }
}

export default function ScoreEntry() {
  const [sezon, setSezon] = useState(null)
  const [sinavlar, setSinavlar] = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')

  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('')
  const [sinavId, setSinavId] = useState('')

  const [depo, setDepo] = useState(null) // { sinavId, harita, kayitlar, adlar }
  const [satirlar, setSatirlar] = useState({}) // ogrenci id -> { deger, isaret }  (isaret: '' | 'girmedi' | 'kopya')
  const [kurulum, setKurulum] = useState(0) // satırlar yeniden kurulunca artar (ilk kutuya odaklanmak için)
  const [yapistirAcik, setYapistirAcik] = useState(false)
  const [kaydediyor, setKaydediyor] = useState(false)

  const girisRefs = useRef([])
  const kaydetRef = useRef(null)

  // --- İlk yükleme: aktif sezon, sınavlar, öğrenciler ---
  useEffect(() => {
    let iptal = false
    async function yukle() {
      const { data: s, error: sHata } = await supabase.from('wc_seasons').select('*').eq('is_active', true).maybeSingle()
      if (iptal) return
      if (sHata) {
        setHata(hataMetni(sHata))
        return setYukleniyor(false)
      }
      if (s) {
        setSezon(s)
        const { data: ex, error: eHata } = await supabase
          .from('wc_exams')
          .select('*')
          .eq('season_id', s.id)
          .order('grade')
          .order('unit_no')
        if (eHata) setHata(hataMetni(eHata))
        else setSinavlar(ex)
      }
      const { data: ogr, error: oHata } = await tumOgrencileriGetir()
      if (iptal) return
      if (oHata) setHata(hataMetni(oHata))
      else setOgrenciler(ogr)
      setYukleniyor(false)
    }
    yukle()
    return () => {
      iptal = true
    }
  }, [])

  // --- Türetilen listeler ---
  const aktifler = useMemo(() => ogrenciler.filter((o) => o.is_active !== false), [ogrenciler])
  const kademeler = useMemo(() => [...new Set(aktifler.map((o) => o.grade))].sort((a, b) => a - b), [aktifler])
  const subeler = useMemo(
    () =>
      [...new Set(aktifler.filter((o) => o.grade === Number(kademe)).map((o) => o.class_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'tr')
      ),
    [aktifler, kademe]
  )
  const kademeSinavlari = useMemo(() => sinavlar.filter((s) => s.grade === Number(kademe)), [sinavlar, kademe])
  const sinav = sinavlar.find((s) => s.id === sinavId) ?? null
  const liste = useMemo(
    () =>
      kademe && sube ? numaraSirala(aktifler.filter((o) => o.grade === Number(kademe) && o.class_name === sube)) : [],
    [aktifler, kademe, sube]
  )

  // --- Seçilen sınavın kayıtlı puanları ---
  useEffect(() => {
    setDepo(null)
    if (!sinavId) return
    let iptal = false
    depoYukle(sinavId).then((d) => {
      if (iptal) return
      if (d.hata) setHata(d.hata)
      else setDepo(d)
    })
    return () => {
      iptal = true
    }
  }, [sinavId])

  const hazir = Boolean(depo && depo.sinavId === sinavId && sinav && sube && liste.length)

  // Kayıtlı puanları kutulara doldur (seçim ya da kayıt sonrası)
  useEffect(() => {
    if (!hazir) {
      setSatirlar({})
      return
    }
    const yeni = {}
    for (const o of liste) yeni[o.id] = kayittanSatir(depo.harita.get(o.id))
    setSatirlar(yeni)
    setKurulum((k) => k + 1)
  }, [hazir, depo, liste])

  // Satırlar kurulunca ilk kutuya odaklan
  useEffect(() => {
    if (kurulum > 0) girisRefs.current[0]?.focus()
  }, [kurulum])

  // --- Değerlendirme ---
  const soruSayisi = sinav?.question_count ?? 0
  const degerlendirme = useMemo(
    () =>
      hazir
        ? liste.map((o) => ({
            ogrenci: o,
            d: satirDegerlendir(satirlar[o.id] ?? BOS_SATIR, depo.harita.get(o.id), soruSayisi),
          }))
        : [],
    [hazir, liste, satirlar, depo, soruSayisi]
  )
  const ozet = useMemo(() => ozetHesapla(degerlendirme, sinav?.points_per_question ?? 0), [degerlendirme, sinav])
  const kirli = ozet.degisen > 0

  // Bu şubenin öğrencileri arasında en son kaydeden kişi
  const sonKaydeden = useMemo(() => {
    if (!hazir) return null
    const idler = new Set(liste.map((o) => o.id))
    const son = depo.kayitlar.filter((k) => idler.has(k.student_id)).reduce((a, k) => (!a || k.updated_at > a.updated_at ? k : a), null)
    return son ? { ad: depo.adlar.get(son.entered_by) ?? null, zaman: son.updated_at } : null
  }, [hazir, liste, depo])

  // --- Kaydetmeden çıkış uyarıları ---
  useEffect(() => {
    if (!kirli) return
    const uyar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', uyar)
    return () => window.removeEventListener('beforeunload', uyar)
  }, [kirli])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => kirli && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(CIKIS_UYARISI)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  // Seçim değişirken kaydedilmemiş değişiklik varsa sor
  function degistir(uygula) {
    if (kirli && !window.confirm(CIKIS_UYARISI)) return
    setBilgi('')
    setHata('')
    setYapistirAcik(false)
    uygula()
  }
  const kademeSec = (v) =>
    degistir(() => {
      setKademe(v)
      setSube('')
      setSinavId('')
    })
  const subeSec = (v) => degistir(() => setSube(v))
  const sinavSec = (v) => degistir(() => setSinavId(v))

  // --- Satır işlemleri ---
  const satirGuncelle = (id, yama) => setSatirlar((s) => ({ ...s, [id]: { ...(s[id] ?? BOS_SATIR), ...yama } }))

  function odakla(i, yon) {
    for (let k = i + yon; k >= 0 && k < liste.length; k += yon) {
      const el = girisRefs.current[k]
      if (el && !el.readOnly) {
        el.focus()
        return true
      }
    }
    return false
  }

  function tusBasildi(e, i, ogrenci) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!odakla(i, 1)) kaydetRef.current?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      odakla(i, -1)
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && ['g', 'k'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      satirGuncelle(ogrenci.id, { isaret: e.key.toLowerCase() === 'g' ? 'girmedi' : 'kopya', deger: '' })
      odakla(i, 1)
    }
  }

  // Girmedi/Kopya kutusu. İşaret tek alan olduğu için biri seçilince diğeri kendiliğinden kalkar.
  function isaretDegistir(ogrenci, i, isaret, acik) {
    if (acik) {
      satirGuncelle(ogrenci.id, { isaret, deger: '' })
    } else {
      satirGuncelle(ogrenci.id, { isaret: '' })
      girisRefs.current[i]?.focus()
    }
  }

  // --- Kaydet ---
  const kayit = useMemo(() => kaydedilecekler(degerlendirme, sinavId), [degerlendirme, sinavId])
  const kaydetilebilir = kirli && kayit.gecersiz === 0 && kayit.yazilacak.length > 0 && !kaydediyor

  async function kaydet() {
    if (!kaydetilebilir) return
    setKaydediyor(true)
    setHata('')
    setBilgi('')
    const { error } = await puanlariYaz(kayit.yazilacak)
    if (error) {
      setHata(hataMetni(error))
      return setKaydediyor(false)
    }
    const d = await depoYukle(sinavId)
    if (d.hata) setHata(d.hata)
    else setDepo(d)
    setBilgi(`${kayit.yazilacak.length} öğrenci kaydedildi.`)
    setKaydediyor(false)
  }

  function yapistirmaUygula_(uygulanacak) {
    setSatirlar((s) => yapistirmaUygula(s, uygulanacak))
    setYapistirAcik(false)
    setBilgi(`${uygulanacak.length} öğrencinin değeri kutulara yazıldı. Henüz kaydedilmedi: kontrol edip Kaydet'e bas.`)
  }

  // Girmedi ve kopya toplamda 0 puan sayılır
  const puanOf = (d) =>
    d.durum === 'girdi' ? d.dogru * sinav.points_per_question : d.durum === 'girmedi' || d.durum === 'kopya' ? 0 : null

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Puan Girişi</h1>
            <p className="text-gray-400 mt-1">
              {sezon ? `Sezon ${sezon.name}` : 'Sınav puanlarını şube şube gir'}
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
        {bilgi && (
          <div className="bg-green-900/40 border border-green-600 text-green-200 px-4 py-3 rounded">{bilgi}</div>
        )}

        {yukleniyor ? (
          <p className="text-gray-400">Yükleniyor…</p>
        ) : !sezon ? (
          <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">
            Aktif sezon bulunamadı.
          </div>
        ) : (
          <>
            <section className={kart}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={etiketSinifi} htmlFor="p-kademe">
                    Kademe
                  </label>
                  <select id="p-kademe" className={girdiSinifi} value={kademe} onChange={(e) => kademeSec(e.target.value)}>
                    <option value="">Seç…</option>
                    {kademeler.map((k) => (
                      <option key={k} value={k}>
                        {k}. kademe
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="p-sube">
                    Şube
                  </label>
                  <select
                    id="p-sube"
                    className={girdiSinifi}
                    value={sube}
                    disabled={!kademe}
                    onChange={(e) => subeSec(e.target.value)}
                  >
                    <option value="">Seç…</option>
                    {subeler.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="p-sinav">
                    Sınav
                  </label>
                  <select
                    id="p-sinav"
                    className={girdiSinifi}
                    value={sinavId}
                    disabled={!kademe}
                    onChange={(e) => sinavSec(e.target.value)}
                  >
                    <option value="">Seç…</option>
                    {kademeSinavlari.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.unit_no}. ünite{s.exam_date ? ` — ${tarihYaz(s.exam_date)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {kademe && kademeSinavlari.length === 0 && (
                <p className="text-sm text-amber-300 mt-3">
                  Bu kademe için sınav tanımlı değil. "Sezon ve Sınavlar" sayfasından ekleyebilirsin.
                </p>
              )}
              {!aktifler.length && (
                <p className="text-sm text-amber-300 mt-3">Henüz aktif öğrenci yok. Önce öğrenci içe aktar.</p>
              )}
            </section>

            {kademe && sube && sinav && !hazir && !hata && <p className="text-gray-400">Puanlar yükleniyor…</p>}

            {hazir && (
              <>
                <section className={kart}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-200">
                        {kademe}-{sube} · {sinav.unit_no}. ünite
                      </h2>
                      <p className="text-sm text-gray-400">
                        {liste.length} öğrenci · {sinav.question_count} soru × {sinav.points_per_question} puan ={' '}
                        {sinav.question_count * sinav.points_per_question} puan
                      </p>
                    </div>
                    <button onClick={() => setYapistirAcik((a) => !a)} className={ikincilDugme}>
                      Excel'den yapıştır
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Tab/Enter sonraki öğrenciye geçer, kutuda <b>G</b> tuşu "girmedi", <b>K</b> tuşu "kopya" işaretler. Boş bırakılan kutu
                    kaydedilmez (boş ile "girmedi" farklıdır). Kayıtlı bir puan silinemez: yanlış girişi düzeltmek için
                    değeri değiştir ya da "Girmedi"/"Kopya" yap.
                  </p>

                  <div className="overflow-x-auto border border-gray-700 rounded-lg">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-800">
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="py-2 px-3">Öğrenci No</th>
                          <th className="py-2 px-3">Ad Soyad</th>
                          <th className="py-2 px-3">Doğru sayısı</th>
                          <th className="py-2 px-3">Girmedi</th>
                          <th className="py-2 px-3">Kopya</th>
                          <th className="py-2 px-3">Puan</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {degerlendirme.map(({ ogrenci: o, d }, i) => {
                          const satir = satirlar[o.id] ?? BOS_SATIR
                          const puan = puanOf(d)
                          return (
                            <tr
                              key={o.id}
                              className={`border-b border-gray-700/60 align-top ${
                                d.degisti ? 'bg-amber-900/20' : ''
                              } ${satir.isaret === 'girmedi' ? 'text-gray-500' : ''} ${
                                satir.isaret === 'kopya' ? 'bg-red-900/20 text-red-300' : ''
                              }`}
                            >
                              <td className="py-2 px-3">{o.student_no}</td>
                              <td className="py-2 px-3 font-semibold">{o.full_name}</td>
                              <td className="py-2 px-3">
                                <input
                                  ref={(el) => {
                                    girisRefs.current[i] = el
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={satir.deger}
                                  readOnly={satir.isaret !== ''}
                                  tabIndex={satir.isaret !== '' ? -1 : 0}
                                  aria-label={`${o.full_name} doğru sayısı`}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => satirGuncelle(o.id, { deger: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                  onKeyDown={(e) => tusBasildi(e, i, o)}
                                  onClick={() => satir.isaret !== '' && isaretDegistir(o, i, '', false)}
                                  title={
                                    satir.isaret !== ''
                                      ? `${satir.isaret === 'kopya' ? 'Kopya' : 'Girmedi'} işaretini kaldırmak için tıkla`
                                      : undefined
                                  }
                                  className={`w-24 text-center text-lg font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                                    d.durum === 'gecersiz'
                                      ? 'bg-red-900/40 border-red-500 text-red-200'
                                      : satir.isaret !== ''
                                        ? 'bg-gray-800 border-gray-700 cursor-pointer'
                                        : 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                  }`}
                                />
                                {d.durum === 'gecersiz' && <p className="text-xs text-red-300 mt-1">{d.hata}</p>}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  tabIndex={-1}
                                  checked={satir.isaret === 'girmedi'}
                                  onChange={(e) => isaretDegistir(o, i, 'girmedi', e.target.checked)}
                                  aria-label={`${o.full_name} girmedi`}
                                  className="w-5 h-5 accent-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  tabIndex={-1}
                                  checked={satir.isaret === 'kopya'}
                                  onChange={(e) => isaretDegistir(o, i, 'kopya', e.target.checked)}
                                  aria-label={`${o.full_name} kopya`}
                                  className="w-5 h-5 accent-red-500"
                                />
                              </td>
                              <td className="py-2 px-3 font-bold">{puan === null ? '—' : puan}</td>
                              <td className="py-2 px-3 text-xs">
                                {d.durum === 'kopya' && (
                                  <span className="inline-block mr-2 px-2 py-0.5 rounded border border-red-600 bg-red-900/50 text-red-200 font-bold">
                                    KOPYA
                                  </span>
                                )}
                                {d.degisti && d.durum !== 'gecersiz' && (
                                  <span className="text-amber-300 font-bold">değişti</span>
                                )}
                                {d.korunur && (
                                  <span className="text-gray-400">
                                    Kayıtlı puan silinemez; değiştir ya da Girmedi/Kopya yap. Boşsa mevcut puan korunur.
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {yapistirAcik && (
                  <ScorePasteBox
                    ogrenciler={liste}
                    soruSayisi={soruSayisi}
                    satirlar={satirlar}
                    onUygula={yapistirmaUygula_}
                    onKapat={() => setYapistirAcik(false)}
                  />
                )}

                <div className="sticky bottom-0 z-10 bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>
                      Girildi <b className="text-green-400">{ozet.girdi}</b> · Girmedi{' '}
                      <b className="text-gray-100">{ozet.girmedi}</b> · Kopya{' '}
                      <b className="text-red-400">{ozet.kopya}</b> · Boş <b className="text-amber-300">{ozet.bos}</b>
                      {ozet.gecersiz > 0 && (
                        <>
                          {' '}
                          · Hatalı <b className="text-red-400">{ozet.gecersiz}</b>
                        </>
                      )}{' '}
                      · Şube ortalaması (girenler):{' '}
                      <b className="text-blue-400">{ozet.ortalama === null ? '—' : `${ozet.ortalama.toLocaleString('tr-TR')} puan`}</b>
                    </p>
                    <p className="text-xs text-gray-500">
                      {sonKaydeden
                        ? `Son kaydeden: ${sonKaydeden.ad ?? 'bilinmiyor'} · ${zamanYaz(sonKaydeden.zaman)}`
                        : 'Bu şube için henüz kayıt yok.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {kirli && (
                      <span className="text-sm text-amber-300 font-bold">
                        {ozet.degisen} satırda kaydedilmemiş değişiklik
                      </span>
                    )}
                    <button ref={kaydetRef} onClick={kaydet} disabled={!kaydetilebilir} className={anaDugme}>
                      {kaydediyor ? 'Kaydediliyor…' : `Kaydet (${kayit.yazilacak.length})`}
                    </button>
                  </div>
                </div>
                {kayit.gecersiz > 0 && (
                  <p className="text-sm text-red-300 -mt-3">
                    {kayit.gecersiz} satırda geçersiz değer var; düzeltmeden kaydedilemez.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
