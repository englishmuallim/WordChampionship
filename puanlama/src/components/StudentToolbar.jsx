import { KADEMELER } from './ExamForm'
import { etiketSinifi, girdiSinifi } from '../lib/stil'

// Kademe / şube süzgeçleri, arama kutusu ve "ayrılanları göster" seçeneği (varsayılan kapalı).
export default function StudentToolbar({
  kademe,
  sube,
  arama,
  ayrilanlar,
  subeler,
  onKademe,
  onSube,
  onArama,
  onAyrilanlar,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4 items-end">
      <div>
        <label className={etiketSinifi} htmlFor="f-kademe">
          Kademe
        </label>
        <select id="f-kademe" className={girdiSinifi} value={kademe} onChange={(e) => onKademe(e.target.value)}>
          <option value="">Tümü</option>
          {KADEMELER.map((k) => (
            <option key={k} value={k}>
              {k}. kademe
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiketSinifi} htmlFor="f-sube">
          Şube
        </label>
        <select id="f-sube" className={girdiSinifi} value={sube} onChange={(e) => onSube(e.target.value)}>
          <option value="">Tümü</option>
          {subeler.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiketSinifi} htmlFor="f-arama">
          Ara (ad veya numara)
        </label>
        <input
          id="f-arama"
          className={girdiSinifi}
          value={arama}
          onChange={(e) => onArama(e.target.value)}
          placeholder="örn. cagri"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300 pb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ayrilanlar}
          onChange={(e) => onAyrilanlar(e.target.checked)}
          className="w-5 h-5 accent-blue-500"
        />
        Ayrılanları göster
      </label>
    </div>
  )
}
