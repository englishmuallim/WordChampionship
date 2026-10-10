import { useEffect, useRef } from 'react'
import { tarihYaz } from '../lib/format'
import { nedenGosterimi } from '../lib/ogrenciToplu'
import { silmeDurumu } from '../lib/ogrenciYonetimi'
import { ikincilDugme, tehlikeDugme } from '../lib/stil'

// Öğrenci listesi: çoklu seçim kutuları, durum (aktif / ayrıldı + tarih ve neden) ve satır işlemleri.
// Silme düğmesi yalnızca hiç puan kaydı olmayan öğrencide açıktır; kapalıysa nedeni yazar.
export default function StudentTable({
  liste,
  puanSayilari,
  secili,
  onSecimDegistir,
  onHepsiniSec,
  onDuzenle,
  onArsivle,
  onGeriAl,
  onSil,
}) {
  const baslikKutusu = useRef(null)
  const seciliSayisi = liste.filter((o) => secili.has(o.id)).length
  const hepsiSecili = liste.length > 0 && seciliSayisi === liste.length
  useEffect(() => {
    if (baslikKutusu.current) baslikKutusu.current.indeterminate = seciliSayisi > 0 && !hepsiSecili
  }, [seciliSayisi, hepsiSecili])

  return (
    <div className="overflow-x-auto max-h-[32rem] overflow-y-auto border border-gray-700 rounded-lg">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-gray-800 z-[1]">
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="py-2 px-3 w-10">
              <input
                ref={baslikKutusu}
                type="checkbox"
                checked={hepsiSecili}
                onChange={(e) => onHepsiniSec(e.target.checked)}
                aria-label="Görünen öğrencilerin hepsini seç"
                title="Görünen öğrencilerin hepsini seç"
                className="w-4 h-4 accent-blue-500"
              />
            </th>
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
            const ayrildi = o.is_active === false
            const neden = nedenGosterimi(o.left_reason)
            return (
              <tr
                key={o.id}
                className={`border-b border-gray-700/60 ${secili.has(o.id) ? 'bg-blue-900/20' : ''} ${ayrildi ? 'text-gray-400' : ''}`}
              >
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={secili.has(o.id)}
                    onChange={() => onSecimDegistir(o.id)}
                    aria-label={`${o.full_name} seç`}
                    className="w-4 h-4 accent-blue-500"
                  />
                </td>
                <td className="py-2 px-3">{o.student_no}</td>
                <td className="py-2 px-3 font-semibold">{o.full_name}</td>
                <td className="py-2 px-3">{o.grade}</td>
                <td className="py-2 px-3">{o.class_name ?? '—'}</td>
                <td className="py-2 px-3">
                  {ayrildi ? (
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded border border-amber-700 bg-amber-900/40 text-amber-300 text-xs font-bold">
                        Ayrıldı
                      </span>
                      {(o.left_at || neden) && (
                        <p
                          className="text-xs text-gray-400 mt-1 max-w-[16rem] truncate"
                          title={[o.left_at ? tarihYaz(o.left_at) : '', neden].filter(Boolean).join(' · ')}
                        >
                          {[o.left_at ? tarihYaz(o.left_at) : '', neden].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-green-400">Aktif</span>
                  )}
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <button onClick={() => onDuzenle(o)} className={`${ikincilDugme} !py-1.5 !px-3 mr-2`}>
                    Düzenle
                  </button>
                  {ayrildi ? (
                    <button onClick={() => onGeriAl(o)} className={`${ikincilDugme} !py-1.5 !px-3 mr-2`}>
                      Geri al
                    </button>
                  ) : (
                    <button onClick={() => onArsivle(o)} className={`${ikincilDugme} !py-1.5 !px-3 mr-2`}>
                      Ayrıldı yap
                    </button>
                  )}
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
