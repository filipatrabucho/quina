// Catálogo dos jogos (usado no início, no menu e nos cabeçalhos).
export const GAMES = [
  {
    key: 'memes',
    to: '/memes',
    title: 'Jogo dos Memes',
    short: 'Memes',
    description: 'Cria o meme mais engraçado e vota nos dos amigos. Rondas rápidas, 2 a 8 jogadores.',
    tags: ['online'],
    players: '2 a 8',
    badge: 'Novo',
  },
  {
    key: 'xadrez',
    to: '/xadrez',
    title: 'Xadrez',
    short: 'Xadrez',
    description: 'Partidas clássicas contra o bot (3 níveis) ou contra amigos, online.',
    tags: ['online', 'bot'],
    players: '1 a 2',
    badge: 'Novo',
  },
  {
    key: 'quatro',
    to: '/quatro-em-linha',
    title: '4 em Linha',
    short: '4 em Linha',
    description: 'Deixa cair as peças e junta quatro seguidas antes do adversário.',
    tags: ['online', 'bot'],
    players: '1 a 2',
    badge: 'Novo',
  },
  {
    key: 'galo',
    to: '/galo',
    title: 'Jogo do Galo',
    short: 'Galo',
    description: 'O clássico três em linha. Contra o bot imbatível ou contra um amigo.',
    tags: ['online', 'bot'],
    players: '1 a 2',
  },
  {
    key: 'palavras',
    to: '/palavras',
    title: 'Palavras',
    short: 'Palavras',
    description: 'Adivinha a palavra do dia em 6 tentativas. Também com Dueto, Quarteto e 1vs1.',
    tags: ['diario', 'online'],
    players: '1 a 2',
  },
  {
    key: 'fiada',
    to: '/fiada',
    title: 'Fiada',
    short: 'Fiada',
    description: 'Organiza os azulejos numerados por ordem crescente antes dos adversários.',
    tags: ['diario', 'online'],
    players: '1 a 5',
    badge: 'Beta',
  },
]

export const TAG_LABELS = { online: 'Multiplayer', bot: 'vs Bot', diario: 'Diário' }

export const gameByKey = (key) => GAMES.find((g) => g.key === key)
