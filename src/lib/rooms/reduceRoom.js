export function seatOf(p) {
  return { id: p.id, name: p.name, avatar: p.avatar || null, seed: p.seed || null }
}

// Preferências de cada jogador no lobby (ex.: cor e chapéu): só valores simples e curtos.
function cleanPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return null
  const out = {}
  for (const [k, v] of Object.entries(prefs).slice(0, 6)) {
    if (!/^[a-z]{1,16}$/i.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string' && v.length <= 24) out[k] = v
    else if (v === null) out[k] = null
  }
  return out
}

// Reducer genérico da sala: trata do lobby e passa o resto à lógica do jogo.
// Corre só no anfitrião, é ele que tem o estado "oficial".
export function reduceRoom(state, action, fromId, logic, now = Date.now()) {
  const isHost = fromId === state.hostId
  switch (action.type) {
    case 'join': {
      if (state.players.some((p) => p.id === fromId)) {
        // Atualiza nome/avatar se mudaram.
        return {
          ...state,
          players: state.players.map((p) => (p.id === fromId ? { ...seatOf({ ...action.player, id: fromId }), ...(p.prefs ? { prefs: p.prefs } : {}) } : p)),
        }
      }
      if (state.status !== 'lobby') return state // entra como espectador
      if (state.players.length >= state.maxPlayers) return state
      return { ...state, players: [...state.players, seatOf({ ...action.player, id: fromId })] }
    }
    case 'leave': {
      if (state.status !== 'lobby' || isHost) return state
      return { ...state, players: state.players.filter((p) => p.id !== fromId) }
    }
    case 'prefs': {
      if (state.status !== 'lobby' || !state.players.some((p) => p.id === fromId)) return state
      return { ...state, players: state.players.map((p) => (p.id === fromId ? { ...p, prefs: cleanPrefs(action.prefs) } : p)) }
    }
    case 'kick': {
      if (!isHost || state.status !== 'lobby') return state
      return { ...state, players: state.players.filter((p) => p.id !== action.id || p.id === state.hostId) }
    }
    case 'start': {
      if (!isHost) throw new Error('Só o anfitrião pode começar.')
      if (state.status !== 'lobby') return state
      if (state.players.length < logic.minPlayers) {
        throw new Error(`São precisos pelo menos ${logic.minPlayers} jogadores.`)
      }
      return { ...state, status: 'playing', game: logic.start(state.players, action, now) }
    }
    case 'lobby': {
      // Voltar ao lobby (para mudar jogadores).
      if (!isHost) return state
      return { ...state, status: 'lobby', game: null }
    }
    default: {
      if (state.status !== 'playing') throw new Error('O jogo ainda não começou.')
      if (action.type !== 'tick' && !state.players.some((p) => p.id === fromId)) {
        throw new Error('Estás a ver como espectador.')
      }
      if (action.type === 'tick' && !isHost) return state
      const game = logic.reduce(state.game, action, fromId, { isHost, players: state.players, now })
      return game === state.game ? state : { ...state, game }
    }
  }
}
