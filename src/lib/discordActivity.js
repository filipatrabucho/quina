import { supabase } from './supabaseClient.js'

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID

// O Discord acrescenta "frame_id" ao URL quando a app corre dentro de uma
// Activity (num iframe). Fora do Discord, isto nunca aparece.
export function isInsideDiscordActivity() {
  return new URLSearchParams(window.location.search).has('frame_id')
}

let sdkPromise = null

// Arranca o SDK do Discord, autentica o utilizador, e devolve uma sessão
// Supabase válida (anónima, com a identidade do Discord anexada como
// metadata) — para o resto da app (duelos, RLS) funcionar sem alterações.
export function initDiscordActivity() {
  if (!sdkPromise) {
    sdkPromise = setup()
  }
  return sdkPromise
}

async function setup() {
  const { DiscordSDK, patchUrlMappings } = await import('@discord/embedded-app-sdk')

  // Os pedidos ao Supabase e à nossa Edge Function, feitos de dentro do
  // iframe do Discord, têm de passar pelo proxy do Discord. Os prefixos
  // "/supabase-api" e "/discord-auth" têm de corresponder exatamente aos
  // URL Mappings configurados no Developer Portal (ver passo a passo).
  patchUrlMappings([
    { prefix: '/supabase-api', target: new URL(import.meta.env.VITE_SUPABASE_URL).host },
    {
      prefix: '/discord-auth',
      target: new URL(import.meta.env.VITE_SUPABASE_URL).host + '/functions/v1/discord-token-exchange',
    },
  ])

  const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID)
  await discordSdk.ready()

  const { code } = await discordSdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  })

  const tokenRes = await fetch('/discord-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const { access_token: accessToken, error } = await tokenRes.json()
  if (error) throw new Error(error)

  await discordSdk.commands.authenticate({ access_token: accessToken })

  // Perfil do Discord (id, username, avatar) através da API oficial —
  // permitida diretamente pela CSP das Activities, sem proxy extra.
  const profileRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profile = await profileRes.json()

  // Cria (ou reutiliza) uma sessão Supabase para este dispositivo, e
  // anexa a identidade do Discord como metadata do utilizador.
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    await supabase.auth.signInAnonymously()
  }
  await supabase.auth.updateUser({
    data: {
      discord_id: profile.id,
      discord_username: profile.username,
      discord_avatar: profile.avatar,
      full_name: profile.global_name || profile.username,
    },
  })

  return { discordSdk, instanceId: discordSdk.instanceId, profile }
}