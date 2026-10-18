import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hataMetni, odevTablosuYokMu, ODEV_TABLOSU_YOK_MESAJI } from '../lib/hatalar'
import { tarihYaz } from '../lib/format'
import { tumOgrencileriGetir } from '../lib/ogrenciler'
import { personelAdlari, sinavPuanlariniGetir } from '../lib/puanlar'
import { sezonVeSinavlar } from '../lib/siralamaVeri'
import { adaGoreSirala } from '../lib/puanGirisi'
import {
  odevDuzeltmeleriniGetir,
  odevDuzeltmeleriniYaz,
  odevKontrolleriniGetir,
  odevKontrolleriniYaz,
} from '../lib/odevVeri'
import {
  ODEV_SORU_SAYISI,
  bantHesapla,
  elleDuzeltmeSatiri,
  gecerliKontroller,
  gorunenSatirlar,
  hizliDugmeler,
  iptalSatiri,
  istanbulBugunu,
  kaydedilecekEkstralar,
  kaydedilecekKontroller,
  kontrolOnizleme,
  kontrolTarihiDogrula,
  odevDurumu,
  odevSatirlariniSirala,
  oncekiToplam,
  satirAlanlari,
  satirDegisti,
  secimDegistir,
  toplamDogrula,
  yapildiMi,
} from '../lib/odev'
import { useKaydedilmemisUyari, CIKIS_UYARISI } from '../lib/kaydedilmemisUyari'
import ElleDuzeltmeKutusu from '../components/ElleDuzeltmeKutusu'
import { KADEMELER } from '../components/ExamForm'
import { anaDugme, etiketSinifi, girdiSinifi, kart } from '../lib/stil'

const zamanYaz = (iso) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const grupla = (satirlar) => {
  const harita = new Map()
  for (const s of satirlar) harita.set(s.student_id, [...(harita.get(s.student_id) ?? []), s])
  return harita
}

// Bir kaynak sınavın puanlarını, ödev kontrollerini ve düzeltmelerini yükler
async function odevVeriYukle(kaynakId) {
  const [puan, kontrol, duzeltme] = await Promise.all([
    sinavPuanlariniGetir(kaynakId),
    odevKontrolleriniGetir(kaynakId),
    odevDuzeltmeleriniGetir(kaynakId),
  ])
  const hata = puan.error ?? kontrol.error ?? duzeltme.error
  if (hata) return { hata: odevTablosuYokMu(hata) ? ODEV_TABLOSU_YOK_MESAJI : hataMetni(hata) }
  const idler = [...new Set(kontrol.data.map((k) => k.entered_by).filter(Boolean))]
  return {
    kaynakId,
    puanlar: puan.harita,
    kontroller: kontrol.data,
    duzeltmeler: duzeltme.data,
    adlar: await personelAdlari(idler),
  }
}

const DUGME = 'min-w-16 h-16 px-4 text-2xl font-extrabold rounded-xl border-2 transition-colors'

