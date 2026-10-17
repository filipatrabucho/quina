export const MAX_LEN = 140
export const DEFAULT_SETTINGS = { rounds: 5, seconds: 45 }
export const VOTE_SECONDS = 40
export const RESULTS_SECONDS = 12
export const POINTS_PER_VOTE = 100
export const ROUND_WINNER_BONUS = 50

export const PROMPTS = [
  'Ontem à noite o meu vizinho bateu à porta e disse',
  'A pior coisa para dizer num primeiro encontro é',
  'O meu chefe apanhou-me a dormir no trabalho e eu expliquei que',
  'Se os gatos pudessem falar, a primeira coisa que diziam era',
  'Fui ao Continente às três da manhã e encontrei',
  'A minha avó descobriu o TikTok e agora',
  'O segredo para ganhar o Euromilhões é',
  'Nunca mais vou a um casamento desde que',
  'O GPS mandou-me virar à direita e eu acabei',
  'A professora pediu para explicar porque não fiz os trabalhos e eu disse',
  'O meu cão olhou para mim com cara de quem',
  'Se eu fosse presidente durante um dia, a primeira lei era',
  'Encontrei um génio da lâmpada mas ele só me deixou pedir',
  'O que ninguém te conta sobre viver sozinho é que',
  'Liguei para o apoio ao cliente e a máquina respondeu',
  'O meu superpoder secreto é',
  'A conversa no grupo da família ficou estranha quando o tio escreveu',
  'Acordei num mundo onde o café era proibido e',
  'O meu colega de casa deixou um bilhete no frigorífico a dizer',
  'Fui a uma entrevista de emprego e quando perguntaram o meu maior defeito eu disse',
  'O pastel de nata perfeito tem de ter',
  'A razão verdadeira para os dinossauros terem desaparecido é',
  'O meu telemóvel caiu na sanita e, quando o tirei,',
  'Na viagem de finalistas aconteceu uma coisa que ninguém pode saber:',
  'O treinador entrou no balneário ao intervalo e gritou',
  'O título da minha autobiografia vai ser',
  'Os extraterrestres chegaram a Portugal e a primeira coisa que fizeram foi',
  'Comprei uma coisa na internet e chegou-me a casa',
  'O meu plano para sobreviver a um apocalipse zombie é',
  'A minha mãe entrou no quarto sem bater e viu-me a',
  'No Natal, o presente mais estranho que recebi foi',
  'Abri a porta do frigorífico e a fruta disse-me',
  'O padeiro olhou para mim e sussurrou',
  'Se a minha vida fosse um filme, a cena mais famosa seria quando',
  'O meu professor de educação física costumava dizer',
  'Perdi uma aposta e agora tenho de',
  'Os pombos da Baixa estão a planear',
  'O verdadeiro motivo para o comboio chegar atrasado é',
  'A minha playlist do ginásio tem uma música que',
  'O robô de cozinha ganhou consciência e decidiu',
]

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function startRound(game, round, now) {
  return {
    ...game,
    phase: 'escrever',
    round,
    prompt: game.prompts[(round - 1) % game.prompts.length],
    answers: {},
    order: [],
    votes: {},
    tally: {},
    roundPoints: {},
    deadline: now + game.settings.seconds * 1000,
  }
}

function toVoting(game, now) {
  const order = shuffle(Object.keys(game.answers).filter((id) => game.answers[id].text.trim()))
  if (order.length === 0) return toResults({ ...game, order }, now)
  return { ...game, phase: 'votar', order, votes: {}, deadline: now + VOTE_SECONDS * 1000 }
}

function toResults(game, now) {
  const tally = {}
  for (const target of Object.values(game.votes)) tally[target] = (tally[target] || 0) + 1
  const top = Math.max(0, ...Object.values(tally))
  const roundPoints = {}
  for (const id of game.playerIds) {
    const v = tally[id] || 0
    roundPoints[id] = v * POINTS_PER_VOTE + (top > 0 && v === top ? ROUND_WINNER_BONUS : 0)
  }
  const scores = { ...game.scores }
  for (const [id, p] of Object.entries(roundPoints)) scores[id] = (scores[id] || 0) + p
  const best = top > 0 ? Object.keys(tally).filter((id) => tally[id] === top) : []
  const hall = [...game.hall, ...best.map((id) => ({ round: game.round, prompt: game.prompt, playerId: id, text: game.answers[id].text }))]
  return { ...game, phase: 'resultados', tally, roundPoints, scores, hall, deadline: now + RESULTS_SECONDS * 1000 }
}

function advance(game, now) {
  if (game.phase === 'escrever') return toVoting(game, now)
  if (game.phase === 'votar') return toResults(game, now)
  if (game.phase === 'resultados') {
    return game.round >= game.settings.rounds ? { ...game, phase: 'final', deadline: null } : startRound(game, game.round + 1, now)
  }
  return game
}

export const fraseOnline = {
  minPlayers: 2,
  maxPlayers: 10,
  tick: true,
  start(players, action, now) {
    const settings = { ...DEFAULT_SETTINGS, ...(action.settings || {}) }
    const ids = players.map((p) => p.id)
    const base = { settings, playerIds: ids, scores: Object.fromEntries(ids.map((id) => [id, 0])), hall: [], prompts: shuffle(PROMPTS) }
    return startRound(base, 1, now)
  },
  reduce(game, action, fromId, { now, isHost }) {
    switch (action.type) {
      case 'submit': {
        if (game.phase !== 'escrever') throw new Error('O tempo para escrever acabou.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        const text = String(action.text ?? '').slice(0, MAX_LEN)
        const answers = { ...game.answers, [fromId]: { text, done: !!action.done && !!text.trim() } }
        const next = { ...game, answers }
        return game.playerIds.every((id) => answers[id]?.done) ? toVoting(next, now) : next
      }
      case 'vote': {
        if (game.phase !== 'votar') throw new Error('A votação já acabou.')
        if (!game.playerIds.includes(fromId)) throw new Error('Não estás a jogar.')
        if (action.target === fromId) throw new Error('Não podes votar na tua frase.')
        if (!game.order.includes(action.target)) throw new Error('Frase inválida.')
        const votes = { ...game.votes, [fromId]: action.target }
        const next = { ...game, votes }
        const voters = game.playerIds.filter((id) => game.order.some((t) => t !== id))
        return voters.every((id) => votes[id]) ? toResults(next, now) : next
      }
      case 'next': {
        if (!isHost) throw new Error('Só o anfitrião pode avançar.')
        return advance(game, now)
      }
      case 'restart': {
        if (!isHost || game.phase !== 'final') return game
        return startRound({ ...game, scores: Object.fromEntries(game.playerIds.map((id) => [id, 0])), hall: [], prompts: shuffle(PROMPTS) }, 1, now)
      }
      case 'tick': {
        if (!game.deadline || now < game.deadline) return game
        return advance(game, now)
      }
      default:
        throw new Error('Ação desconhecida.')
    }
  },
}
