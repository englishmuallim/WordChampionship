import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { girisEpostasi } from './config'

const AuthContext = createContext(null)

const PASIF_MESAJI = 'Hesabın pasifleştirilmiş ya da kaldırılmış. Yönetici ile görüş.'
const KONTROL_ARALIGI = 5 * 60 * 1000 // 5 dakika
const EN_SIK_KONTROL = 10 * 1000 // art arda tetiklenen kontrolleri (odak + görünürlük) birleştirir

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null) // wc_staff satırı: ad, rol, vb.
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  // Oturum değişikliklerini dinle
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_olay, yeniOturum) => {
      setSession(yeniOturum)
      if (!yeniOturum) {
        setStaff(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Oturum açıldığında, bu kişinin personel kaydını (rol, aktiflik) oku
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let iptal = false
    setLoading(true)
    supabase
      .from('wc_staff')
      .select('id, full_name, username, role, is_active, school_id')
      .eq('id', userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (iptal) return
        if (error || !data || !data.is_active) {
          setAuthError(data && !data.is_active ? PASIF_MESAJI : 'Bu hesabın yetkisi yok.')
          setStaff(null)
          await supabase.auth.signOut()
        } else {
          setStaff(data)
        }
        setLoading(false)
      })
    return () => {
      iptal = true
    }
  }, [userId])

  // Açık duran sekmede hesap pasifleştirilmiş/silinmişse otomatik çıkış yaptır.
  // Kontrol: sekmeye dönünce ve 5 dakikada bir. Geçici bağlantı hatasında oturum kapatılmaz.
  const sonKontrol = useRef(0)
  useEffect(() => {
    if (!userId) return
    let iptal = false
    async function kontrolEt() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - sonKontrol.current < EN_SIK_KONTROL) return
      sonKontrol.current = Date.now()
      const { data, error } = await supabase
        .from('wc_staff')
        .select('id, full_name, username, role, is_active, school_id')
        .eq('id', userId)
        .maybeSingle()
      if (iptal || error) return // hata: geçici olabilir, bir sonraki kontrolde tekrar denenir
      if (!data || !data.is_active) {
        setAuthError(PASIF_MESAJI)
        setStaff(null)
        await supabase.auth.signOut()
      } else {
        // Rol ya da ad değiştiyse güncelle; değişmediyse aynı nesneyi koru (gereksiz yeniden çizim olmasın)
        setStaff((onceki) =>
          onceki &&
          onceki.id === data.id &&
          onceki.role === data.role &&
          onceki.full_name === data.full_name &&
          onceki.username === data.username
            ? onceki
            : data
        )
      }
    }
    const zamanlayici = setInterval(kontrolEt, KONTROL_ARALIGI)
    document.addEventListener('visibilitychange', kontrolEt)
    window.addEventListener('focus', kontrolEt)
    return () => {
      iptal = true
      clearInterval(zamanlayici)
      document.removeEventListener('visibilitychange', kontrolEt)
      window.removeEventListener('focus', kontrolEt)
    }
  }, [userId])

  const signIn = useCallback(async (girdi, sifre) => {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: girisEpostasi(girdi),
      password: sifre,
    })
    if (error) {
      return error.status === 429
        ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'
        : 'Kullanıcı adı veya şifre hatalı.'
    }
    return ''
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, staff, loading, authError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
