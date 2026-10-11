// Ünite Sonuçları sayfası mantığı (arayüzden bağımsız, saf fonksiyonlar).
//
// Girdi: wc_unit_results çıktısı (seçilen ünite DAHİL ona kadarki girdi/kopya kayıtları, yalnızca aktif öğrenciler)
//  kayitlar : [{ student_id, student_no, full_name, class_name, unit_no, status, correct_count,
//               question_count, points_per_question }]

const SIRA_ADLARI = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH']

// 11TH, 12TH, 13TH, 21ST, 22ND, 23RD, 24TH ...
function ingilizceSira(n) {
  const son2 = n % 100
  if (son2 >= 11 && son2 <= 13) return `${n}TH`
  const ek = { 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] ?? 'TH'
  return `${n}${ek}`
}

// Ünite numarasına göre sıra adı: 1 -> FIRST ... 10 -> TENTH, ötesi 11TH, 12TH ...
export function uniteAdi(uniteNo) {
  return SIRA_ADLARI[uniteNo - 1] ?? ingilizceSira(uniteNo)
}

// Başlığın 3 satırı. Metinler doğrudan büyük harfle yazılır (CSS dönüşümüne güvenilmez).
export function baslikMetni(kademe, uniteNo) {
  return {
    okul: 'BOYACI MAHMUT ZİYLAN İMAM-HATİP SECONDARY SCHOOL',
    yarisma: 'WORD CHAMPIONSHIP',
    sonuc: `${uniteAdi(uniteNo)} COMPETITION RESULTS OF YEAR ${kademe}`,
  }
}

// Sınıf "5-C" biçiminde
export function sinifMetni(kademe, sube) {
  return sube ? `${kademe}-${sube}` : String(kademe)
}

// Tam puan: tüm sorular doğru (soru sayısı 0 olan sınav tam puan sayılmaz)
export function tamPuanMi(dogru, soruSayisi) {
  return soruSayisi > 0 && dogru === soruSayisi
}

// Her öğrenci için seçilen ünitenin sonucu ve "ona kadarki" toplam.
//  * Listede yalnızca seçilen ünitede girdi ya da kopya kaydı olanlar bulunur (girmedi / kayıtsız: yok).
//  * Kopya: 0 doğru, 0 puan.
//  * Toplam yalnızca unit_no <= seçilen ünitelerin puanını sayar; sonraki üniteler toplamı değiştirmez.
//    Kopya ve girmedi toplama 0 katar.
export function ogrenciSatirlari(kayitlar, uniteNo, kademe) {
  const ogrenciler = new Map()
  for (const k of kayitlar) {
    if (k.unit_no > uniteNo) continue
    if (k.status !== 'girdi' && k.status !== 'kopya') continue
    let o = ogrenciler.get(k.student_id)
    if (!o) {
      o = {
        ogrenciId: k.student_id,
        no: k.student_no,
        ad: k.full_name,
        sinif: sinifMetni(kademe, k.class_name),
        sube: k.class_name,
        listede: false,
        dogru: 0,
        puan: 0,
        tamPuan: false,
        toplam: 0,
      }
      ogrenciler.set(k.student_id, o)
    }
    const puan = k.status === 'girdi' ? k.correct_count * k.points_per_question : 0
    o.toplam += puan
    if (k.unit_no === uniteNo) {
      o.listede = true
      o.dogru = k.status === 'girdi' ? k.correct_count : 0
      o.puan = puan
      o.tamPuan = k.status === 'girdi' && tamPuanMi(k.correct_count, k.question_count)
    }
  }
  return [...ogrenciler.values()].filter((o) => o.listede)
}

const trKarsilastir = (a, b) => (a ?? '').localeCompare(b ?? '', 'tr')
// Öğrenci numarası metin olabilir: "9" < "10" (sayısal karşılaştırma)
const noKarsilastir = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'tr', { numeric: true })

// Belirleyici sıralama: ünite puanı ↓, ona kadarki toplam ↓, ad soyad (Türkçe A-Z), öğrenci no (sayısal)
export function sonuclariSirala(satirlar) {
  return [...satirlar].sort(
    (a, b) => b.puan - a.puan || b.toplam - a.toplam || trKarsilastir(a.ad, b.ad) || noKarsilastir(a.no, b.no)
  )
}

// Öğrenci sayısına göre sütun sayısı: ≤30 → 1, 31-70 → 2, ≥71 → 3
export function otomatikSutunSayisi(ogrenciSayisi) {
  if (ogrenciSayisi <= 30) return 1
  if (ogrenciSayisi <= 70) return 2
  return 3
}

// Sırayı korur; önce sol sütun yukarıdan aşağı dolar. Sütunlar dengeli: uzunlukları en fazla 1 fark eder.
export function sutunlaraBol(satirlar, sutunSayisi) {
  const taban = Math.floor(satirlar.length / sutunSayisi)
  const fazla = satirlar.length % sutunSayisi
  const sutunlar = []
  let bas = 0
  for (let i = 0; i < sutunSayisi; i++) {
    const uzunluk = taban + (i < fazla ? 1 : 0)
    sutunlar.push(satirlar.slice(bas, bas + uzunluk))
    bas += uzunluk
  }
  return sutunlar
}

// Çıktı alanı sabit genişlikte, sayfa yaklaşık 1,4:1 yatay oranda kalsın diye satır yüksekliği (px) ve yazı boyutu.
export const CIKTI_GENISLIGI = 1500
export const CIKTI_ORANI = 1.4
const BASLIK_YUKSEKLIGI = 250 // başlık şeridi + boşluklar (tahmini)
export function satirOlculeri(sutundakiSatirSayisi) {
  const bos = CIKTI_GENISLIGI / CIKTI_ORANI - BASLIK_YUKSEKLIGI
  const satir = Math.max(18, Math.min(40, bos / (sutundakiSatirSayisi + 1))) // +1: sütun başlık satırı
  return { satir, yazi: satir * 0.58 }
}

// wc_unit_results henüz veritabanında yoksa (SQL çalıştırılmadıysa) PostgREST "fonksiyon bulunamadı" der.
// Bu durumda ne yapılacağı açıkça söylenir; diğer hatalar çağıran tarafın genel hata metnine bırakılır.
export function fonksiyonYokMu(error) {
  return Boolean(error) && (error.code === 'PGRST202' || error.code === '42883')
}

export const FONKSIYON_YOK_MESAJI =
  'Ünite sonuçları için gerekli veritabanı fonksiyonu (wc_unit_results) henüz kurulmamış. ' +
  'wc_unit_results.sql dosyası Supabase SQL editöründe çalıştırıldıktan sonra sayfa çalışacaktır.'

// İndirilen PNG'nin dosya adı
export function pngDosyaAdi(kademe, uniteNo) {
  return `word-championship-${kademe}-kademe-${uniteNo}-unite.png`
}

// Ekranda çıktı alanını kabın genişliğine sığdıran ölçek (büyütmez; hiçbir zaman 1'i aşmaz).
// Yalnızca ekran görünümü içindir; indirilen PNG her zaman tam boyuttur.
export function ekranOlcegi(kapGenisligi) {
  if (!(kapGenisligi > 0)) return 1
  return Math.min(1, kapGenisligi / CIKTI_GENISLIGI)
}
