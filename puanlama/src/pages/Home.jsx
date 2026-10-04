import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ROL_ADI = { admin: 'Yönetici', teacher: 'Öğretmen' }

// Ana sayfa menüsü. Rolü uymayan kutular gösterilmez.
const MENU = [
  { ad: 'Puan Girişi', roller: ['admin', 'teacher'], yol: '/puan-girisi' },
  { ad: 'Sıralama', roller: ['admin', 'teacher'], yol: '/siralama' },
  { ad: 'Sezon ve Sınavlar', roller: ['admin'], yol: '/sezon-sinavlar' },
  { ad: 'Öğrenciler', roller: ['admin'], yol: '/ogrenciler' },
]

export default function Home() {
  const { staff, signOut } = useAuth()
  const gorunenMenu = MENU.filter((m) => m.roller.includes(staff.role))

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Word Championship</h1>
            <p className="text-gray-400 mt-1">Puanlama Modülü</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold">{staff.full_name}</p>
              <p className="text-sm text-gray-400">{ROL_ADI[staff.role] ?? staff.role}</p>
            </div>
            <button
              onClick={signOut}
              className="text-sm bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white px-4 py-2 rounded-lg border border-red-800 transition-colors font-bold"
            >
              Çıkış Yap
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gorunenMenu.map((m) =>
            m.yol ? (
              <Link
                key={m.ad}
                to={m.yol}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl p-6 transition-colors"
              >
                <h2 className="text-xl font-semibold text-gray-100">{m.ad}</h2>
                <p className="text-sm text-blue-400 mt-1">Aç →</p>
              </Link>
            ) : (
              <div
                key={m.ad}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 opacity-60 cursor-not-allowed"
              >
                <h2 className="text-xl font-semibold text-gray-200">{m.ad}</h2>
                <p className="text-sm text-gray-500 mt-1">Yakında</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
