import { useMemo, useState } from 'react'
import { yapistirmaCoz, yapistirmaEtkisi } from '../lib/puanGirisi'
import { anaDugme, ikincilDugme, kart } from '../lib/stil'

const BICIM_ADLARI = {
  1: '1 — yalnızca doğru sayıları',
  2: '2 — öğrenci no + doğru sayısı',
  3: '3 — öğrenci no + ad soyad + doğru sayısı',
}

// Excel'den yapıştırma paneli. "Uygula" yalnızca ekrandaki kutuları doldurur, kaydetmez.
export default function ScorePasteBox({ ogrenciler, soruSayisi, satirlar, onUygula, onKapat }) {
  const [metin, setMetin] = useState('')
  const sonuc = useMemo(() => yapistirmaCoz(metin, ogrenciler, soruSayisi), [metin, ogrenciler, soruSayisi])
  const etki = useMemo(() => yapistirmaEtkisi(sonuc.uygulanacak, satirlar), [sonuc, satirlar])

  return (
    <section className={kart}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="text-lg font-semibold text-gray-200">Excel'den yapıştır</h2>
        <button onClick={onKapat} className="text-gray-400 hover:text-white text-sm font-bold">
          Kapat ✕
        </button>
      </div>

      <div className="text-sm text-gray-400 mb-3 space-y-2">
        <p>
          Excel'de hücreleri kopyalayıp aşağıya yapıştır. Sütun sayısına bakılarak biçim kendiliğinden anlaşılır
          (en fazla 3 sütun):
        </p>
        <ul className="space-y-1 pl-4 list-disc">
          <li>
            <b className="text-gray-200">1 sütun — yalnızca doğru sayıları:</b> ekrandaki liste sırasıyla uygulanır.
            Örnek: <code className="text-blue-300">20</code> ↵ <code className="text-blue-300">G</code> ↵{' '}
            <code className="text-blue-300">K</code> ↵ <code className="text-blue-300">15</code>
          </li>
          <li>
            <b className="text-gray-200">2 sütun — öğrenci no, doğru sayısı:</b> numaraya göre eşleşir. Örnek:{' '}
            <code className="text-blue-300">9001 ⇥ 20</code>
          </li>
          <li>
            <b className="text-gray-200">3 sütun — öğrenci no, ad soyad, doğru sayısı:</b> yine yalnızca numaraya göre
            eşleşir; ad soyad sadece kontrol içindir, farklıysa uyarı verir ama satırı engellemez. Örnek:{' '}
            <code className="text-blue-300">9001 ⇥ ALİ CAN ⇥ 20</code>
          </li>
        </ul>
        <p>
          Girmedi için <b>G</b> ya da <b>girmedi</b>, kopya için <b>K</b> ya da <b>kopya</b> yaz (doğru sayısı yerine).
          Boş hücre o öğrenciye dokunmaz. İlk satır başlıksa (örn. "Öğrenci No") atlanır. Uygulanınca kutular dolar,{' '}
          <b>kaydedilmez</b>; kontrol edip Kaydet'e basarsın.
        </p>
      </div>

      <textarea
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        rows={6}
        placeholder="Excel'de hücreleri kopyala, buraya yapıştır (Ctrl+V)"
        className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
      />

      {sonuc.hata && (
        <div className="mt-3 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded text-sm">
          <b>{sonuc.hata}</b>
          <p className="mt-1">Hiçbir şey uygulanmayacak. Fazla sütunları silip yeniden yapıştır.</p>
        </div>
      )}

      {sonuc.bicim && (
        <div className="mt-3 text-sm space-y-2">
          <p className="text-gray-300">
            Algılanan biçim: <b className="text-blue-400">{BICIM_ADLARI[sonuc.bicim]}</b> · {sonuc.girdiSayisi} satır
            {sonuc.baslikAtlandi && ' (ilk satır başlık sayıldı ve atlandı)'}
          </p>
          <p className="text-gray-300">
            Uygulanacak: <b className="text-green-400">{sonuc.uygulanacak.length}</b> öğrenci
            {etki > 0 && (
              <>
                {' '}
                · <b className="text-amber-400">{etki}</b> öğrencinin kutuda zaten dolu olan değeri değişecek
              </>
            )}
          </p>
          {sonuc.uyarilar.length > 0 && (
            <div className="bg-amber-900/30 border border-amber-600 text-amber-200 rounded p-3 max-h-48 overflow-y-auto">
              <p className="font-bold mb-1">Uyarılar ({sonuc.uyarilar.length}):</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {sonuc.uyarilar.map((u, i) => (
                  <li key={i} className={/İsim farkı/.test(u) ? 'font-bold text-amber-100' : ''}>
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => onUygula(sonuc.uygulanacak)} disabled={!sonuc.uygulanacak.length} className={anaDugme}>
          Kutulara uygula ({sonuc.uygulanacak.length})
        </button>
        <button onClick={onKapat} className={ikincilDugme}>
          Vazgeç
        </button>
        {sonuc.isimFarki > 0 && (
          <span className="text-sm text-amber-300 font-bold">
            ⚠ {sonuc.isimFarki} satırda isim farkı var (satırlar yine de uygulanır; uyarıları kontrol et)
          </span>
        )}
      </div>
    </section>
  )
}
