// Deploy: supabase functions deploy discord-token-exchange
// Segredos necessários (nunca no frontend!):
//   supabase secrets set DISCORD_CLIENT_ID=xxxx DISCORD_CLIENT_SECRET=xxxx
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()
    if (!code) throw new Error('Falta o parâmetro "code"')

    const clientId = Deno.env.get('DISCORD_CLIENT_ID')
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
    })

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || 'Falha na troca do token com o Discord')
    }

    return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
