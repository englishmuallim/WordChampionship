// "2026-10-03" -> "03.10.2026" (saat dilimi kayması olmaması için metin olarak bölünür)
export function tarihYaz(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// Metin kutusundan gelen değerin 1 veya üstü tam sayı olup olmadığına bakar.
export function tamSayi(deger, enAz, enCok = Infinity) {
  if (!/^\d+$/.test(String(deger).trim())) return null
  const n = Number(deger)
  return n >= enAz && n <= enCok ? n : null
}
