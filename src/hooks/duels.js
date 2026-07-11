import { supabase } from './supabaseClient.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem carateres ambíguos (0/O, 1/I)

function randomCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function createDuel() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Precisas de iniciar sessão com o Discord primeiro.')

  const code = randomCode()
  const { data, error } = await supabase
    .from('duels')
    .insert({ host_id: user.id, code })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function joinDuel(code) {
  const { data, error } = await supabase.rpc('join_duel', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data
}

export async function getDuel(duelId) {
  const { data, error } = await supabase.from('duels').select('*').eq('id', duelId).single()
  if (error) throw error
  return data
}

export async function submitSecretWord(duelId, word) {
  const { error } = await supabase.rpc('submit_secret_word', {
    p_duel_id: duelId,
    p_word: word,
  })
  if (error) throw error
}

// Devolve só os estados por letra ('certo' | 'lugar-errado' | 'errado') —
// a palavra do adversário nunca passa pelo cliente, a não ser que a
// tentativa seja exatamente igual (nesse caso já a sabes, ganhaste).
export async function submitDuelGuess(duelId, guess) {
  const { data, error } = await supabase.rpc('submit_guess', {
    p_duel_id: duelId,
    p_guess: guess,
  })
  if (error) throw error
  return data
}

export function subscribeToDuel(duelId, onChange) {
  const channel = supabase
    .channel(`duel-${duelId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${duelId}` },
      (payload) => onChange(payload.new)
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}