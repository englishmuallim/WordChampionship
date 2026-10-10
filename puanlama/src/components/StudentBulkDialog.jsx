import { useMemo, useState } from 'react'
import { AYRILMA_NEDENLERI, DIGER, bugunTarihi, topluOnizleme } from '../lib/ogrenciToplu'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme } from '../lib/stil'
import { KADEMELER } from './ExamForm'

const BASLIK = {
  arsivle: 'Arşivle (ayrıldı olarak işaretle)',
  sube: 'Şube değiştir',
  kademe: 'Kademe değiştir',
}

const adlar = (liste, en = 5) =>
  liste.slice(0, en).map((o) => `${o.full_name} (${o.student_no})`).join(', ') +
  (liste.length > en ? ` ve ${liste.length - en} öğrenci daha` : '')

// Toplu (ya da tek öğrencilik) arşiv, şube ve kademe işlemlerinin parametre penceresi.
// Altta canlı önizleme gösterilir: kaç öğrenci işlenecek, kaçı atlanacak, kim engelleniyor.
// "Uygula"ya basınca window.confirm ile son onay alınır.
//  onUygula(islem, ayar, istek): { hata } ya da { sayi } döner (başarılıysa üst bileşen pencereyi kapatır).
export default function StudentBulkDialog({ islem, secilenler, tumOgrenciler, puanSayilari, onUygula, onKapat }) {
  const bugun = useMemo(() => bugunTarihi(), [])
  const [tarih, setTarih] = useState(bugun)
  const [nedenSecimi, setNedenSecimi] = useState('')
  const [nedenMetni, setNedenMetni] = useState('')
  const [sube, setSube] = useState('')
  const [kademe, setKademe] = useState('')
  const [dokunuldu, setDokunuldu] = useState(islem === 'arsivle') // arşivde alanlar baştan dolu: hatalar hemen görünür
  const [uygulaniyor, setUygulaniyor] = useState(false)
  const [sunucuHatasi, setSunucuHatasi] = useState('')

  const ayar = { tarih, nedenSecimi, nedenMetni, sube, kademe }
  const onizleme = useMemo(
    () => topluOnizleme(islem, secilenler, ayar, { puanSayilari, bugun, tumOgrenciler }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [islem, secilenler, tarih, nedenSecimi, nedenMetni, sube, kademe, puanSayilari, bugun, tumOgrenciler]
  )
  const degistir = (ayarla) => (e) => {
    setDokunuldu(true)
    setSunucuHatasi('')
    ayarla(e.target.value)
  }

  async function uygula() {
    if (!onizleme.uygulanabilir) return setDokunuldu(true)
    if (!window.confirm(onizleme.onay)) return
    setUygulaniyor(true)
    setSunucuHatasi('')
    const sonuc = await onUygula(islem, ayar, onizleme.istek)
    setUygulaniyor(false)
    if (sonuc.hata) setSunucuHatasi(sonuc.hata)
  }

  const tekil = secilenler.length === 1

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-100 mb-1">{BASLIK[islem]}</h3>
        <p className="text-sm text-gray-400 mb-4">
          {tekil ? adlar(secilenler) : `${secilenler.length} öğrenci seçili`}
        </p>

        <div className="space-y-4">
          {islem === 'arsivle' && (
            <>
              <div>
                <label className={etiketSinifi} htmlFor="b-tarih">
                  Ayrılma tarihi
                </label>
                <input
                  id="b-tarih"
                  type="date"
                  max={bugun}
                  className={girdiSinifi}
                  value={tarih}
                  onChange={degistir(setTarih)}
                />
              </div>
              <div>
                <label className={etiketSinifi} htmlFor="b-neden">
                  Ayrılma nedeni (isteğe bağlı)
                </label>
                <select id="b-neden" className={girdiSinifi} value={nedenSecimi} onChange={degistir(setNedenSecimi)}>
                  <option value="">Belirtme</option>
                  {AYRILMA_NEDENLERI.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value={DIGER}>{DIGER} (yaz)</option>
                </select>
                {nedenSecimi === DIGER && (
                  <input
                    className={`${girdiSinifi} mt-2`}
                    value={nedenMetni}
                    onChange={degistir(setNedenMetni)}
                    placeholder="Nedeni yaz (en fazla 200 karakter)"
                    maxLength={200}
                    autoFocus
                  />
                )}
              </div>
            </>
          )}

          {islem === 'sube' && (
            <div>
              <label className={etiketSinifi} htmlFor="b-sube">
                Yeni şube (tek harf, kademe değişmez)
              </label>
              <input
                id="b-sube"
                className={girdiSinifi}
                value={sube}
                onChange={degistir(setSube)}
                placeholder="A"
                maxLength={3}
                autoFocus
              />
            </div>
          )}

          {islem === 'kademe' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={etiketSinifi} htmlFor="b-kademe">
                  Yeni kademe
                </label>
                <select id="b-kademe" className={girdiSinifi} value={kademe} onChange={degistir(setKademe)}>
                  <option value="">Seç…</option>
                  {KADEMELER.map((k) => (
                    <option key={k} value={k}>
                      {k}. kademe
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiketSinifi} htmlFor="b-kube">
                  Yeni şube (isteğe bağlı)
                </label>
                <input
                  id="b-kube"
                  className={girdiSinifi}
                  value={sube}
                  onChange={degistir(setSube)}
                  placeholder="boşsa şubeler korunur"
                  maxLength={6}
                />
              </div>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm space-y-2">
            <p className="text-gray-300">
              İşlenecek: <b className="text-green-400">{onizleme.islenecek.length}</b> öğrenci
              {onizleme.atlanan.length > 0 && (
                <>
                  {' '}
                  · Atlanacak: <b className="text-amber-300">{onizleme.atlanan.length}</b>
                </>
              )}
            </p>
            {onizleme.atlanan.length > 0 && (
              <p className="text-xs text-amber-200">
                Atlananlar (işlem gerekmiyor): {adlar(onizleme.atlanan.map((x) => x.ogrenci))}
              </p>
            )}
            {onizleme.uyarilar.map((u) => (
              <p key={u} className="text-xs text-amber-300">
                ⚠ {u}
              </p>
            ))}
            {dokunuldu &&
              onizleme.hatalar.map((h) => (
                <p key={h} className="text-xs text-red-300">
                  {h}
                </p>
              ))}
          </div>

          {sunucuHatasi && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">
              {sunucuHatasi}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={uygula} disabled={uygulaniyor || (dokunuldu && !onizleme.uygulanabilir)} className={anaDugme}>
              {uygulaniyor ? 'Uygulanıyor…' : `Uygula (${onizleme.islenecek.length})`}
            </button>
            <button onClick={onKapat} disabled={uygulaniyor} className={ikincilDugme}>
              Vazgeç
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
