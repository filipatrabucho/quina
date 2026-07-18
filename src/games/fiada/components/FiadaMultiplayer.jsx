import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  createFiadaRoom,
  joinFiadaRoom,
  startFiadaRoom,
  getFiadaRoom,
  fiadaDrawBlind,
  fiadaPickFaceUp,
  fiadaPlace,
  fiadaDiscard,
  fiadaPassTurn,
  subscribeToFiadaRoom,
} from '../lib/fiadaRooms.js'

const STORAGE_KEY = 'quina-fiada-sala-atual'

function tileColorClass(value) {
  if (value == null) return ''
  return ` fiada-cell--c${value % 4}`
}

function playerName(p, i) {
  return p?.name || `Jogador ${i + 1}`
}

function PlayerLabel({ player, index, you }) {
  return (
    <span className={`fiada-player-label${you ? ' fiada-player-label--you' : ''}`}>
      {player?.avatar ? (
        <img src={player.avatar} alt="" className="fiada-player-avatar" />
      ) : (
        <span className="fiada-player-avatar fiada-player-avatar--placeholder" />
      )}
      {you ? 'Tu' : playerName(player, index)}
    </span>
  )
}

export default function FiadaMultiplayer({ onExit }) {
  const { user, loading, signInWithDiscord } = useAuth()
  const [room, setRoom] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(5)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!room) return undefined
    return subscribeToFiadaRoom(room.id, setRoom)
  }, [room?.id])

  useEffect(() => {
    if (room?.id) localStorage.setItem(STORAGE_KEY, room.id)
  }, [room?.id])

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('fiadasala')
    if (!inviteCode) return
    localStorage.setItem('quina-fiada-convite-pendente', inviteCode)
    const url = new URL(window.location.href)
    url.searchParams.delete('fiadasala')
    window.history.replaceState({}, '', url)
  }, [])

  useEffect(() => {
    if (!user || room) return
    if (localStorage.getItem('quina-fiada-convite-pendente')) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    getFiadaRoom(saved)
      .then((r) => {
        const belongs = r.host_id === user.id || r.players.some((p) => p.id === user.id)
        if (belongs) setRoom(r)
        else localStorage.removeItem(STORAGE_KEY)
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
  }, [user, room])

  useEffect(() => {
    if (!user || room) return
    const inviteCode = localStorage.getItem('quina-fiada-convite-pendente')
    if (!inviteCode) return
    localStorage.removeItem('quina-fiada-convite-pendente')
    joinFiadaRoom(inviteCode)
      .then(setRoom)
      .catch((e) => setError(e.message))
  }, [user, room])

  const myIndex = useMemo(() => room?.players?.findIndex((p) => p.id === user?.id) ?? -1, [room, user])
  const isHost = room && user && room.host_id === user.id
  const myTurn = room?.status === 'a-jogar' && room.turn_index === myIndex
  const pending = room?.pending_value
  const noDrawOptions = room && room.draw_index >= room.deck.length && room.face_up.length === 0

  const runAction = async (fn) => {
    setBusy(true)
    setError('')
    try {
      setRoom(await fn())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = () => runAction(() => createFiadaRoom(maxPlayers))
  const handleJoin = () => runAction(() => joinFiadaRoom(joinCode))
  const handleStart = () => runAction(() => startFiadaRoom(room.id))
  const handleDrawBlind = () => runAction(() => fiadaDrawBlind(room.id))
  const handlePickFaceUp = (i) => runAction(() => fiadaPickFaceUp(room.id, i))
  const handlePlace = (i) => runAction(() => fiadaPlace(room.id, i))
  const handleDiscard = () => runAction(() => fiadaDiscard(room.id))
  const handlePassTurn = () => runAction(() => fiadaPassTurn(room.id))

  const handleCopyInvite = async () => {
    const link = `${window.location.origin}${window.location.pathname}?fiadasala=${room.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fiada — Multiplayer', text: 'Vem jogar comigo!', url: link })
        return
      } catch {
        // cancelado, cai para copiar
      }
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const leaveRoom = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRoom(null)
  }

  if (loading) return <div className="duel-panel">A carregar…</div>

  if (!user) {
    return (
      <div className="duel-panel">
        <button className="icon-btn" onClick={onExit} aria-label="Voltar">←</button>
        <h2>Entra com o Discord para jogar em multiplayer</h2>
        <button className="share-btn" onClick={signInWithDiscord}>Entrar com Discord</button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="duel-panel">
        <button className="icon-btn" onClick={onExit} aria-label="Voltar">←</button>
        <div className="fiada-maxplayers">
          <span className="modal-note">Nº de jogadores (2 a 5):</span>
          <div className="fiada-maxplayers__options">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`mode-btn${maxPlayers === n ? ' mode-btn--active' : ''}`}
                onClick={() => setMaxPlayers(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button className="share-btn" onClick={handleCreate} disabled={busy}>Criar sala</button>
        <div className="duel-join">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && joinCode.length === 6 && !busy) handleJoin()
            }}
            placeholder="Código da sala"
            maxLength={6}
          />
          <button className="mode-btn" onClick={handleJoin} disabled={busy || joinCode.length !== 6}>
            Entrar
          </button>
        </div>
        {error && <p className="duel-error">{error}</p>}
      </div>
    )
  }

  if (room.status === 'a-espera') {
    return (
      <div className="duel-panel">
        <p>Partilha este código com os teus adversários:</p>
        <div className="duel-code">{room.code}</div>
        <button className="share-btn" onClick={handleCopyInvite}>
          {copied ? 'Copiado! ✓' : 'Copiar link de convite'}
        </button>
        <p className="modal-note">{room.players.length}/{room.max_players} jogadores na sala</p>
        <div className="fiada-players-list">
          {room.players.map((p, i) => (
            <span key={p.id} className="fiada-player-chip">
              <PlayerLabel player={p} index={i} you={p.id === user.id} />
            </span>
          ))}
        </div>
        {isHost ? (
          <button className="share-btn" onClick={handleStart} disabled={busy || room.players.length < 2}>
            Começar jogo
          </button>
        ) : (
          <p className="modal-note">À espera que o anfitrião comece o jogo…</p>
        )}
        {error && <p className="duel-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="duel-panel fiada-duel">
      {room.status === 'a-jogar' && (
        <div className="fiada-topbar">
          <div className="fiada-topbar__row fiada-topbar__row--title">
            <span className="fiada-topbar__title">Fiada</span>
            <span className={`fiada-turn-indicator${myTurn ? ' fiada-turn-indicator--you' : ''}`}>
              {myTurn ? 'É a tua vez!' : `Vez de ${playerName(room.players[room.turn_index], room.turn_index)}`}
            </span>
          </div>

          <div className="fiada-topbar__hand-row">
            <span className="fiada-topbar__label">
              🀄 Na mão{myTurn ? '' : ` (${playerName(room.players[room.turn_index], room.turn_index)})`}
            </span>
            <div className={`fiada-tile fiada-tile--pending${pending == null ? ' fiada-tile--empty' : ''}`}>
              {pending ?? '—'}
            </div>
            {pending != null && myTurn && (
              <button className="fiada-topbar__discard" onClick={handleDiscard} disabled={busy}>
                Descartar
              </button>
            )}
          </div>

          <div className="fiada-topbar__mesa-row">
            <span className="fiada-topbar__label">🎲 Mesa</span>
            {!noDrawOptions ? (
              <>
                <button className="fiada-topbar__draw" onClick={handleDrawBlind} disabled={busy || pending != null || !myTurn}>
                  Comprar às cegas
                </button>
                <div className="fiada-topbar__faceup-strip">
                  {room.face_up.length === 0 && <span className="fiada-topbar__empty-chip">vazia</span>}
                  {room.face_up.map((v, i) => (
                    <button
                      key={i}
                      className="fiada-tile fiada-tile--faceup"
                      onClick={() => handlePickFaceUp(i)}
                      disabled={busy || pending != null || !myTurn}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="fiada-topbar__empty-chip">sem azulejos</span>
                {pending == null && myTurn && (
                  <button className="fiada-topbar__draw" onClick={handlePassTurn} disabled={busy}>
                    Passar a vez
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {room.status === 'terminado' && (
        <div className="fiada-status-bar fiada-status-bar--won">
          <p className="duel-result">
            {room.winner_id === user.id
              ? 'Ganhaste! 🏆'
              : `Ganhou ${playerName(room.players[room.players.findIndex((p) => p.id === room.winner_id)], room.players.findIndex((p) => p.id === room.winner_id))}.`}
          </p>
          <button className="share-btn" onClick={leaveRoom}>Novo jogo</button>
        </div>
      )}

      {room.status === 'a-jogar' && (
        <button className="mode-btn fiada-leave-btn" onClick={leaveRoom}>Sair / Novo jogo</button>
      )}

    {/*   <div className="fiada-multi-boards">
        {room.players.map((p, i) => (
          <div
            key={p.id}
            className={`fiada-player-board fiada-player-board--c${i % 4}${i === room.turn_index && room.status === 'a-jogar' ? ' fiada-player-board--turn' : ''}`}
          >
            <p className="fiada-player-board__header">
              <PlayerLabel player={p} index={i} you={p.id === user.id} /> · {p.moves} jogadas
            </p>
            <div className="fiada-grid fiada-grid--small">
              {p.cells.map((v, ci) => (
                <button
                  key={ci}
                  className={`fiada-cell${v != null ? ' fiada-cell--filled' + tileColorClass(v) : ''}`}
                  onClick={() => p.id === user.id && myTurn && pending != null && handlePlace(ci)}
                  disabled={!(p.id === user.id && myTurn && pending != null) || busy}
                >
                  {v ?? ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div> */}

      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}