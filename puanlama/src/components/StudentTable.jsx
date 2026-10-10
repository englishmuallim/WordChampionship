import { silmeDurumu } from '../lib/ogrenciYonetimi'
import { ikincilDugme, tehlikeDugme } from '../lib/stil'

// Öğrenci listesi. Silme düğmesi yalnızca hiç puan kaydı olmayan öğrencide açıktır; kapalıysa nedeni yazar.
export default function StudentTable({ liste, puanSayilari, onDuzenle, onSil }) {
  return (
    <div className="overflow-x-auto max-h-[32rem] overflow-y-auto border border-gray-700 rounded-lg">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-gray-800">
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="py-2 px-3">Öğrenci No</th>
            <th className="py-2 px-3">Ad Soyad</th>
            <th className="py-2 px-3">Kademe</th>
            <th className="py-2 px-3">Şube</th>
            <th className="py-2 px-3">Durum</th>
            <th className="py-2 px-3"></th>
          </tr>
        </thead>
        <tbody>
          {liste.map((o) => {
            const silme = silmeDurumu(o.id, puanSayilari)
            return (
              <tr key={o.id} className="border-b border-gray-700/60">
                <td className="py-2 px-3">{o.student_no}</td>
                <td className="py-2 px-3 font-semibold">{o.full_name}</td>
                <td className="py-2 px-3">{o.grade}</td>
                <td className="py-2 px-3">{o.class_name ?? '—'}</td>
                <td className="py-2 px-3">
                  {o.is_active === false ? (
                    <span className="text-amber-300">Pasif</span>
                  ) : (
                    <span className="text-green-400">Aktif</span>
                  )}
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <button onClick={() => onDuzenle(o)} className={`${ikincilDugme} !py-1.5 !px-3 mr-2`}>
                    Düzenle
                  </button>
                  <button
                    onClick={() => onSil(o)}
                    disabled={!silme.izin}
                    title={silme.izin ? 'Öğrenciyi sil (geri alınamaz)' : silme.neden}
                    className={tehlikeDugme}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
