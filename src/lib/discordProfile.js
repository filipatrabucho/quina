export function getDisplayName(user) {
  if (!user) return 'Jogador'
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.custom_claims?.global_name ||
    user.email ||
    'Jogador'
  )
}

export function getAvatarUrl(user) {
  return user?.user_metadata?.avatar_url || null
}