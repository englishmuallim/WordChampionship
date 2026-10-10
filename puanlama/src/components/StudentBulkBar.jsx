import { ikincilDugme } from '../lib/stil'

// Seçim varken görünen toplu işlem çubuğu.
export default function StudentBulkBar({ seciliSayisi, gorunenSayisi, onIslem, onTemizle }) {
  const dugme = `${ikincilDugme} !py-1.5 !px-3`
  return (
    <div className="flex flex-wrap items-center gap-3 bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-3 mb-3">
      <p className="text-sm text-blue-100 mr-2">
        Seçili: <b>{seciliSayisi}</b> öğrenci <span className="text-blue-300">(görünen {gorunenSayisi})</span>
      </p>
      <button onClick={() => onIslem('arsivle')} className={dugme}>
        Arşivle (ayrıldı)
      </button>
      <button onClick={() => onIslem('geri_al')} className={dugme}>
        Arşivden geri al
      </button>
      <button onClick={() => onIslem('sube')} className={dugme}>
        Şube değiştir
      </button>
      <button onClick={() => onIslem('kademe')} className={dugme}>
        Kademe değiştir
      </button>
      <button onClick={onTemizle} className="text-sm text-blue-300 hover:text-white underline ml-auto">
        Seçimi temizle
      </button>
    </div>
  )
}
