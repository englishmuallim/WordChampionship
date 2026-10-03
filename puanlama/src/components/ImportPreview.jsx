import { useState } from 'react'

const DURUM = {
  yeni: { etiket: 'Yeni', sinif: 'bg-green-900/50 text-green-300 border-green-700' },
  guncellenecek: { etiket: 'Güncellenecek', sinif: 'bg-amber-900/50 text-amber-300 border-amber-700' },
  ayni: { etiket: 'Değişiklik yok', sinif: 'bg-gray-700 text-gray-300 border-gray-600' },
  hatali: { etiket: 'Hatalı', sinif: 'bg-red-900/50 text-red-300 border-red-700' },
}

function Rozet({ durum }) {
  const d = DURUM[durum]
  return <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${d.sinif}`}>{d.etiket}</span>
}

const goster = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))

export default function ImportPreview({ plan }) {
  const { sayilar } = plan
  const varsayilan = sayilar.hatali ? 'hatali' : sayilar.yeni ? 'yeni' : sayilar.guncellenecek ? 'guncellenecek' : 'tumu'
  const [sekme, setSekme] = useState(varsayilan)

  const sekmeler = [
    ['hatali', `Hatalı (${sayilar.hatali})`],
    ['yeni', `Yeni (${sayilar.yeni})`],
    ['guncellenecek', `Güncellenecek (${sayilar.guncellenecek})`],
    ['ayni', `Değişiklik yok (${sayilar.ayni})`],
    ['tumu', `Tümü (${plan.satirlar.length})`],
  ]
  const liste = plan.satirlar.filter((s) => sekme === 'tumu' || s.durum === sekme)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {sekmeler.map(([anahtar, ad]) => (
          <button
            key={anahtar}
            onClick={() => setSekme(anahtar)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
              sekme === anahtar
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {ad}
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Bu başlıkta satır yok.</p>
      ) : (
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border border-gray-700 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3">Satır</th>
                <th className="py-2 px-3">Öğrenci No</th>
                <th className="py-2 px-3">Ad Soyad</th>
                <th className="py-2 px-3">Kademe</th>
                <th className="py-2 px-3">Şube</th>
                <th className="py-2 px-3">Durum</th>
                <th className="py-2 px-3">Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((s) => {
                const v = s.deger
                return (
                  <tr key={s.satir} className="border-b border-gray-700/60 align-top">
                    <td className="py-2 px-3 text-gray-500">{s.satir}</td>
                    <td className="py-2 px-3">{goster(v ? v.student_no : s.ham.no)}</td>
                    <td className="py-2 px-3">{goster(v ? v.full_name : s.ham.ad)}</td>
                    <td className="py-2 px-3">{goster(v ? v.grade : s.ham.kademe)}</td>
                    <td className="py-2 px-3">{goster(v ? v.class_name : s.ham.sube)}</td>
                    <td className="py-2 px-3">
                      <Rozet durum={s.durum} />
                    </td>
                    <td className="py-2 px-3 space-y-1">
                      {s.hatalar.map((h, i) => (
                        <p key={i} className="text-red-300">
                          {h.mesaj}
                        </p>
                      ))}
                      {s.farklar.map((f) => (
                        <p key={f.alan} className={f.alan === 'grade' ? 'text-amber-300 font-bold' : 'text-gray-300'}>
                          {f.etiket}: <span className="line-through text-gray-500">{goster(f.eski)}</span> →{' '}
                          {goster(f.yeni)}
                        </p>
                      ))}
                      {s.pasif && (
                        <p className="text-amber-300 font-bold">
                          Pasif öğrenci: bilgileri güncellenir, ama aktif yapılmaz.
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
