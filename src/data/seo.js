// Títulos e descrições para o Google e para as partilhas (usado no site e no
// script que gera as páginas estáticas no build).
import { GAMES } from './games.js'

export const SITE_URL = 'https://tugagames.pt'
export const SITE_NAME = 'Tuga Games PT'
export const DEFAULT_TITLE = 'Tuga Games PT | Jogos online grátis em português'
export const DEFAULT_DESCRIPTION =
  'Jogos online grátis em português de Portugal: Sueca, Palavras, Xadrez, 4 em Linha, Jogo do Galo, Batalha Naval, Stop, Jogo dos Memes e muito mais. Sozinho, contra o bot ou com amigos, sem instalar nada.'

const EXTRA = {
  '/sobre': { title: `Sobre nós | ${SITE_NAME}`, description: 'O Tuga Games PT é um site de mini-jogos online grátis feito em Portugal: jogos de tabuleiro, palavras, cartas e jogos de festa para jogar sozinho ou com amigos, sem instalar nada.' },
  '/contacto': { title: `Contacto | ${SITE_NAME}`, description: 'Fala com a equipa do Tuga Games PT: sugestões de jogos, erros, pedidos sobre a tua conta e parcerias. Email tuga.games.staff@gmail.com.' },
  '/admin': { title: `Backoffice | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noindex: true },
  '/conta': { title: `Entrar ou criar conta | ${SITE_NAME}`, description: 'Cria a tua conta no Tuga Games PT para guardares o teu nome, avatar, amigos, medalhas e estatísticas.', noindex: true },
}

// Títulos com o que as pessoas escrevem no Google (sem o nome do site, que vem a seguir).
const GAME_SEO = {
  emojidia: ['Emoji do Dia: desafio diário de adivinhar filmes pelos emojis', 'Todos os dias, 5 filmes, séries e jogos escondidos em emojis, os mesmos para toda a gente. Joga grátis, sem conta, e partilha o teu resultado com os amigos.'],
  sueca: ['Sueca online grátis: jogo de cartas com amigos ou bots', 'Joga Sueca online grátis em português: 2 contra 2, com trunfo e as regras de sempre. Contra bots, sem conta, ou numa mesa com amigos.'],
  galo: ['Jogo do Galo online grátis (Tic Tac Toe)', null],
  quatro: ['4 em Linha online grátis (Connect 4)', null],
  stop: ['Stop online grátis com amigos (Adedonha)', null],
  naval: ['Batalha Naval online grátis', null],
  xadrez: ['Xadrez online grátis contra o computador ou amigos', null],
  palavras: ['Palavras: jogo de palavras diário em português (tipo Wordle)', null],
  snake: ['Snake online grátis: o jogo da cobra', null],
  memoria: ['Jogo da Memória online grátis', null],
  cartas: ['Cartas Coloridas online grátis (tipo Uno)', null],
  memes: ['Jogo dos Memes online com amigos', null],
  noventa: ['99: jogo de cartas online grátis', null],
  emojis: ['Emoji Battle: adivinha o filme pelos emojis', null],
  verdades: ['2 Verdades 1 Mentira online com amigos', null],
  frase: ['Continua a Frase: jogo de festa online', null],
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
      title: `${GAME_SEO[game.key]?.[0] || `${game.title} online grátis`} | ${SITE_NAME}`,
      description: (GAME_SEO[game.key]?.[1] || `Joga ${game.title} online grátis${modes ? `, ${modes}` : ''}. ${game.description}`).slice(0, 300),
      noindex: !!game.beta,
    }
  }
  if (path.startsWith('/u/')) return { path, title: `Perfil de ${decodeURIComponent(path.slice(3))} | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noindex: true }
  return { path, ...(EXTRA[path] || { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }) }
}

export const publicPaths = () => ['/', ...GAMES.filter((g) => !g.beta).map((g) => g.to), '/sobre', '/contacto']
