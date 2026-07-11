import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env — o login e o 1vs1 não vão funcionar.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)