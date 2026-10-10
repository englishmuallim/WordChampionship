import { useCallback, useEffect, useState } from 'react'
import { hataMetni } from './hatalar'
import {
  ogrenciEkle,
  ogrenciGuncelle,
  ogrenciSil,
  puanSayilariGetir,
  topluIslemUygula,
  tumOgrencileriGetir,
} from './ogrenciler'
import { silmeDurumu, silmeOnayMetni } from './ogrenciYonetimi'
import { sonucMesaji } from './ogrenciToplu'

// Öğrenciler sayfasının veri yükleme ve yazma işleyicileri (sayfa bileşeni yalnızca arayüzle ilgilenir).
export function useOgrenciYonetimi(okulId) {
  const [ogrenciler, setOgrenciler] = useState([])
  const [puanSayilari, setPuanSayilari] = useState(null) // Map ya da null (alınamadıysa)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [bilgi, setBilgi] = useState('')

  // Öğrencileri ve puan kaydı sayılarını birlikte yükler. Sayılar alınamazsa silme ve kademe
  // değişikliği güvenli tarafta kapalı kalır (null = bilinmiyor).
  const yukle = useCallback(async () => {
    const [o, p] = await Promise.all([tumOgrencileriGetir(), puanSayilariGetir()])
    if (o.error) {
      setHata(hataMetni(o.error))
      return false
    }
    setOgrenciler(o.data)
    if (p.error) {
      hataMetni(p.error) // konsola ayrıntıyı yazar
      setPuanSayilari(null)
      setHata('Puan kaydı sayıları alınamadı: silme ve kademe değişikliği şimdilik kapalı. Sayfayı yenileyip tekrar dene.')
    } else {
      setPuanSayilari(p.harita)
      setHata('')
    }
    return true
  }, [])

  useEffect(() => {
    let iptal = false
    yukle().finally(() => {
      if (!iptal) setYukleniyor(false)
    })
    return () => {
      iptal = true
    }
  }, [yukle])

  // Ekleme ve düzenleme penceresinden gelen kayıt isteği. Hata metni ya da boş metin (başarı) döner.
  const kaydet = useCallback(
    async (duzenlenen, deger, degisenler) => {
      setBilgi('')
      const sonuc = duzenlenen
        ? await ogrenciGuncelle(duzenlenen.id, degisenler)
        : await ogrenciEkle(okulId, deger)
      if (sonuc.error) return hataMetni(sonuc.error, { tur: 'ogrenci', no: deger.student_no })
      if (sonuc.mesaj) return sonuc.mesaj
      await yukle()
      setBilgi(duzenlenen ? `${deger.full_name} güncellendi.` : `${deger.full_name} (${deger.student_no}) eklendi.`)
      return ''
    },
    [okulId, yukle]
  )

  const sil = useCallback(
    async (ogrenci) => {
      setBilgi('')
      const durum = silmeDurumu(ogrenci.id, puanSayilari)
      if (!durum.izin) return setHata(durum.neden)
      if (!window.confirm(silmeOnayMetni(ogrenci))) return

      const sonuc = await ogrenciSil(ogrenci.id)
      if (sonuc.error) return setHata(hataMetni(sonuc.error, { tur: 'ogrenci' }))
      if (sonuc.mesaj) return setHata(sonuc.mesaj)
      await yukle()
      setBilgi(`${ogrenci.full_name} (${ogrenci.student_no}) silindi.`)
    },
    [puanSayilari, yukle]
  )

  // Toplu/tekli arşiv, geri alma, şube ve kademe işlemi. { hata } ya da { sayi } döner.
  const topluUygula = useCallback(
    async (islem, ayar, istek) => {
      setBilgi('')
      const sonuc = await topluIslemUygula(istek)
      if (sonuc.error) return { hata: hataMetni(sonuc.error) }
      await yukle()
      setBilgi(sonucMesaji(islem, ayar, sonuc.sayi))
      return { sayi: sonuc.sayi }
    },
    [yukle]
  )

  return { ogrenciler, puanSayilari, yukleniyor, hata, bilgi, setHata, setBilgi, kaydet, sil, topluUygula }
}
