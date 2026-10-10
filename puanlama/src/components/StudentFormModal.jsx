import { useMemo, useState } from 'react'
import {
  bosForm,
  degisenAlanlar,
  formdanOgrenci,
  hatalariAlanaGoreAyir,
  kademeKilidi,
  ogrenciFormunuDogrula,
} from '../lib/ogrenciYonetimi'
import { anaDugme, etiketSinifi, girdiSinifi, ikincilDugme } from '../lib/stil'
import { KADEMELER } from './ExamForm'

// Tek öğrenci ekleme / düzenleme penceresi.
//  ogrenci: düzenlenecek öğrenci (ekleme için null)
//  mevcutlar: tüm öğrenciler (numara tekrarını denetlemek için)
//  puanSayilari: Map ya da null (alınamadıysa)
//  onKaydet(deger, degisenler): hata metni döner (başarılıysa boş metin)
export default function StudentFormModal({ ogrenci, mevcutlar, puanSayilari, onKaydet, onKapat }) {
  const duzenle = Boolean(ogrenci)
  const [form, setForm] = useState(() => (ogrenci ? formdanOgrenci(ogrenci) : bosForm()))
  const [hatalar, setHatalar] = useState([])
  const [genel, setGenel] = useState('')
  const [kaydediyor, setKaydediyor] = useState(false)

  const kilit = useMemo(
    () => (duzenle ? kademeKilidi(ogrenci.id, puanSayilari) : { kilitli: false, neden: '' }),
    [duzenle, ogrenci, puanSayilari]
  )
  const alanHatalari = hatalariAlanaGoreAyir(hatalar)
  const guncelle = (alan, deger) => setForm((f) => ({ ...f, [alan]: deger }))
  const hataliSinif = (alan) => (alanHatalari[alan].length ? '!border-red-500' : '')

  async function gonder(e) {
    e.preventDefault()
    setGenel('')
    const sonuc = ogrenciFormunuDogrula(form, mevcutlar, {
      duzenlenenId: duzenle ? ogrenci.id : null,
      puanSayilari,
    })
    setHatalar(sonuc.hatalar)
    if (sonuc.hatalar.length) return

    const degisen = duzenle ? degisenAlanlar(ogrenci, sonuc.deger) : null
    if (duzenle && Object.keys(degisen).length === 0) return setGenel('Hiçbir alan değişmedi.')
    if (
      duzenle &&
      'student_no' in degisen &&
      !window.confirm(
        `Öğrenci numarası ${ogrenci.student_no} → ${sonuc.deger.student_no} olarak değişecek. ` +
          'İçe aktarma dosyaları öğrenciyi bu numaraya göre eşleştirir. Devam edilsin mi?'
      )
    ) {
      return
    }

    setKaydediyor(true)
    const hata = await onKaydet(sonuc.deger, degisen)
    setKaydediyor(false)
    if (hata) setGenel(hata)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-xl font-bold text-gray-100 mb-4">
          {duzenle ? `Öğrenciyi Düzenle (${ogrenci.student_no})` : 'Öğrenci Ekle'}
        </h3>
        <form onSubmit={gonder} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={etiketSinifi} htmlFor="o-no">
                Öğrenci no
              </label>
              <input
                id="o-no"
                className={`${girdiSinifi} ${hataliSinif('no')}`}
                value={form.student_no}
                onChange={(e) => guncelle('student_no', e.target.value)}
                autoFocus={!duzenle}
              />
              {alanHatalari.no.map((m) => (
                <p key={m} className="text-xs text-red-300 mt-1">
                  {m}
                </p>
              ))}
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="o-ad">
                Ad Soyad
              </label>
              <input
                id="o-ad"
                className={`${girdiSinifi} ${hataliSinif('ad')}`}
                value={form.full_name}
                onChange={(e) => guncelle('full_name', e.target.value)}
                autoFocus={duzenle}
              />
              {alanHatalari.ad.map((m) => (
                <p key={m} className="text-xs text-red-300 mt-1">
                  {m}
                </p>
              ))}
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="o-kademe">
                Kademe
              </label>
              <select
                id="o-kademe"
                className={`${girdiSinifi} ${hataliSinif('kademe')}`}
                value={form.grade}
                disabled={kilit.kilitli}
                onChange={(e) => guncelle('grade', e.target.value)}
              >
                {KADEMELER.map((k) => (
                  <option key={k} value={k}>
                    {k}. kademe
                  </option>
                ))}
              </select>
              {kilit.kilitli && <p className="text-xs text-amber-300 mt-1">{kilit.neden}</p>}
              {alanHatalari.kademe.map((m) => (
                <p key={m} className="text-xs text-red-300 mt-1">
                  {m}
                </p>
              ))}
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="o-sube">
                Şube
              </label>
              <input
                id="o-sube"
                className={`${girdiSinifi} ${hataliSinif('sube')}`}
                value={form.class_name}
                onChange={(e) => guncelle('class_name', e.target.value)}
                placeholder="A"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">Tek harf. "5-A" yazarsan harfe indirilir.</p>
              {alanHatalari.sube.map((m) => (
                <p key={m} className="text-xs text-red-300 mt-1">
                  {m}
                </p>
              ))}
            </div>
          </div>

          {(genel || alanHatalari.genel.length > 0) && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">
              {[genel, ...alanHatalari.genel].filter(Boolean).join(' ')}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={kaydediyor} className={anaDugme}>
              {kaydediyor ? 'Kaydediliyor…' : duzenle ? 'Kaydet' : 'Ekle'}
            </button>
            <button type="button" onClick={onKapat} className={ikincilDugme}>
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
