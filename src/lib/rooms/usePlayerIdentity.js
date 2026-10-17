import { useMemo, useState } from 'react'
import { useAuth, GUEST_NAME_KEY } from '../../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../discordProfile.js'

const GUEST_ID_KEY = 'quina-id-convidado'

function localGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY)
  if (!id) {
    id = `c-${Math.random().toString(36).slice(2, 12)}`
    localStorage.setItem(GUEST_ID_KEY, id)
  }
  return id
}

// Quem sou eu nos jogos novos: a conta (email, Discord ou convidado do
// Supabase) se houver sessão; senão um convidado local só com nome, as
// salas destes jogos não precisam de login.
export function usePlayerIdentity() {
  const { user, loading } = useAuth()
  const [guestName, setGuestNameState] = useState(() => localStorage.getItem(GUEST_NAME_KEY) || '')

  const me = useMemo(() => {
    if (loading) return null
    if (user) {
      return {
        id: user.id,
        name: getDisplayName(user),
        avatar: getAvatarUrl(user),
        seed: getAvatarSeed(user) || user.id,
      }
    }
    if (!guestName) return null
    const id = localGuestId()
    return { id, name: guestName, avatar: null, seed: id }
  }, [user, loading, guestName])

  const setGuestName = (name) => {
    const clean = name.trim().slice(0, 24)
    if (!clean) return
    localStorage.setItem(GUEST_NAME_KEY, clean)
    setGuestNameState(clean)
  }

  return { me, loading, needsName: !loading && !me, setGuestName, hasAccount: !!user && !user.is_anonymous }
}
