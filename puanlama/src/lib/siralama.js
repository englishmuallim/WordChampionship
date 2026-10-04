// Sıralama sayfası mantığı (arayüzden bağımsız, saf fonksiyonlar).
//
// Girdiler:
//  satirlar  : wc_ranking çıktısı [{ student_id, student_no, full_name, grade, class_name, is_active,
//              exams_taken, total_points, grade_rank, class_rank, kopya_sayisi }]
//  sinavlar  : seçilen kademenin sınavları [{ id, unit_no, exam_date, question_count, points_per_question }]
//  puanlar   : ham puan kayıtları [{ exam_id, student_id, status, correct_count }]  (erişim kurallarıyla süzülmüş)
//  erisimli  : ham puanlarını görmeye yetkili olunan öğrenci id'leri (Set). Yönetici için hepsi.

// Sınavları ünite numarasına göre sıralar
export function sinavlariSirala(sinavlar) {
  return [...sinavlar].sort((a, b) => a.unit_no - b.unit_no)
}

// Sütun başlığı: kısa ad ve üzerine gelince çıkan açıklama
export function sinavBasligi(sinav) {
  const tarih = sinav.exam_date ? sinav.exam_date.split('-').reverse().join('.') : null
  return {
    kisa: `Ü${sinav.unit_no}`,
    aciklama:
      `${sinav.unit_no}. ünite` +
      (tarih ? ` · ${tarih}` : '') +
      ` · ${sinav.question_count} soru × ${sinav.points_per_question} puan`,
  }
}

// Ünite hücresinin ekranda/CSV'de görünen metni: puan, K (kopya), — (girmedi), boş (kayıt yok ya da erişim yok)
export function hucreMetni(hucre) {
  switch (hucre.durum) {
    case 'puan':
      return String(hucre.puan)
    case 'kopya':
      return 'K'
    case 'girmedi':
      return '—'
    default:
      return '' // 'bos' (kayıt yok) ve 'gizli' (erişim yok)
  }
}

// Sıralama satırlarını ünite hücreleri ve tutarlılık bilgisiyle birleştirir.
export function tabloSatirlari({ satirlar, sinavlar, puanlar, erisimli }) {
  const sirali = sinavlariSirala(sinavlar)
  const kayit = new Map(puanlar.map((p) => [`${p.exam_id}|${p.student_id}`, p]))

  return satirlar.map((s) => {
    const goruntulenebilir = erisimli.has(s.student_id)
    const hucreler = sirali.map((sinav) => {
      if (!goruntulenebilir) return { sinavId: sinav.id, durum: 'gizli' }
      const p = kayit.get(`${sinav.id}|${s.student_id}`)
      if (!p) return { sinavId: sinav.id, durum: 'bos' }
      if (p.status === 'girdi') {
        return { sinavId: sinav.id, durum: 'puan', puan: p.correct_count * sinav.points_per_question }
      }
      if (p.status === 'kopya') return { sinavId: sinav.id, durum: 'kopya' }
      return { sinavId: sinav.id, durum: 'girmedi' }
    })

    // Tutarlılık: görülebilen ünite verisi, veritabanının değerleriyle uyuşuyor mu?
    // Girdi sayısı, kopya sayısı ve toplam puan ayrı ayrı karşılaştırılır (toplamları birbirini götüremez).
    let uyumsuz = null
    if (goruntulenebilir) {
      const toplam = hucreler.reduce((t, h) => t + (h.durum === 'puan' ? h.puan : 0), 0)
      const girilen = hucreler.filter((h) => h.durum === 'puan').length
      const kopya = hucreler.filter((h) => h.durum === 'kopya').length
      if (toplam !== s.total_points || girilen !== s.exams_taken || kopya !== s.kopya_sayisi) {
        uyumsuz = `Ünite puanlarının toplamı ${toplam} (${girilen} girdi + ${kopya} kopya); sıralamadaki değerler ` +
          `${s.total_points} (${s.exams_taken} girdi + ${s.kopya_sayisi} kopya).`
      }
    }

    return {
      ogrenciId: s.student_id,
      no: s.student_no,
      ad: s.full_name,
      kademe: s.grade,
      sube: s.class_name,
      aktif: s.is_active !== false,
      // Kopya çeken öğrenci sınava girmiş sayılır: "girdiği sınav" = girdi + kopya.
      // NOT (ileride "ortalamayla tamamlama" kuralı için): ortalamanın böleni de girdi + kopya olacak;
      // kopya sınavı 0 puanla toplanır ve bölüme dahil edilir. Şimdi uygulanmıyor.
      sinavSayisi: s.exams_taken + s.kopya_sayisi,
      girdiSayisi: s.exams_taken,
      toplam: s.total_points,
      kopya: s.kopya_sayisi,
      kademeSirasi: s.grade_rank,
      subeSirasi: s.class_rank,
      erisimli: goruntulenebilir,
      hucreler,
      uyumsuz,
    }
  })
}

// Şube listesi (boş olanlar atlanır, Türkçe sıralı)
export function subeListesi(satirlar) {
  return [...new Set(satirlar.map((s) => s.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
}

// Şube filtresi (boş = tüm şubeler)
export function subeyeGoreSuz(tablo, sube) {
  return sube ? tablo.filter((s) => s.sube === sube) : tablo
}

// Sıralama düzeni: 'kademe' = kademe sırasına göre, 'sube' = şube içi sıraya göre
export function duzenleSirala(tablo, duzen) {
  const tr = (a, b) => (a ?? '').localeCompare(b ?? '', 'tr')
  const kopya = [...tablo]
  if (duzen === 'sube') {
    return kopya.sort((a, b) => tr(a.sube, b.sube) || a.subeSirasi - b.subeSirasi || a.kademeSirasi - b.kademeSirasi || tr(a.ad, b.ad))
  }
  return kopya.sort((a, b) => a.kademeSirasi - b.kademeSirasi || tr(a.sube, b.sube) || tr(a.ad, b.ad))
}

// Erişimi olmayan (ünite puanları gizli) satır var mı?
export function gizliSatirVar(tablo) {
  return tablo.some((s) => !s.erisimli)
}

// Çekilen verinin hangi seçime ait olduğunu belirleyen anahtar. Kademe ya da "ayrılanlar" değişince anahtar değişir.
export function secimAnahtari(kademe, ayrilanlarDahil) {
  return `${kademe}|${ayrilanlarDahil ? 'ayrilanlar' : 'aktif'}`
}

// Eldeki veri, şu anki seçime mi ait? Değilse (yeni veri henüz gelmediyse) tablo kurulmamalı:
// eski seçimin satırlarını yeni seçimin sınavlarıyla birleştirmek sahte uyuşmazlık uyarısı üretir.
export function veriGuncelMi(veri, kademe, ayrilanlarDahil) {
  return Boolean(veri) && veri.anahtar === secimAnahtari(kademe, ayrilanlarDahil)
}
