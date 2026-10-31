// Títulos e descrições para o Google e para as partilhas (usado no site e no
// script que gera as páginas estáticas no build).
import { GAMES } from './games.js'
import { DISCORD_PATH } from './discordPage.js'

export const SITE_URL = 'https://tugagames.pt'
export const SITE_NAME = 'Tuga Games PT'
export const DEFAULT_TITLE = 'Tuga Games PT | Mini-jogos para jogar com amigos no Discord'
export const DEFAULT_DESCRIPTION =
  'Mini-jogos online grátis para jogar com amigos numa chamada de Discord: cria uma sala, cola o link no chat e joguem todos no browser. Emoji Battle, Stop, Jogo dos Memes, Sueca, Xadrez e muito mais. Também dá para jogar sozinho ou contra bots.'

const EXTRA = {
  [DISCORD_PATH]: {
    title: `Jogos para jogar no Discord com amigos (grátis, no browser) | ${SITE_NAME}`,
    description: 'Jogos para jogar no Discord com amigos durante a chamada: cria uma sala, cola o link no chat e joguem todos no browser, sem instalar nada nem bots no servidor. Emoji Battle, Stop, Jogo dos Memes, Sueca e mais. Grátis e em português.',
  },
  '/sobre': { title: `Sobre nós | ${SITE_NAME}`, description: 'O Tuga Games PT é um site de mini-jogos online grátis feito em Portugal: jogos de tabuleiro, palavras, cartas e jogos de festa para jogar sozinho ou com amigos, sem instalar nada.' },
  '/contacto': { title: `Contacto | ${SITE_NAME}`, description: 'Fala com a equipa do Tuga Games PT: sugestões de jogos, erros, pedidos sobre a tua conta e parcerias. Email tuga.games.staff@gmail.com.' },
  '/admin': { title: `Backoffice | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noindex: true },
  '/conta': { title: `Entrar ou criar conta | ${SITE_NAME}`, description: 'Cria a tua conta no Tuga Games PT para guardares o teu nome, avatar, amigos, medalhas e estatísticas.', noindex: true },
}

// Títulos com o que as pessoas escrevem no Google (sem o nome do site, que vem a seguir).
const GAME_SEO = {
  emojidia: ['Emoji do Dia: desafio diário de adivinhar filmes pelos emojis', 'Todos os dias, 5 filmes, séries e jogos escondidos em emojis, os mesmos para toda a gente. Joga grátis, sem conta, e partilha o teu resultado com os amigos.'],
  bisca: ['Bisca online grátis: jogo de cartas português', 'Joga Bisca online grátis em português: 3 cartas, trunfo virado e troca do 2. Um contra um ou 2 contra 2, contra bots (sem conta) ou com amigos.'],
  spider: ['Spider Solitário online grátis (1, 2 ou 4 naipes)', 'Joga Spider Solitário online grátis em português: 1, 2 ou 4 naipes, desfazer ilimitado e o jogo fica guardado. No computador ou no telemóvel, sem instalar nada.'],
  freecell: ['FreeCell online grátis: o solitário clássico', 'Joga FreeCell online grátis em português, com as distribuições numeradas clássicas, desfazer ilimitado e o jogo guardado. No computador ou no telemóvel, sem instalar nada.'],
  desenho: ['Desenha e Adivinha online grátis: jogo de desenhar com amigos no Discord', 'Joga Desenha e Adivinha online grátis em português: um desenha, os outros adivinham. Até 10 jogadores numa sala, ou num só ecrã a partilhar na chamada de Discord.'],
  bombapalavras: ['Bomba de Palavras: jogo de palavras online com amigos ou bots', 'Joga Bomba de Palavras online grátis em português: escreve uma palavra com a sílaba antes que a bomba rebente. Contra bots, sem conta, ou com amigos no Discord.'],
  impostor: ['O Impostor: jogo de dedução social online com amigos no Discord', 'Joga O Impostor online grátis em português: tripulantes, tarefas e um impostor escondido. De 4 a 10 jogadores, numa chamada de Discord com amigos ou contra bots.'],
  domino: ['Dominó online grátis: joga contra bots ou com amigos', 'Joga Dominó online grátis em português, com as 28 pedras do duplo seis: a 2 ou 3 jogadores com monte, ou a 4 em equipas. Contra bots (sem conta) ou com amigos.'],
  sueca: ['Sueca online grátis: jogo de cartas com amigos ou bots', 'Joga Sueca online grátis em português: 2 contra 2, com trunfo e as regras de sempre. Contra bots, sem conta, ou numa mesa com amigos durante a chamada de Discord.'],
  galo: ['Jogo do Galo online grátis (Tic Tac Toe)', null],
  quatro: ['4 em Linha online grátis (Connect 4)', null],
  stop: ['Stop online grátis com amigos no Discord (Adedonha)', null],
  naval: ['Batalha Naval online grátis', null],
  xadrez: ['Xadrez online grátis contra o computador ou amigos', null],
  palavras: ['Palavras: jogo de palavras diário em português (tipo Wordle)', null],
  snake: ['Snake online grátis: o jogo da cobra', null],
  memoria: ['Jogo da Memória online grátis', null],
  cartas: ['Cartas Coloridas online grátis (tipo Uno)', null],
  memes: ['Jogo dos Memes online com amigos no Discord', null],
  noventa: ['99: jogo de cartas online grátis', null],
  emojis: ['Emoji Battle: adivinha o filme pelos emojis com amigos no Discord', null],
  verdades: ['2 Verdades 1 Mentira online com amigos no Discord', null],
  frase: ['Continua a Frase: jogo de festa para o Discord', null],
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
      description: (GAME_SEO[game.key]?.[1] || `Joga ${game.title} online grátis${modes ? `, ${modes}` : ''}. ${game.tags.includes('online') ? 'Cria uma sala e joga com amigos numa chamada de Discord. ' : ''}${game.description}`).slice(0, 300),
      noindex: !!game.beta,
    }
  }
  if (path.startsWith('/u/')) return { path, title: `Perfil de ${decodeURIComponent(path.slice(3))} | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, noindex: true }
  return { path, ...(EXTRA[path] || { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }) }
}

export const publicPaths = () => ['/', DISCORD_PATH, ...GAMES.filter((g) => !g.beta).map((g) => g.to), '/sobre', '/contacto']
