import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hataMetni } from '../lib/hatalar'
import { sadelestir } from '../lib/metin'
import {
  ogrenciEkle,
  ogrenciGuncelle,
  ogrenciSil,
  puanSayilariGetir,
  tumOgrencileriGetir,
} from '../lib/ogrenciler'
import { silmeDurumu, silmeOnayMetni } from '../lib/ogrenciYonetimi'
import StudentFormModal from '../components/StudentFormModal'
import StudentTable from '../components/StudentTable'
import StudentToolbar from '../components/StudentToolbar'
import { anaDugme, kart } from '../lib/stil'

export default function Students() {
  const { staff } = useAuth()
  const [ogrenciler, setOgrenciler] = useState([])
  const [puanSayilari, setPuanSayilari] = useState(null) // Map ya da null (alınamadıysa)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')
  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('')
  const [arama, setArama] = useState('')
  const [form, setForm] = useState(null) // null | { ogrenci: null } (ekle) | { ogrenci } (düzenle)

  // Öğrencileri ve puan kaydı sayılarını birlikte yükler. Sayılar alınamazsa silme ve kademe
  // değişikliği güvenli tarafta kapalı kalır (null = bilinmiyor).
  const yukle = useCallback(async () => {
    const [o, p] = await Promise.all([tumOgrencileriGetir(), puanSayilariGetir()])
    if (o.error) {
      setHata(hataMetni(o.error))
      return false
    }
    setOgrenciler(o.data)
    if (p.error) {
      hataMetni(p.error) // konsola ayrıntıyı yazar
      setPuanSayilari(null)
      setHata('Puan kaydı sayıları alınamadı: silme ve kademe değişikliği şimdilik kapalı. Sayfayı yenileyip tekrar dene.')
    } else {
      setPuanSayilari(p.harita)
      setHata('')
    }
    return true
  }, [])

  useEffect(() => {
    let iptal = false
    yukle().finally(() => {
      if (!iptal) setYukleniyor(false)
    })
    return () => {
      iptal = true
    }
  }, [yukle])

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

  // Ekleme ve düzenleme penceresinden gelen kayıt isteği. Hata metni ya da boş metin (başarı) döner.
  async function kaydet(deger, degisenler) {
    setBilgi('')
    const duzenlenen = form.ogrenci
    const sonuc = duzenlenen
      ? await ogrenciGuncelle(duzenlenen.id, degisenler)
      : await ogrenciEkle(staff.school_id, deger)
    if (sonuc.error) return hataMetni(sonuc.error, { tur: 'ogrenci', no: deger.student_no })
    if (sonuc.mesaj) return sonuc.mesaj

    await yukle()
    setForm(null)
    setBilgi(duzenlenen ? `${deger.full_name} güncellendi.` : `${deger.full_name} (${deger.student_no}) eklendi.`)
    return ''
  }

  async function sil(ogrenci) {
    setBilgi('')
    const durum = silmeDurumu(ogrenci.id, puanSayilari)
    if (!durum.izin) return setHata(durum.neden)
    if (!window.confirm(silmeOnayMetni(ogrenci))) return

    const sonuc = await ogrenciSil(ogrenci.id)
    if (sonuc.error) return setHata(hataMetni(sonuc.error, { tur: 'ogrenci' }))
    if (sonuc.mesaj) return setHata(sonuc.mesaj)
    await yukle()
    setBilgi(`${ogrenci.full_name} (${ogrenci.student_no}) silindi.`)
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Öğrenciler</h1>
            <p className="text-gray-400 mt-1">Kayıtlı öğrenci listesi</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setForm({ ogrenci: null })} className={anaDugme}>
              Öğrenci Ekle
            </button>
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
        {bilgi && (
          <div className="bg-green-900/40 border border-green-600 text-green-200 px-4 py-3 rounded">{bilgi}</div>
        )}

        <section className={kart}>
          <StudentToolbar
            kademe={kademe}
            sube={sube}
            arama={arama}
            subeler={subeler}
            onKademe={kademeDegisti}
            onSube={setSube}
            onArama={setArama}
          />

          <p className="text-sm text-gray-400 mb-3">
            Toplam <b className="text-gray-200">{ogrenciler.length}</b> öğrenci
            {pasifSayisi > 0 && <> ({pasifSayisi} pasif)</>} · Gösterilen{' '}
            <b className="text-blue-400">{gosterilen.length}</b>
          </p>

          {yukleniyor ? (
            <p className="text-gray-400">Yükleniyor…</p>
          ) : gosterilen.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              {ogrenciler.length === 0
                ? 'Henüz öğrenci yok. "Öğrenci Ekle" ya da "İçe Aktar" ile ekleyebilirsin.'
                : 'Filtreye uyan öğrenci yok.'}
            </p>
          ) : (
            <StudentTable
              liste={gosterilen}
              puanSayilari={puanSayilari}
              onDuzenle={(o) => {
                setBilgi('')
                setForm({ ogrenci: o })
              }}
              onSil={sil}
            />
          )}
        </section>
      </div>

      {form && (
        <StudentFormModal
          ogrenci={form.ogrenci}
          mevcutlar={ogrenciler}
          puanSayilari={puanSayilari}
          onKaydet={kaydet}
          onKapat={() => setForm(null)}
        />
      )}
    </div>
  )
}
