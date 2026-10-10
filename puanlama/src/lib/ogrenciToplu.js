// Arşivleme ("ayrıldı"), arşivden geri alma ve toplu işlem mantığı (arayüzden bağımsız, saf fonksiyonlar).
// Sunucu tarafındaki karşılıkları 01_ogrenci_yonetimi.sql içindeki wc_ogrenci_* fonksiyonlarıdır;
// onlar tek komutta çalışır ve "hepsi ya da hiçbiri" kuralını uygular.
import { kademeDogrula, subeDogrula } from './ogrenciDogrulama.js'
import { kademeKilidi } from './ogrenciYonetimi.js'
import { tarihYaz } from './format.js'

// ---------------------------------------------------------------------------------------------
// Ayrılma tarihi ve nedeni
// ---------------------------------------------------------------------------------------------

export const AYRILMA_NEDENLERI = ['Nakil', 'Okuldan ayrıldı', 'Sürekli devamsız', 'Yurt dışına gitti', 'Şube kapatıldı']
export const DIGER = 'Diğer'
const EN_UZUN_NEDEN = 200

// Bugünün tarihi, İstanbul saatine göre "YYYY-MM-DD" (tarayıcının saat diliminden bağımsız).
export function bugunTarihi(simdi = new Date()) {
  return simdi.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
}

// "2026-02-30" gibi takvimde olmayan günleri yakalar (Date.parse bunları tolere eder).
function gecerliTakvimTarihi(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return false
  const [y, ay, gun] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(y, ay - 1, gun))
  return d.getUTCFullYear() === y && d.getUTCMonth() === ay - 1 && d.getUTCDate() === gun
}

// Arşiv formunu doğrular. form: { tarih: 'YYYY-MM-DD', nedenSecimi, nedenMetni }.
// Neden isteğe bağlıdır; "Diğer" seçilirse serbest metin zorunludur.
export function arsivFormuDogrula(form, bugun) {
  const hatalar = []
  const tarih = form.tarih ?? ''
  if (!tarih) hatalar.push('Ayrılma tarihini seç.')
  else if (!gecerliTakvimTarihi(tarih) || tarih < '2000-01-01') {
    hatalar.push('Ayrılma tarihi geçerli değil.')
  } else if (tarih > bugun) hatalar.push('Ayrılma tarihi gelecekte olamaz.')

  let neden = null
  if (form.nedenSecimi === DIGER) {
    const metin = (form.nedenMetni ?? '').trim().replace(/\s+/g, ' ')
    if (!metin) hatalar.push('"Diğer" seçildiğinde nedeni yaz.')
    else if (metin.length > EN_UZUN_NEDEN) hatalar.push(`Neden en fazla ${EN_UZUN_NEDEN} karakter olabilir.`)
    else neden = metin
  } else if (form.nedenSecimi) {
    if (AYRILMA_NEDENLERI.includes(form.nedenSecimi)) neden = form.nedenSecimi
    else hatalar.push('Ayrılma nedeni listede yok.')
  }
  return { deger: hatalar.length ? null : { left_at: tarih, left_reason: neden }, hatalar }
}

// Listedeki bir nedeni göstermek için. Listede olmayan serbest metinler (örn. SQL ile yazılmış) olduğu gibi gösterilir.
export function nedenGosterimi(leftReason) {
  return String(leftReason ?? '').trim()
}

// ---------------------------------------------------------------------------------------------
// Çoklu seçim (yalnızca GÖRÜNEN satırlar seçilebilir; süzgeç değişince görünmeyenler seçimden düşer)
// ---------------------------------------------------------------------------------------------

export function secimiDegistir(secili, id) {
  const yeni = new Set(secili)
  if (yeni.has(id)) yeni.delete(id)
  else yeni.add(id)
  return yeni
}

export function hepsiniSec(gorunenler) {
  return new Set(gorunenler.map((o) => o.id))
}

// Seçimi görünen satırlarla kesiştirir. Değişiklik yoksa AYNI nesneyi döndürür (gereksiz yeniden çizim olmasın).
export function gorunenlerleKesistir(secili, gorunenler) {
  const gorunenId = new Set(gorunenler.map((o) => o.id))
  const kalan = [...secili].filter((id) => gorunenId.has(id))
  return kalan.length === secili.size ? secili : new Set(kalan)
}

export function seciliOgrenciler(secili, gorunenler) {
  return gorunenler.filter((o) => secili.has(o.id))
}

// ---------------------------------------------------------------------------------------------
// Toplu işlem önizlemesi ve sunucu isteği
// ---------------------------------------------------------------------------------------------

