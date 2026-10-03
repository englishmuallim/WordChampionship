// Excel / CSV dosyasını TARAYICIDA okur. Dosya hiçbir yere gönderilmez ve kaydedilmez.
import { readSheet } from 'read-excel-file/universal'
import Papa from 'papaparse'

export const EN_BUYUK_DOSYA = 5 * 1024 * 1024 // 5 MB

// .xlsx: ilk sayfanın satırları (her satır bir dizi)
export async function xlsxSatirlari(arrayBuffer) {
  return await readSheet(arrayBuffer)
}

// CSV: önce UTF-8, olmazsa Türkçe Excel'in sık kullandığı Windows-1254
export function csvMetni(arrayBuffer) {
  let metin
  try {
    metin = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer)
  } catch {
    metin = new TextDecoder('windows-1254').decode(arrayBuffer)
  }
  return metin.replace(/^﻿/, '')
}

// Ayırıcıyı (virgül, noktalı virgül, sekme) PapaParse kendisi bulur.
export function csvSatirlari(arrayBuffer) {
  return Papa.parse(csvMetni(arrayBuffer), { skipEmptyLines: 'greedy' }).data
}

// Seçilen dosyadan ham satırları çıkarır. Başarısızsa { hata } döner.
export async function dosyadanSatirlar(dosya) {
  const ad = dosya.name.toLowerCase()
  if (dosya.size > EN_BUYUK_DOSYA) return { hata: 'Dosya 5 MB sınırını aşıyor.' }
  if (ad.endsWith('.xls')) {
    return { hata: 'Eski .xls biçimi desteklenmiyor. Excel\'de "Farklı Kaydet" ile .xlsx olarak kaydedip yükleyin.' }
  }
  const xlsx = ad.endsWith('.xlsx')
  const csv = ad.endsWith('.csv')
  if (!xlsx && !csv) return { hata: 'Yalnızca .xlsx veya .csv dosyası yüklenebilir.' }

  try {
    const veri = await dosya.arrayBuffer()
    const satirlar = xlsx ? await xlsxSatirlari(veri) : csvSatirlari(veri)
    return { satirlar }
  } catch (err) {
    console.error('Dosya okuma hatası:', err?.message)
    return { hata: 'Dosya okunamadı. Dosyanın bozuk olmadığından ve doğru biçimde olduğundan emin olun.' }
  }
}
