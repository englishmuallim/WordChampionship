// Bir metni dosya olarak indirir (tarayıcı). CSV için BOM metnin kendisinde bulunur (csv.js ekler).
export function metinIndir(metin, dosyaAdi, tur = 'text/csv;charset=utf-8') {
  const adres = URL.createObjectURL(new Blob([metin], { type: tur }))
  const a = document.createElement('a')
  a.href = adres
  a.download = dosyaAdi
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(adres), 10000)
}
