import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { isInsideDiscordActivity, initDiscordActivity } from '../lib/discordActivity.js'

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

  const signOut = () => supabase.auth.signOut()

  return { user, loading, signInWithDiscord, signOut, discordActivity }
}