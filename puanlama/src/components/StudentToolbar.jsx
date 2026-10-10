import { KADEMELER } from './ExamForm'
import { etiketSinifi, girdiSinifi } from '../lib/stil'

// Kademe / şube süzgeçleri ve arama kutusu.
export default function StudentToolbar({ kademe, sube, arama, subeler, onKademe, onSube, onArama }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
    </div>
  )
}
