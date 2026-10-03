import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('.env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY tanımlı olmalı.')
}
if (!key.startsWith('sb_publishable_')) {
  throw new Error('Tarayıcıda yalnızca sb_publishable_ ile başlayan anahtar kullanılabilir.')
}

export const supabase = createClient(url, key)
