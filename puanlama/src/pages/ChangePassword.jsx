import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { sifreDegisiminiDenetle } from '../lib/sifre'
import { anaDugme, etiketSinifi, girdiSinifi, kart } from '../lib/stil'

// Supabase hata kodlarını anlaşılır Türkçeye çevirir
function guncellemeHatasi(error) {
  switch (error.code) {
    case 'same_password':
      return 'Yeni şifre mevcut şifreden farklı olmalı.'
    case 'weak_password':
      return 'Şifre çok zayıf. Daha uzun ya da farklı bir şifre dene.'
    case 'over_request_rate_limit':
      return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.'
    default:
      console.error('Şifre güncelleme hatası:', error.code, error.message)
      return 'Şifre değiştirilemedi. Çıkış yapıp yeniden giriş yaparak tekrar dene.'
  }
}

export default function ChangePassword() {
  const { session, staff } = useAuth()
  const [mevcut, setMevcut] = useState('')
  const [yeni, setYeni] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [hatalar, setHatalar] = useState([])
  const [basari, setBasari] = useState(false)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  async function gonder(e) {
    e.preventDefault()
    setBasari(false)
    const kuralHatalari = sifreDegisiminiDenetle({ mevcut, yeni, tekrar })
    if (kuralHatalari.length) return setHatalar(kuralHatalari)

    setGonderiliyor(true)
    setHatalar([])

    // Mevcut şifreyi doğrula (açık bırakılmış bir oturumdan şifre değiştirilmesin diye)
    const { error: girisHatasi } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: mevcut,
    })
    if (girisHatasi) {
      setGonderiliyor(false)
      return setHatalar([
        girisHatasi.status === 429
          ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.'
          : 'Mevcut şifre yanlış.',
      ])
    }

    const { error } = await supabase.auth.updateUser({ password: yeni })
    setGonderiliyor(false)
    if (error) return setHatalar([guncellemeHatasi(error)])

    setMevcut('')
    setYeni('')
    setTekrar('')
    setBasari(true)
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400 tracking-tight">Şifremi Değiştir</h1>
            <p className="text-gray-400 mt-1">{staff?.full_name}</p>
          </div>
          <Link
            to="/"
            className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg border border-gray-600 transition-colors font-bold"
          >
            ← Ana sayfa
          </Link>
        </header>

        <section className={kart}>
          <p className="text-sm text-gray-400 mb-4">
            Yeni şifre en az 6 karakter olmalı ve en az bir harf ile bir rakam içermeli.
          </p>
          <form onSubmit={gonder} className="space-y-4">
            <div>
              <label className={etiketSinifi} htmlFor="mevcut">
                Mevcut şifre
              </label>
              <input
                id="mevcut"
                type="password"
                autoComplete="current-password"
                className={girdiSinifi}
                value={mevcut}
                onChange={(e) => setMevcut(e.target.value)}
              />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="yeni">
                Yeni şifre
              </label>
              <input
                id="yeni"
                type="password"
                autoComplete="new-password"
                className={girdiSinifi}
                value={yeni}
                onChange={(e) => setYeni(e.target.value)}
              />
            </div>
            <div>
              <label className={etiketSinifi} htmlFor="tekrar">
                Yeni şifre (tekrar)
              </label>
              <input
                id="tekrar"
                type="password"
                autoComplete="new-password"
                className={girdiSinifi}
                value={tekrar}
                onChange={(e) => setTekrar(e.target.value)}
              />
            </div>

            {hatalar.length > 0 && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded text-sm">
                <ul className="list-disc pl-5 space-y-0.5">
                  {hatalar.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {basari && (
              <div className="bg-green-900/40 border border-green-600 text-green-200 px-4 py-3 rounded text-sm">
                Şifren değiştirildi. Bir sonraki girişte yeni şifreni kullan.
              </div>
            )}

            <button type="submit" disabled={gonderiliyor} className={anaDugme}>
              {gonderiliyor ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
