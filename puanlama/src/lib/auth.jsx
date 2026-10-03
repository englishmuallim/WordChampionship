import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { girisEpostasi } from './config'

const AuthContext = createContext(null)

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
          setAuthError('Bu hesabın yetkisi yok.')
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
