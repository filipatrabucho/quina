export function getDisplayName(user) {
  if (!user) return 'Jogador'
  return (
    user.user_metadata?.username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.custom_claims?.global_name ||
    user.email ||
    'Jogador'
  )
}

// URL "partilhável" do avatar (vai para as salas multiplayer). Os bonecos
// gerados que ainda não foram carregados para o Storage são reconstruídos
// a partir da seed por quem os mostra.
export function getAvatarUrl(user) {
  return user?.user_metadata?.avatar_url || null
}

export function getAvatarSeed(user) {
  return user?.user_metadata?.avatar_seed || null
}
