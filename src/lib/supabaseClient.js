import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem estas variáveis a app continua a abrir (jogos solo, vs bot e o
// multiplayer local entre separadores), mas o login e as salas online não
// funcionam.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env: o login e o multiplayer online não vão funcionar.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'sem-chave'
)
