// Títulos e descrições para o Google e para as partilhas (usado no site e no
// script que gera as páginas estáticas no build).
import { GAMES } from './games.js'

export const SITE_URL = 'https://tugagames.pt'
export const SITE_NAME = 'Tuga Games PT'
export const DEFAULT_TITLE = 'Tuga Games PT | Jogos online grátis em português'
export const DEFAULT_DESCRIPTION =
  'Jogos online grátis em português de Portugal: Palavras, Xadrez, 4 em Linha, Jogo do Galo, Batalha Naval, Stop, Jogo dos Memes e muito mais. Sozinho, contra o bot ou com amigos, sem instalar nada.'

const EXTRA = {
  '/conta': { title: `Entrar ou criar conta | ${SITE_NAME}`, description: 'Cria a tua conta no Tuga Games PT para guardares o teu nome, avatar, amigos, medalhas e estatísticas.', noindex: true },
}

export function seoFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { path, title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }
  const game = GAMES.find((g) => g.to === path)
  if (game) {
    const modes = [game.tags.includes('online') && 'com amigos online', game.tags.includes('bot') && 'contra o computador', game.tags.includes('solo') && 'sozinho']
      .filter(Boolean)
      .join(', ')
    return {
      path,
      game,
      title: `${game.title} online grátis | ${SITE_NAME}`,
      description: `Joga ${game.title} online grátis${modes ? `, ${modes}` : ''}. ${game.description}`.slice(0, 300),
      noindex: !!game.beta,
    }
  }
  if (path.startsWith('/u/')) return { path, title: `Perfil de ${decodeURIComponent(path.slice(3))} | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noindex: true }
  return { path, ...(EXTRA[path] || { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }) }
}

export const PUBLIC_PATHS = ['/', ...GAMES.filter((g) => !g.beta).map((g) => g.to)]