export const ISLEMLER = ['arsivle', 'geri_al', 'sube', 'kademe']

const adListesi = (liste, en = 5) =>
  liste.slice(0, en).map((o) => `${o.full_name} (${o.student_no})`).join(', ') + (liste.length > en ? ` ve ${liste.length - en} öğrenci daha` : '')

// islem    : 'arsivle' | 'geri_al' | 'sube' | 'kademe'
// secilenler: seçili öğrenciler [{ id, student_no, full_name, grade, class_name, is_active }]
// ayar     : arsivle -> { tarih, nedenSecimi, nedenMetni } | sube -> { sube } | kademe -> { kademe, sube }
// baglam   : { puanSayilari (Map ya da null), bugun ('YYYY-MM-DD'), tumOgrenciler (yeni şube uyarısı için, isteğe bağlı) }
// Dönen: { uygulanabilir, hatalar[], islenecek[], atlanan[{ogrenci, neden}], engellenen[{ogrenci, neden}], uyarilar[], istek, onay }
export function topluOnizleme(islem, secilenler, ayar, baglam) {
  const onizleme = { uygulanabilir: false, hatalar: [], islenecek: [], atlanan: [], engellenen: [], uyarilar: [], istek: null, onay: '' }
  if (!secilenler.length) {
    onizleme.hatalar.push('Hiç öğrenci seçilmedi.')
    return onizleme
  }
  const ayir = (uygunMu, atlaNedeni) => {
    for (const o of secilenler) {
      if (uygunMu(o)) onizleme.islenecek.push(o)
      else onizleme.atlanan.push({ ogrenci: o, neden: atlaNedeni(o) })
    }
  }
  const atlananNotu = () =>
    onizleme.atlanan.length ? ` ${onizleme.atlanan.length} öğrenci işlem gerektirmediği için atlanacak.` : ''

  if (islem === 'arsivle') {
    const f = arsivFormuDogrula(ayar, baglam.bugun)
    onizleme.hatalar.push(...f.hatalar)
    ayir((o) => o.is_active !== false, () => 'Zaten ayrılmış.')
    if (!onizleme.islenecek.length) onizleme.hatalar.push('Seçilenlerin hepsi zaten ayrılmış.')
    if (!onizleme.hatalar.length) {
      onizleme.istek = {
        fonksiyon: 'wc_ogrenci_arsivle',
        parametreler: { p_ids: onizleme.islenecek.map((o) => o.id), p_left_at: f.deger.left_at, p_reason: f.deger.left_reason },
      }
      onizleme.onay =
        `${onizleme.islenecek.length} öğrenci ayrıldı olarak arşivlenecek (ayrılma tarihi: ${tarihYaz(f.deger.left_at)}, ` +
        `neden: ${f.deger.left_reason ?? 'belirtilmedi'}). Puan kayıtları silinmez; öğrenciler sıralamadan gizlenir.` +
        `${atlananNotu()} Devam edilsin mi?`
    }
  } else if (islem === 'geri_al') {
    ayir((o) => o.is_active === false, () => 'Zaten aktif.')
    if (!onizleme.islenecek.length) onizleme.hatalar.push('Seçilenlerin hepsi zaten aktif.')
    if (!onizleme.hatalar.length) {
      onizleme.istek = { fonksiyon: 'wc_ogrenci_geri_al', parametreler: { p_ids: onizleme.islenecek.map((o) => o.id) } }
      onizleme.onay =
        `${onizleme.islenecek.length} öğrenci arşivden geri alınacak (tekrar aktif olacak; ayrılma tarihi ve nedeni silinecek).` +
        `${atlananNotu()} Devam edilsin mi?`
    }
  } else if (islem === 'sube') {
    // Toplu şube değişiminde yalnızca TEK HARF kabul edilir: seçim farklı kademelerden olabilir, "5-A" gibi bir
    // girişteki sayı sessizce yok sayılmasın.
    const hamSube = String(ayar.sube ?? '').trim()
    const s = /^\p{L}$/u.test(hamSube)
      ? subeDogrula(hamSube, null, 'form')
      : { deger: null, hata: { kod: 'sube_gecersiz', mesaj: hamSube ? `Şube tek bir harf olmalı (bulunan: "${hamSube.slice(0, 10)}").` : 'Şube boş.' } }
    if (s.hata) onizleme.hatalar.push(s.hata.mesaj)
    const hedef = s.deger
    ayir((o) => o.class_name !== hedef, () => `Zaten ${hedef} şubesinde.`)
    if (!s.hata && !onizleme.islenecek.length) onizleme.hatalar.push(`Seçilen öğrencilerin hepsi zaten ${hedef} şubesinde.`)
    if (!s.hata && baglam.tumOgrenciler) {
      for (const k of [...new Set(onizleme.islenecek.map((o) => o.grade))].sort((a, b) => a - b)) {
        const var_ = baglam.tumOgrenciler.some((o) => o.grade === k && o.class_name === hedef)
        if (!var_) onizleme.uyarilar.push(`${k}. kademede ${hedef} şubesi henüz yok; bu işlemle yeni şube oluşacak.`)
      }
    }
    if (!onizleme.hatalar.length) {
      onizleme.istek = {
        fonksiyon: 'wc_ogrenci_sube_degistir',
        parametreler: { p_ids: onizleme.islenecek.map((o) => o.id), p_sube: hedef },
      }
      onizleme.onay =
        `${onizleme.islenecek.length} öğrencinin şubesi ${hedef} yapılacak (kademe değişmez). ` +
        `Puan kayıtlarındaki eski şube bilgisi değişmez.${atlananNotu()} Devam edilsin mi?`
    }
  } else if (islem === 'kademe') {
    const k = kademeDogrula(ayar.kademe, 'form')
    if (k.hata) onizleme.hatalar.push(k.hata.mesaj)
    const yeniSubeVar = ayar.sube != null && String(ayar.sube).trim() !== ''
    const s = yeniSubeVar ? subeDogrula(ayar.sube, k.deger, 'form') : { deger: null, hata: null }
    if (s.hata) onizleme.hatalar.push(s.hata.mesaj)
    if (!k.hata) {
      ayir(
        (o) => o.grade !== k.deger || (yeniSubeVar && s.deger !== null && o.class_name !== s.deger),
        () => `Zaten ${k.deger}. kademede${yeniSubeVar ? ` ve ${s.deger} şubesinde` : ''}.`
      )
      // Aktif sezonda puanı olan (ya da puan bilgisi alınamayan) öğrencinin KADEMESİ değiştirilemez.
      // Tek bir engelli öğrenci varsa hiçbir öğrenciye uygulanmaz (hepsi ya da hiçbiri).
      for (const o of onizleme.islenecek) {
        if (o.grade === k.deger) continue // yalnızca şube değişiyor: kademe kilidi ilgili değil
        const kilit = kademeKilidi(o.id, baglam.puanSayilari)
        if (kilit.kilitli) onizleme.engellenen.push({ ogrenci: o, neden: kilit.neden })
      }
      if (onizleme.engellenen.length) {
        onizleme.hatalar.push(
          `${onizleme.engellenen.length} öğrencinin kademesi değiştirilemiyor (aktif sezonda puan kaydı var): ` +
            `${adListesi(onizleme.engellenen.map((e) => e.ogrenci))}. Bu yüzden hiçbir öğrenciye uygulanmayacak; ` +
            'bu öğrencileri seçimden çıkar.'
        )
      }
      if (!onizleme.islenecek.length && !onizleme.hatalar.length) {
        onizleme.hatalar.push('Seçilen öğrencilerin hepsi zaten bu kademede.')
      }
    }
    if (!onizleme.hatalar.length) {
      onizleme.istek = {
        fonksiyon: 'wc_ogrenci_kademe_degistir',
        parametreler: { p_ids: onizleme.islenecek.map((o) => o.id), p_kademe: k.deger, p_sube: yeniSubeVar ? s.deger : null },
      }
      onizleme.onay =
        `${onizleme.islenecek.length} öğrencinin kademesi ${k.deger} yapılacak` +
        `${yeniSubeVar ? `, şubesi ${s.deger} yapılacak` : ' (şubeleri korunur)'}. Öğrenciler sıralamada yeni kademeye geçer.` +
        `${atlananNotu()} Devam edilsin mi?`
    }
  } else {
    onizleme.hatalar.push('Bilinmeyen işlem.')
  }

  onizleme.uygulanabilir = onizleme.hatalar.length === 0 && onizleme.istek !== null
  return onizleme
}

// İşlem bittikten sonra gösterilecek kısa mesaj
export function sonucMesaji(islem, ayar, sayi) {
  switch (islem) {
    case 'arsivle':
      return `${sayi} öğrenci arşivlendi.`
    case 'geri_al':
      return `${sayi} öğrenci arşivden geri alındı.`
    case 'sube':
      return `${sayi} öğrencinin şubesi ${String(ayar.sube).trim().toLocaleUpperCase('tr')} yapıldı.`
    case 'kademe':
      return `${sayi} öğrencinin kademesi ${Number(ayar.kademe)} yapıldı.`
    default:
      return `${sayi} öğrenci güncellendi.`
  }
}
