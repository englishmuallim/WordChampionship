// Türkçe karakter ve büyük/küçük harf farkını ortadan kaldırır: "Öğrenci" -> "ogrenci", "İLKAY" -> "ilkay"
const HARF_HARITASI = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c' }

export function sadelestir(metin) {
  return String(metin ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[ığüşöç]/g, (h) => HARF_HARITASI[h])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
