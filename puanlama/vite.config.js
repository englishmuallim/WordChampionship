import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Güvenlik bekçisi: tarayıcıya girecek VITE_ değişkenlerinde gizli anahtar varsa derlemeyi durdurur.
function gizliAnahtarBekcisi(mode) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  for (const [ad, deger] of Object.entries(env)) {
    const supheli =
      /sb_secret_/i.test(deger) ||
      /service_role/i.test(ad + deger) ||
      (/^eyJ/.test(deger) && /service_role/.test(safeDecode(deger)))
    if (supheli) {
      throw new Error(
        `GÜVENLİK: ${ad} gizli bir anahtar içeriyor görünüyor. Tarayıcıya yalnızca sb_publishable_ ile başlayan anahtar konabilir.`
      )
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('GÜVENLİK: VITE_SUPABASE_PUBLISHABLE_KEY "sb_publishable_" ile başlamıyor.')
  }
}

function safeDecode(jwt) {
  try {
    return Buffer.from(jwt.split('.')[1] || '', 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

export default defineConfig(({ mode }) => {
  gizliAnahtarBekcisi(mode)
  return { plugins: [react(), tailwindcss()] }
})
