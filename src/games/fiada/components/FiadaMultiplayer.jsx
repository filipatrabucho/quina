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
              {p.id === user.id ? 'Tu' : `Jogador ${i + 1}`}
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
      {room.status === 'terminado' ? (
        <>
          <p className="duel-result">
            {room.winner_id === user.id
              ? 'Ganhaste! 🏆'
              : `Ganhou o Jogador ${room.players.findIndex((p) => p.id === room.winner_id) + 1}.`}
          </p>
          <button className="share-btn" onClick={leaveRoom}>Novo jogo</button>
        </>
      ) : (
        <>
          <p className="modal-note">
            {myTurn ? 'É a tua vez!' : `Vez do Jogador ${room.turn_index + 1}…`}
          </p>
          <button className="mode-btn" onClick={leaveRoom}>Sair / Novo jogo</button>
        </>
      )}

      <div className="fiada-multi-boards">
        {room.players.map((p, i) => (
          <div
            key={p.id}
            className={`fiada-player-board${i === room.turn_index && room.status === 'a-jogar' ? ' fiada-player-board--turn' : ''}`}
          >
            <p className="modal-note">
              {p.id === user.id ? 'O teu painel' : `Jogador ${i + 1}`} · {p.moves} jogadas
            </p>
            <div className="fiada-grid fiada-grid--small">
              {p.cells.map((v, ci) => (
                <button
                  key={ci}
                  className={`fiada-cell${v != null ? ' fiada-cell--filled' : ''}`}
                  onClick={() => p.id === user.id && myTurn && pending != null && handlePlace(ci)}
                  disabled={!(p.id === user.id && myTurn && pending != null) || busy}
                >
                  {v ?? ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {room.status === 'a-jogar' && (
        <>
          <div className="fiada-hand">
            <span className="modal-note">
              Na mão{myTurn ? '' : ` (Jogador ${room.turn_index + 1})`}:
            </span>
            <div className={`fiada-tile fiada-tile--pending${pending == null ? ' fiada-tile--empty' : ''}`}>
              {pending ?? '—'}
            </div>
            {pending != null && myTurn && (
              <button className="mode-btn" onClick={handleDiscard} disabled={busy}>
                Descartar
              </button>
            )}
          </div>
          {pending == null && !noDrawOptions && (
            <div className="fiada-drawpile">
              <button className="share-btn" onClick={handleDrawBlind} disabled={busy || !myTurn}>
                Comprar às cegas
              </button>
              <div className="fiada-faceup">
                {room.face_up.map((v, i) => (
                  <button
                    key={i}
                    className="fiada-tile fiada-tile--faceup"
                    onClick={() => handlePickFaceUp(i)}
                    disabled={busy || !myTurn}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pending == null && noDrawOptions && (
            <div className="fiada-drawpile">
              <p className="modal-note">Já não há azulejos disponíveis para comprar.</p>
              {myTurn && (
                <button className="share-btn" onClick={handlePassTurn} disabled={busy}>
                  Passar a vez
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}