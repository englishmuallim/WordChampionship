import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { sadelestir } from '../lib/metin'
import { useOgrenciYonetimi } from '../lib/useOgrenciYonetimi'
import {
  bugunTarihi,
  gorunenlerleKesistir,
  hepsiniSec,
  secimiDegistir,
  seciliOgrenciler,
  topluOnizleme,
} from '../lib/ogrenciToplu'
import StudentBulkBar from '../components/StudentBulkBar'
import StudentBulkDialog from '../components/StudentBulkDialog'
import StudentFormModal from '../components/StudentFormModal'
import StudentTable from '../components/StudentTable'
import StudentToolbar from '../components/StudentToolbar'
import { anaDugme, kart } from '../lib/stil'

export default function Students() {
  const { staff } = useAuth()
  const { ogrenciler, puanSayilari, yukleniyor, hata, bilgi, setHata, setBilgi, kaydet, sil, topluUygula } =
    useOgrenciYonetimi(staff.school_id)

  const [kademe, setKademe] = useState('')
  const [sube, setSube] = useState('')
  const [arama, setArama] = useState('')
  const [ayrilanlar, setAyrilanlar] = useState(false) // varsayılan: ayrılanlar gizli
  const [secili, setSecili] = useState(() => new Set())
  const [form, setForm] = useState(null) // null | { ogrenci: null } (ekle) | { ogrenci } (düzenle)
  const [toplu, setToplu] = useState(null) // null | { islem, secilenler }

  // Şube seçenekleri seçili kademeye göre (kademe seçilmediyse hepsi)
  const subeler = useMemo(() => {
    const kume = ogrenciler.filter((o) => !kademe || o.grade === Number(kademe))
    return [...new Set(kume.map((o) => o.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [ogrenciler, kademe])

  const gosterilen = useMemo(() => {
    const aranan = sadelestir(arama).trim()
    return ogrenciler
      .filter((o) => ayrilanlar || o.is_active !== false)
      .filter((o) => !kademe || o.grade === Number(kademe))
      .filter((o) => !sube || o.class_name === sube)
      .filter((o) => !aranan || sadelestir(o.full_name).includes(aranan) || sadelestir(o.student_no).includes(aranan))
      .sort(
        (a, b) =>
          a.grade - b.grade ||
          (a.class_name ?? '').localeCompare(b.class_name ?? '', 'tr') ||
          a.full_name.localeCompare(b.full_name, 'tr')
      )
  }, [ogrenciler, kademe, sube, arama, ayrilanlar])

  // Süzgeç ya da liste değişince GÖRÜNMEYEN satırlar seçimden düşer (gizli satırlara işlem yapılamasın)
  useEffect(() => {
    setSecili((onceki) => gorunenlerleKesistir(onceki, gosterilen))
  }, [gosterilen])

  const ayrilanSayisi = ogrenciler.filter((o) => o.is_active === false).length
  const seciliListe = useMemo(() => seciliOgrenciler(secili, gosterilen), [secili, gosterilen])

  function kademeDegisti(deger) {
    setKademe(deger)
    setSube('') // önceki kademenin şubesi yeni kademede olmayabilir
  }

  async function formKaydet(deger, degisenler) {
    const sonuc = await kaydet(form.ogrenci, deger, degisenler)
    if (!sonuc) setForm(null)
    return sonuc
  }

  // Arşivden geri alma: parametre gerekmediği için pencere yerine doğrudan önizleme + onay penceresi
  async function geriAl(ogrenciler_) {
    setBilgi('')
    const onizleme = topluOnizleme('geri_al', ogrenciler_, {}, { puanSayilari, bugun: bugunTarihi() })
    if (!onizleme.uygulanabilir) return setHata(onizleme.hatalar.join(' '))
    if (!window.confirm(onizleme.onay)) return
    const sonuc = await topluUygula('geri_al', {}, onizleme.istek)
    if (sonuc.hata) return setHata(sonuc.hata)
    setSecili(new Set())
  }

  function topluIslem(islem) {
    setBilgi('')
    if (islem === 'geri_al') return geriAl(seciliListe)
    setToplu({ islem, secilenler: seciliListe })
  }

  async function topluPenceredenUygula(islem, ayar, istek) {
    const sonuc = await topluUygula(islem, ayar, istek)
    if (!sonuc.hata) {
      setToplu(null)
      setSecili(new Set())
    }
    return sonuc
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
            ayrilanlar={ayrilanlar}
            subeler={subeler}
            onKademe={kademeDegisti}
            onSube={setSube}
            onArama={setArama}
            onAyrilanlar={setAyrilanlar}
          />

          <p className="text-sm text-gray-400 mb-3">
            Toplam <b className="text-gray-200">{ogrenciler.length}</b> öğrenci (aktif{' '}
            <b className="text-gray-200">{ogrenciler.length - ayrilanSayisi}</b>, ayrılan{' '}
            <b className="text-gray-200">{ayrilanSayisi}</b>) · Gösterilen{' '}
            <b className="text-blue-400">{gosterilen.length}</b>
          </p>

          {seciliListe.length > 0 && (
            <StudentBulkBar
              seciliSayisi={seciliListe.length}
              gorunenSayisi={gosterilen.length}
              onIslem={topluIslem}
              onTemizle={() => setSecili(new Set())}
            />
          )}

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
              secili={secili}
              onSecimDegistir={(id) => setSecili((s) => secimiDegistir(s, id))}
              onHepsiniSec={(sec) => setSecili(sec ? hepsiniSec(gosterilen) : new Set())}
              onDuzenle={(o) => {
                setBilgi('')
                setForm({ ogrenci: o })
              }}
              onArsivle={(o) => {
                setBilgi('')
                setToplu({ islem: 'arsivle', secilenler: [o] })
              }}
              onGeriAl={(o) => geriAl([o])}
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
          onKaydet={formKaydet}
          onKapat={() => setForm(null)}
        />
      )}
      {toplu && (
        <StudentBulkDialog
          islem={toplu.islem}
          secilenler={toplu.secilenler}
          tumOgrenciler={ogrenciler}
          puanSayilari={puanSayilari}
          onUygula={topluPenceredenUygula}
          onKapat={() => setToplu(null)}
        />
      )}
    </div>
  )
}
