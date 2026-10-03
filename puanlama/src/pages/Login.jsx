import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { staff, session, loading, authError, signIn } = useAuth()
  const [kullanici, setKullanici] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  if (!loading && session && staff) return <Navigate to="/" replace />

  async function gonder(e) {
    e.preventDefault()
    setGonderiliyor(true)
    setHata('')
    const sonuc = await signIn(kullanici, sifre)
    if (sonuc) setHata(sonuc)
    setGonderiliyor(false)
  }

  const gosterilenHata = hata || authError

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 p-10 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-400 tracking-tight mb-2">Word Championship</h1>
          <p className="text-gray-400">Puanlama Modülü</p>
        </div>

        <form onSubmit={gonder} className="space-y-6">
          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="kullanici">
              Kullanıcı adı veya e-posta
            </label>
            <input
              id="kullanici"
              type="text"
              autoComplete="username"
              required
              value={kullanici}
              onChange={(e) => setKullanici(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="sifre">
              Şifre
            </label>
            <input
              id="sifre"
              type="password"
              autoComplete="current-password"
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {gosterilenHata && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm text-center">
              {gosterilenHata}
            </div>
          )}

          <button
            type="submit"
            disabled={gonderiliyor}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-colors"
          >
            {gonderiliyor ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
