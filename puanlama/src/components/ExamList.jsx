import { tarihYaz } from '../lib/format'
import { ikincilDugme, kart, tehlikeDugme } from '../lib/stil'
import { KADEMELER } from './ExamForm'

export default function ExamList({ sinavlar, onDuzenle, onSil }) {
  // 5-8 her zaman gösterilir; bunların dışında bir kademe varsa o da eklenir.
  const kademeler = [...new Set([...KADEMELER, ...sinavlar.map((s) => s.grade)])].sort((a, b) => a - b)

  return (
    <section className={kart}>
      <h2 className="text-xl font-semibold text-gray-200 mb-4">Sınav Listesi</h2>
      <div className="space-y-6">
        {kademeler.map((k) => {
          const liste = sinavlar.filter((s) => s.grade === k).sort((a, b) => a.unit_no - b.unit_no)
          return (
            <div key={k}>
              <h3 className="text-lg font-bold text-blue-400 mb-2">{k}. Kademe</h3>
              {liste.length === 0 ? (
                <p className="text-sm text-gray-500">Henüz sınav yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="py-2 pr-4">Ünite</th>
                        <th className="py-2 pr-4">Tarih</th>
                        <th className="py-2 pr-4">Soru</th>
                        <th className="py-2 pr-4">Soru başı puan</th>
                        <th className="py-2 pr-4">Toplam puan</th>
                        <th className="py-2 pr-4">Puan kaydı</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {liste.map((s) => (
                        <tr key={s.id} className="border-b border-gray-700/60">
                          <td className="py-2 pr-4 font-bold">{s.unit_no}. ünite</td>
                          <td className="py-2 pr-4">{tarihYaz(s.exam_date)}</td>
                          <td className="py-2 pr-4">{s.question_count}</td>
                          <td className="py-2 pr-4">{s.points_per_question}</td>
                          <td className="py-2 pr-4">{s.question_count * s.points_per_question}</td>
                          <td className="py-2 pr-4">{s.puanSayisi}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button onClick={() => onDuzenle(s)} className={`${ikincilDugme} !py-1.5 !px-3 mr-2`}>
                              Düzenle
                            </button>
                            <button
                              onClick={() => onSil(s)}
                              disabled={s.puanSayisi > 0}
                              title={s.puanSayisi > 0 ? 'Puan kaydı olan sınav silinemez.' : 'Sınavı sil'}
                              className={tehlikeDugme}
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
