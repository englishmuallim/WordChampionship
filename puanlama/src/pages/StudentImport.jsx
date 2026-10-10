import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hataMetni } from '../lib/hatalar'
import { dosyadanSatirlar } from '../lib/dosyaOku'
import { hataOzeti, planOlustur, satirlariAyir, yazilacakSatirlar } from '../lib/ogrenciIceAktar'
import { ogrencileriYaz, puanSayilariGetir, tumOgrencileriGetir } from '../lib/ogrenciler'
import ImportPreview from '../components/ImportPreview'
import { anaDugme, ikincilDugme, kart } from '../lib/stil'

export default function StudentImport() {
  const { staff } = useAuth()
  const [asama, setAsama] = useState('sec') // sec | onizleme | yaziliyor | bitti
  const [plan, setPlan] = useState(null)
  const [dosyaAdi, setDosyaAdi] = useState('')
  const [hata, setHata] = useState('')
  const [okuyor, setOkuyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)

  async function dosyaSecildi(e) {
    const dosya = e.target.files?.[0]
    e.target.value = '' // dosya seçicide hiçbir şey tutulmasın
    if (!dosya) return
    setHata('')
    setOkuyor(true)
    try {
      const oku = await dosyadanSatirlar(dosya)
      if (oku.hata) return setHata(oku.hata)
      const ayir = satirlariAyir(oku.satirlar)
      if (ayir.hata) return setHata(ayir.hata)
      const [{ data: mevcut, error }, puan] = await Promise.all([tumOgrencileriGetir(), puanSayilariGetir()])
      if (error) return setHata(hataMetni(error))
      if (puan.error) {
        // Puan sayıları olmadan "puanlı öğrencinin kademesi değişiyor mu" bilinemez; güvenli tarafta durulur.
        hataMetni(puan.error)
        return setHata('Puan kaydı sayıları alınamadığı için önizleme hazırlanamadı. Sayfayı yenileyip tekrar dene.')
      }
      setPlan(planOlustur(ayir.ham, mevcut, puan.harita))
      setDosyaAdi(dosya.name)
      setAsama('onizleme')
    } finally {
      setOkuyor(false)
    }
  }

  function vazgec() {
    setPlan(null)
    setDosyaAdi('')
    setHata('')
    setAsama('sec')
  }

  async function kaydet() {
    setAsama('yaziliyor')
    setHata('')
    const { error } = await ogrencileriYaz(yazilacakSatirlar(plan, staff.school_id))
    if (error) {
      setHata(hataMetni(error))
      return setAsama('onizleme')
    }
    setSonuc(plan.sayilar)
    setPlan(null)
    setAsama('bitti')
  }

  const s = plan?.sayilar
  const yazilacak = s ? s.yeni + s.guncellenecek : 0
  const ozet = plan ? hataOzeti(plan) : []

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Öğrenci İçe Aktarma</h1>
            <p className="text-gray-400 mt-1">Excel (.xlsx) veya CSV dosyasından toplu öğrenci ekleme/güncelleme</p>
          </div>
          <Link
            to="/ogrenciler"
            className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
          >
            ← Öğrenci listesi
          </Link>
        </header>

        {hata && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{hata}</div>
        )}

        {asama === 'sec' && (
          <section className={kart}>
            <h2 className="text-xl font-semibold text-gray-200 mb-3">1. Dosyayı seç</h2>
            <p className="text-sm text-gray-400 mb-4">
              Dosyada şu sütunlar bulunmalı: <b>Öğrenci No, Ad Soyad, Kademe, Şube</b>. Başka sütunlar (Şifre, Telefon,
              Email gibi) yok sayılır, okunmaz ve kaydedilmez. Dosya yalnızca bu tarayıcıda okunur; hiçbir yere
              gönderilmez ve saklanmaz. Hiçbir şey, sen onaylamadan kaydedilmez.
            </p>
            <input
              type="file"
              accept=".xlsx,.csv"
              disabled={okuyor}
              onChange={dosyaSecildi}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-500"
            />
            {okuyor && <p className="text-sm text-gray-400 mt-3">Dosya okunuyor…</p>}
          </section>
        )}

        {(asama === 'onizleme' || asama === 'yaziliyor') && plan && (
          <>
            <section className={kart}>
              <h2 className="text-xl font-semibold text-gray-200 mb-1">2. Önizleme</h2>
              <p className="text-sm text-gray-400 mb-4">
                Dosya: <b className="text-gray-200">{dosyaAdi}</b> — henüz hiçbir şey kaydedilmedi.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Sayac ad="Yeni" deger={s.yeni} sinif="text-green-400" />
                <Sayac ad="Güncellenecek" deger={s.guncellenecek} sinif="text-amber-400" />
                <Sayac ad="Değişiklik yok" deger={s.ayni} sinif="text-gray-300" />
                <Sayac ad="Hatalı" deger={s.hatali} sinif="text-red-400" />
              </div>

              {(s.kademeDegisen > 0 || s.pasif > 0) && (
                <div className="bg-amber-900/30 border border-amber-600 text-amber-200 px-4 py-2 rounded text-sm mb-4 space-y-1">
                  {s.kademeDegisen > 0 && (
                    <p>
                      <b>{s.kademeDegisen}</b> öğrencinin kademesi değişecek. Bunlar sıralamada başka kademeye geçer;
                      listeyi dikkatle kontrol et.
                    </p>
                  )}
                  {s.pasif > 0 && (
                    <p>
                      <b>{s.pasif}</b> pasif (ayrılmış) öğrenci dosyada geçiyor: bilgileri güncellenir ama aktif
                      yapılmaz.
                    </p>
                  )}
                </div>
              )}

              <ImportPreview plan={plan} />
            </section>

            <section className={kart}>
              <h2 className="text-xl font-semibold text-gray-200 mb-3">3. Onay</h2>
              <ul className="text-sm text-gray-300 space-y-1 mb-4 list-disc pl-5">
                <li>
                  Kaydedilecek: <b className="text-green-400">{s.yeni} yeni</b> ve{' '}
                  <b className="text-amber-400">{s.guncellenecek} güncellenecek</b> öğrenci.
                </li>
                {s.ayni > 0 && <li>{s.ayni} satırda değişiklik yok, bu satırlara dokunulmaz.</li>}
                {s.hatali > 0 && (
                  <li className="text-red-300">
                    <b>{s.hatali} hatalı satır atlanacak</b> (kaydedilmeyecek). Nedenler:{' '}
                    {ozet.map((o) => `${o.etiket} (${o.adet})`).join('; ')}. Ayrıntı için "Hatalı" sekmesine bak.
                  </li>
                )}
                <li>
                  Dosyada olmayan ya da işlenmeyen <b>{s.dokunulmayan}</b> mevcut öğrenciye dokunulmaz.
                </li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <button onClick={kaydet} disabled={asama === 'yaziliyor' || yazilacak === 0} className={anaDugme}>
                  {asama === 'yaziliyor'
                    ? 'Kaydediliyor…'
                    : s.hatali > 0
                      ? `Geçerli satırları kaydet (${yazilacak}), hatalı ${s.hatali} satırı atla`
                      : `Onayla ve kaydet (${yazilacak})`}
                </button>
                <button onClick={vazgec} disabled={asama === 'yaziliyor'} className={ikincilDugme}>
                  Vazgeç
                </button>
              </div>
              {yazilacak === 0 && (
                <p className="text-sm text-gray-500 mt-3">Kaydedilecek yeni ya da değişen öğrenci yok.</p>
              )}
            </section>
          </>
        )}

        {asama === 'bitti' && sonuc && (
          <section className={kart}>
            <h2 className="text-xl font-semibold text-green-400 mb-3">Kayıt tamamlandı</h2>
            <ul className="text-gray-300 space-y-1 mb-5 list-disc pl-5">
              <li>
                <b>{sonuc.yeni}</b> yeni öğrenci eklendi.
              </li>
              <li>
                <b>{sonuc.guncellenecek}</b> öğrenci güncellendi.
              </li>
              <li>
                <b>{sonuc.ayni}</b> satırda değişiklik yoktu.
              </li>
              <li>
                <b>{sonuc.hatali}</b> hatalı satır atlandı.
              </li>
            </ul>
            <div className="flex gap-3">
              <Link to="/ogrenciler" className={anaDugme}>
                Öğrenci listesine git
              </Link>
              <button onClick={vazgec} className={ikincilDugme}>
                Başka dosya yükle
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Sayac({ ad, deger, sinif }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
      <p className={`text-3xl font-black ${sinif}`}>{deger}</p>
      <p className="text-xs text-gray-400 mt-1">{ad}</p>
    </div>
  )
}
