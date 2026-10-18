import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export const CIKIS_UYARISI = 'Kaydedilmemiş değişiklikler var. Devam edersen kaybolacaklar. Devam edilsin mi?'

// Kaydedilmemiş değişiklik varken sayfadan çıkışı (sekmeyi kapatma, yenileme, başka sayfaya geçme) onaya bağlar.
export function useKaydedilmemisUyari(kirli) {
  useEffect(() => {
    if (!kirli) return
    const uyar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', uyar)
    return () => window.removeEventListener('beforeunload', uyar)
  }, [kirli])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => kirli && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(CIKIS_UYARISI)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
}
