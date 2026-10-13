import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { isInsideDiscordActivity, initDiscordActivity } from '../lib/discordActivity.js'

export const GUEST_NAME_KEY = 'quina-nome-convidado'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [discordActivity, setDiscordActivity] = useState(null)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    async function boot() {
      if (isInsideDiscordActivity()) {
        try {
          const activity = await initDiscordActivity()
          setDiscordActivity(activity)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Falha ao autenticar dentro do Discord:', err)
        }
      }
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    }
    boot()

    return () => sub.subscription.unsubscribe()
  }, [])

  const signInWithDiscord = () => {
    supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    })
  }

  // Jogar sem conta Discord: sessão anónima do Supabase com um nome à
  // escolha. O nome vai logo no signInAnonymously para que o primeiro
  // evento de login já o traga (e um convite pendente entre com ele).
  const signInAsGuest = async (name) => {
    const fullName = name.trim().slice(0, 24)
    if (!fullName) throw new Error('Escolhe um nome para jogar.')
    localStorage.setItem(GUEST_NAME_KEY, fullName)
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signOut = () => supabase.auth.signOut()

  return { user, loading, signInWithDiscord, signInAsGuest, signOut, discordActivity }
}