export default function OdevKontrolu() {
  const [sezon, setSezon] = useState(null)
  const [sinavlar, setSinavlar] = useState([])
  const [ogrenciler, setOgrenciler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')

  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('')
  const [kaynakId, setKaynakId] = useState('')
  const [bugun] = useState(() => istanbulBugunu(new Date())) // İstanbul gününe göre; sayfa açıkken sabit
  const [tarih, setTarih] = useState(bugun)
  const [sinifModu, setSinifModu] = useState(true) // tahtada herkes görür: varsayılan AÇIK
  const [tamamlananGizle, setTamamlananGizle] = useState(false)
  const [siraKey, setSiraKey] = useState(0)

  const [veri, setVeri] = useState(null) // { kaynakId, puanlar, kontroller, duzeltmeler, adlar }
  const [secimler, setSecimler] = useState({}) // öğrenci id -> bu hafta toplam (sayı | undefined)
  const [ekstraSecimleri, setEkstraSecimleri] = useState({}) // öğrenci id -> true (bekleyen ekstra artı)
  const [duzeltmeOgrenci, setDuzeltmeOgrenci] = useState(null)
  const [kaydediyor, setKaydediyor] = useState(false)

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

  // --- Seçenek listeleri ---
  const aktifler = useMemo(() => ogrenciler.filter((o) => o.is_active !== false), [ogrenciler])
  const kademeler = useMemo(
    () => KADEMELER.filter((k) => aktifler.some((o) => o.grade === k)),
    [aktifler]
  )
  const subeler = useMemo(
    () =>
      [...new Set(aktifler.filter((o) => o.grade === Number(kademe)).map((o) => o.class_name).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'tr')
      ),
    [aktifler, kademe]
  )
  const kaynakSinavlari = useMemo(
    () => sinavlar.filter((s) => s.grade === Number(kademe)).sort((a, b) => a.unit_no - b.unit_no),
    [sinavlar, kademe]
  )
  const sinav = sinavlar.find((s) => s.id === kaynakId) ?? null
  const liste = useMemo(
    () => (kademe && sube ? adaGoreSirala(aktifler.filter((o) => o.grade === Number(kademe) && o.class_name === sube)) : []),
    [aktifler, kademe, sube]
  )

  // --- Seçilen kaynak sınavın verisi ---
  useEffect(() => {
    setVeri(null)
    if (!kaynakId) return
    let iptal = false
    odevVeriYukle(kaynakId).then((d) => {
      if (iptal) return
      if (d.hata) setHata(d.hata)
      else setVeri(d)
    })
    return () => {
      iptal = true
    }
  }, [kaynakId])

  async function yenile() {
    const d = await odevVeriYukle(kaynakId)
    if (d.hata) setHata(d.hata)
    else setVeri(d)
  }

  const hazir = Boolean(veri && veri.kaynakId === kaynakId && sinav && sube && liste.length)

  // --- Her öğrencinin ödev durumu (kayıtlı verilerden) ---
  const satirVerisi = useMemo(() => {
    if (!hazir) return []
    const kontrolHaritasi = grupla(veri.kontroller)
    const duzeltmeHaritasi = grupla(veri.duzeltmeler)
    return liste.map((o) => {
      const bant = bantHesapla(veri.puanlar.get(o.id), sinav.question_count)
      const kontrolSatirlari = kontrolHaritasi.get(o.id) ?? []
      const duzeltmeSatirlari = duzeltmeHaritasi.get(o.id) ?? []
      const dd = odevDurumu({ bant, sinavTarihi: sinav.exam_date, kontrolSatirlari, duzeltmeSatirlari })
      const gecerli = gecerliKontroller(kontrolSatirlari)
      return {
        id: o.id,
        full_name: o.full_name,
        student_no: o.student_no,
        bant,
        kontrolSatirlari,
        duzeltmeSatirlari,
        dd,
        durum: dd.durum,
        kayitli: gecerli.find((k) => k.kontrol_tarihi === tarih)?.toplam_yazilan,
        onceki: oncekiToplam(gecerli, tarih),
      }
    })
  }, [hazir, veri, liste, sinav, tarih])

  // Kayıtlı kontrolleri (seçilen tarih için) düğmelere yansıt; bekleyen ekstraları sıfırla
  useEffect(() => {
    const s = {}
    for (const r of satirVerisi) if (r.kayitli !== undefined) s[r.id] = r.kayitli
    setSecimler(s)
    setEkstraSecimleri({})
  }, [satirVerisi])

  // Sıra: kayıtlı duruma göre kurulur; işaretleme sırasında satırlar yer değiştirmez.
  // Yalnızca veri yenilenince, seçim değişince ve "Yeniden sırala"da değişir.
  const sira = useMemo(
    () =>
      odevSatirlariniSirala(satirVerisi.map((r) => ({ id: r.id, full_name: r.full_name, student_no: r.student_no, durum: r.durum }))).map(
        (s) => s.id
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [satirVerisi, siraKey]
  )
  const satirById = useMemo(() => new Map(satirVerisi.map((r) => [r.id, r])), [satirVerisi])
  const gorunen = useMemo(
    () => gorunenSatirlar(sira.map((id) => satirById.get(id)).filter(Boolean), tamamlananGizle),
    [sira, satirById, tamamlananGizle]
  )

  // --- Kaydedilecekler ---
  const kayit = useMemo(
    () => ({
      kontrol: kaydedilecekKontroller({
        ogrenciler: satirVerisi.map((r) => ({ student_id: r.id, bant: r.bant, kontrolSatirlari: r.kontrolSatirlari })),
        secimler,
        tarih,
        kaynakExamId: kaynakId,
      }),
      ekstra: kaydedilecekEkstralar({
        ogrenciler: satirVerisi.map((r) => ({ student_id: r.id, bant: r.bant, duzeltmeSatirlari: r.duzeltmeSatirlari })),
        ekstraSecimleri,
        tarih,
        kaynakExamId: kaynakId,
      }),
    }),
    [satirVerisi, secimler, ekstraSecimleri, tarih, kaynakId]
  )
  const degisenSayisi = satirVerisi.filter((r) => satirDegisti(secimler[r.id], r.kayitli, ekstraSecimleri[r.id])).length
  const kirli = degisenSayisi > 0
  const yazilacakSayisi = kayit.kontrol.yazilacak.length + kayit.ekstra.length
  const tarihKontrol = kontrolTarihiDogrula(tarih, bugun)
  const kaydetilebilir = kirli && yazilacakSayisi > 0 && kayit.kontrol.gecersiz === 0 && tarihKontrol.gecerli && !kaydediyor

  useKaydedilmemisUyari(kirli)

  // Bu şubenin kontrollerini en son kaydeden kişi
  const sonKaydeden = useMemo(() => {
    if (!hazir) return null
    const idler = new Set(liste.map((o) => o.id))
    const son = veri.kontroller.filter((k) => idler.has(k.student_id)).reduce((a, k) => (!a || k.created_at > a.created_at ? k : a), null)
    return son ? { ad: veri.adlar.get(son.entered_by) ?? null, zaman: son.created_at } : null
  }, [hazir, liste, veri])

  // --- Seçim değişirken kaydedilmemiş değişiklik varsa sor ---
  function degistir(uygula) {
    if (kirli && !window.confirm(CIKIS_UYARISI)) return
    setBilgi('')
    setHata('')
    uygula()
  }
  const kademeSec = (v) =>
    degistir(() => {
      setKademe(v)
      setSube('')
      const son = sinavlar.filter((s) => s.grade === Number(v)).sort((a, b) => b.unit_no - a.unit_no)[0]
      setKaynakId(son ? son.id : '') // varsayılan: en son ünite
    })
  const subeSec = (v) => degistir(() => setSube(v))
  const kaynakSec = (v) => degistir(() => setKaynakId(v))
  const tarihSec = (v) => degistir(() => setTarih(v))

  // --- Satır işlemleri ---
  const dugmeyeBasildi = (r, v) => setSecimler((s) => ({ ...s, [r.id]: secimDegistir(s[r.id], v, r.kayitli) }))
  const ekstraDegistir = (id) => setEkstraSecimleri((e) => ({ ...e, [id]: !e[id] }))

  function kaydetmedenIslemEngelli() {
    if (!kirli) return false
    setHata('Önce kaydet ya da değişiklikleri geri al (düğmelere yeniden basarak), sonra bu işlemi yap.')
    return true
  }

  // --- Kaydet ---
  async function kaydet() {
    if (!kaydetilebilir) return
    const t = kontrolTarihiDogrula(tarih, istanbulBugunu(new Date())) // gece yarısı geçmiş olabilir: yeniden denetle
    if (!t.gecerli) return setHata(t.hata)
    setKaydediyor(true)
    setHata('')
    setBilgi('')
    const kontrolSayisi = kayit.kontrol.yazilacak.length
    const ekstraSayisi = kayit.ekstra.length
    if (kontrolSayisi) {
      const { error } = await odevKontrolleriniYaz(kayit.kontrol.yazilacak)
      if (error) {
        setHata(hataMetni(error))
        return setKaydediyor(false)
      }
    }
    let ekstraHatasi = ''
    if (ekstraSayisi) {
      const { error } = await odevDuzeltmeleriniYaz(kayit.ekstra)
      if (error) {
        ekstraHatasi = `${kontrolSayisi ? 'Kontrol kayıtları kaydedildi, ama e' : 'E'}kstra artı kaydedilemedi: ${hataMetni(error, { tur: 'odev-ekstra' })}`
      }
    }
    await yenile()
    if (ekstraHatasi) setHata(ekstraHatasi)
    else setBilgi(`Kaydedildi: ${kontrolSayisi} kontrol${ekstraSayisi ? `, ${ekstraSayisi} ekstra artı` : ''}.`)
    setKaydediyor(false)
  }

  // --- "Bu tarihin kaydını iptal et" (silme yok: iptal satırı eklenir) ---
  async function kaydiIptalEt(r) {
    if (kaydetmedenIslemEngelli()) return
    if (!window.confirm(`${r.full_name} için ${tarihYaz(tarih)} tarihli kontrol kaydı iptal edilsin mi?\n(Kayıt silinmez; iptal kaydı eklenir.)`)) return
    const satir = iptalSatiri({ studentId: r.id, kaynakExamId: kaynakId, kontrolSatirlari: r.kontrolSatirlari, tarih })
    if (!satir) return
    setHata('')
    setBilgi('')
    const { error } = await odevKontrolleriniYaz([satir])
    if (error) return setHata(hataMetni(error))
    await yenile()
    setBilgi(`${r.full_name}: ${tarihYaz(tarih)} tarihli kayıt iptal edildi.`)
  }

  // --- Elle düzeltme ---
  function duzeltmeAc(r) {
    if (kaydetmedenIslemEngelli()) return
    setDuzeltmeOgrenci(r)
  }
  async function duzeltmeKaydet({ puan, neden, tarih: t }) {
    const satir = elleDuzeltmeSatiri({ studentId: duzeltmeOgrenci.id, kaynakExamId: kaynakId, puan, neden, tarih: t })
    const { error } = await odevDuzeltmeleriniYaz([satir])
    if (error) return hataMetni(error)
    await yenile()
    setBilgi(`${duzeltmeOgrenci.full_name}: ${puan > 0 ? `+${puan}` : puan} düzeltmesi kaydedildi.`)
    setDuzeltmeOgrenci(null)
    return ''
  }

  const odevUnite = sinav ? sinav.unit_no + 1 : null
  const yirmiBesDegil = sinav && sinav.question_count !== ODEV_SORU_SAYISI

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Ödev Kontrolü</h1>
            <p className="text-gray-400 mt-1">{sezon ? `Sezon ${sezon.name}` : 'Defter ödevini şube şube kontrol et'}</p>
          </div>
          <Link
            to="/"
            className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
          >
            ← Ana sayfa
          </Link>
        </header>

        {hata && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded text-lg">{hata}</div>}
        {bilgi && <div className="bg-green-900/40 border border-green-600 text-green-200 px-4 py-3 rounded text-lg">{bilgi}</div>}

        {yukleniyor ? (
          <p className="text-gray-400">Yükleniyor…</p>
        ) : !sezon ? (
          <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">Aktif sezon bulunamadı.</div>
        ) : (
          <>
            <section className={kart}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={etiketSinifi} htmlFor="o-kademe">
                    Kademe
                  </label>
                  <select id="o-kademe" className={girdiSinifi} value={kademe} onChange={(e) => kademeSec(e.target.value)}>
                    <option value="">Seç…</option>
                    {kademeler.map((k) => (
                      <option key={k} value={k}>
                        {k}. kademe
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="o-sube">
                    Şube
                  </label>
                  <select id="o-sube" className={girdiSinifi} value={sube} disabled={!kademe} onChange={(e) => subeSec(e.target.value)}>
                    <option value="">Seç…</option>
                    {subeler.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="o-unite">
                    Ödev ünitesi
                  </label>
                  <select id="o-unite" className={girdiSinifi} value={kaynakId} disabled={!kademe} onChange={(e) => kaynakSec(e.target.value)}>
                    <option value="">Seç…</option>
                    {kaynakSinavlari.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.unit_no + 1}. ünite ödevi ({s.unit_no}. ünite sonucuna göre){s.exam_date ? ` — ${tarihYaz(s.exam_date)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiketSinifi} htmlFor="o-tarih">
                    Kontrol tarihi
                  </label>
                  <input
                    id="o-tarih"
                    type="date"
                    max={bugun}
                    value={tarih}
                    onChange={(e) => tarihSec(e.target.value)}
                    className={girdiSinifi}
                  />
                  {!tarihKontrol.gecerli && <p className="text-xs text-red-300 mt-1">{tarihKontrol.hata}</p>}
                </div>
              </div>
              {kademe && kaynakSinavlari.length === 0 && (
                <p className="text-sm text-amber-300 mt-3">Bu kademe için sınav tanımlı değil.</p>
              )}
              <div className="flex flex-wrap items-center gap-6 mt-4 text-gray-200">
                <label className="flex items-center gap-2 cursor-pointer text-lg">
                  <input type="checkbox" checked={sinifModu} onChange={(e) => setSinifModu(e.target.checked)} className="w-6 h-6 accent-blue-500" />
                  <span>
                    <b>Sınıf modu</b> (tahtada: yalnızca ad ve yapıldı/yapılmadı)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-lg">
                  <input type="checkbox" checked={tamamlananGizle} onChange={(e) => setTamamlananGizle(e.target.checked)} className="w-6 h-6 accent-blue-500" />
                  Tamamlananları gizle
                </label>
                {hazir && (
                  <button type="button" onClick={() => setSiraKey((k) => k + 1)} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 font-bold">
                    Yeniden sırala
                  </button>
                )}
              </div>
            </section>

            {yirmiBesDegil && (
              <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-3 rounded">
                Bu sınav {sinav.question_count} soru; ödev bantları {ODEV_SORU_SAYISI} soruluk sınav içindir, bu yüzden hesap yapılamıyor (bant tanımsız).
              </div>
            )}
            {kademe && sube && sinav && !hazir && !hata && <p className="text-gray-400">Yükleniyor…</p>}

            {hazir && (
              <>
                <section className={kart}>
                  <h2 className="text-2xl font-semibold text-gray-100 mb-1">
                    {kademe}-{sube} · {odevUnite}. ünite ödevi
                  </h2>
                  <p className="text-gray-400 mb-4">
                    {liste.length} öğrenci · kontrol tarihi {tarihYaz(tarih)} · düğmede o güne kadar <b>toplam kaç kez yazdığını</b> seç.
                  </p>

                  <div className="space-y-2">
                    {gorunen.map((r) => {
                      const a = satirAlanlari(r.durum, sinifModu)
                      const secim = secimler[r.id]
                      const degisti = satirDegisti(secim, r.kayitli, ekstraSecimleri[r.id])
                      const onizleme = kontrolOnizleme({
                        bant: r.bant,
                        sinavTarihi: sinav.exam_date,
                        kontrolSatirlari: r.kontrolSatirlari,
                        duzeltmeSatirlari: r.duzeltmeSatirlari,
                        tarih,
                        secim,
                      })
                      const yapildi = yapildiMi(secim, r.bant.gereken)
                      const uyari = Number.isInteger(secim) ? toplamDogrula(secim, r.onceki).uyari : null
                      return (
                        <div
                          key={r.id}
                          className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-4 py-3 ${
                            degisti ? 'border-amber-500 bg-amber-900/20' : 'border-gray-700 bg-gray-800'
                          } ${r.durum === 'tamamlandi' ? 'opacity-60' : ''}`}
                        >
                          <div className="w-72 shrink-0">
                            <p className="text-2xl font-bold text-gray-100">{r.full_name}</p>
                            {!sinifModu && <p className="text-sm text-gray-400">No {r.student_no}</p>}
                          </div>

                          {!sinifModu && a.gereken && (
                            <div className="text-center w-20">
                              <p className="text-xs text-gray-400">Gereken</p>
                              <p className="text-2xl font-bold">{r.bant.gereken}</p>
                            </div>
                          )}
                          {!sinifModu && a.oncekiToplam && (
                            <div className="text-center w-24">
                              <p className="text-xs text-gray-400">Önceki toplam</p>
                              <p className="text-2xl font-bold">{r.onceki}</p>
                            </div>
                          )}

                          {a.dugmeler && (
                            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${r.full_name} bu hafta toplam`}>
                              {hizliDugmeler(r.bant.gereken).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => dugmeyeBasildi(r, v)}
                                  aria-pressed={secim === v}
                                  title={r.kayitli === v ? 'Kayıtlı değer' : undefined}
                                  className={`${DUGME} ${
                                    secim === v
                                      ? 'bg-blue-600 border-blue-400 text-white'
                                      : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                                  } ${r.kayitli === v && secim !== v ? 'ring-2 ring-green-500' : ''}`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}

                          {a.yapildiRozeti && (
                            <span
                              className={`text-xl font-bold px-3 py-1 rounded-lg ${
                                yapildi === true
                                  ? 'bg-green-900/50 text-green-300'
                                  : yapildi === false
                                    ? 'bg-amber-900/50 text-amber-300'
                                    : 'text-gray-500'
                              }`}
                            >
                              {yapildi === true ? 'Yapıldı' : yapildi === false ? 'Yapılmadı' : '—'}
                            </span>
                          )}

                          {a.etiket && <span className="text-xl text-gray-300">{a.etiket}</span>}

                          {a.ekstra && (
                            r.dd.ekstraYapildi ? (
                              <span className="text-lg font-bold text-green-300">Ekstra ✓</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => ekstraDegistir(r.id)}
                                aria-pressed={Boolean(ekstraSecimleri[r.id])}
                                className={`${DUGME} ${
                                  ekstraSecimleri[r.id]
                                    ? 'bg-green-700 border-green-400 text-white'
                                    : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                                }`}
                              >
                                Ekstra +1
                              </button>
                            )
                          )}

                          {!sinifModu && a.hesap && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              {onizleme.etiket && (
                                <span
                                  className={`text-xl font-bold ${
                                    onizleme.etki > 0 ? 'text-green-400' : onizleme.etki < 0 ? 'text-red-400' : 'text-gray-300'
                                  }`}
                                  title="Bu kontrolün sonucu (kaydedilince geçerli olur)"
                                >
                                  {onizleme.etiket}
                                </span>
                              )}
                              <span className="text-sm text-gray-400">
                                Bu ödev: <b className="text-green-400">+{r.dd.arti}</b> / <b className="text-red-400">-{r.dd.eksi}</b>
                              </span>
                              {a.bantDegistiRozeti && r.dd.bantDegisti && (
                                <span className="text-sm text-amber-300 font-bold" title="Sınav puanı değişti ya da ödev bandı değişti; eski kayıtlar olduğu gibi duruyor">
                                  ⚠ Bant değişti: geçmişi gözden geçir
                                </span>
                              )}
                              {uyari && <span className="text-sm text-amber-300">{uyari}</span>}
                            </div>
                          )}

                          {!sinifModu && (
                            <div className="ml-auto flex items-center gap-4 text-sm">
                              {r.kayitli !== undefined && (
                                <button type="button" onClick={() => kaydiIptalEt(r)} className="text-red-300 hover:text-red-200 underline">
                                  Bu tarihin kaydını iptal et
                                </button>
                              )}
                              <button type="button" onClick={() => duzeltmeAc(r)} className="text-blue-300 hover:text-blue-200 underline">
                                Düzelt…
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {gorunen.length === 0 && <p className="text-gray-500 py-4">Gösterilecek öğrenci yok (tamamlananlar gizli).</p>}
                  </div>
                </section>

                <div className="sticky bottom-0 z-10 bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-gray-500">
                    {sonKaydeden
                      ? `Son kaydeden: ${sonKaydeden.ad ?? 'bilinmiyor'} · ${zamanYaz(sonKaydeden.zaman)}`
                      : 'Bu şube için henüz kontrol kaydı yok.'}
                  </p>
                  <div className="flex items-center gap-3">
                    {kirli && <span className="text-amber-300 font-bold">{degisenSayisi} satırda kaydedilmemiş değişiklik</span>}
                    <button type="button" onClick={kaydet} disabled={!kaydetilebilir} className={`${anaDugme} text-lg px-8 py-3`}>
                      {kaydediyor ? 'Kaydediliyor…' : `Kaydet (${yazilacakSayisi})`}
                    </button>
                  </div>
                </div>
                {kayit.kontrol.gecersiz > 0 && (
                  <p className="text-sm text-red-300 -mt-3">{kayit.kontrol.gecersiz} satırda geçersiz değer var; düzeltmeden kaydedilemez.</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {duzeltmeOgrenci && (
        <ElleDuzeltmeKutusu
          ogrenciAdi={duzeltmeOgrenci.full_name}
          bugun={bugun}
          onKaydet={duzeltmeKaydet}
          onKapat={() => setDuzeltmeOgrenci(null)}
        />
      )}
    </div>
  )
}
