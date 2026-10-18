import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePlayerIdentity } from '../../lib/rooms/usePlayerIdentity.js'
import { useGameRoom, createRoomState, randomRoomCode, forgetRoom } from '../../lib/rooms/useGameRoom.js'
import InviteFriends from '../../social/InviteFriends.jsx'
import { gameByKey } from '../../data/games.js'
import Avatar from '../Avatar.jsx'
import DiscordButton from '../DiscordButton.jsx'
import { track } from '../../lib/analytics.js'

export function PlayerChip({ player, you, online, extra }) {
  return (
    <span className={`player-chip${you ? ' player-chip--you' : ''}`}>
      <Avatar src={player.avatar} seed={player.seed} name={player.name} size={26} />
      <span className="player-chip__name">{you ? `${player.name} (tu)` : player.name}</span>
      {online === false && <span className="player-chip__offline" title="Desligado">●</span>}
      {extra}
    </span>
  )
}

function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('')
  return (
    <form
      className="duel-panel"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(name)
      }}
    >
      <h2>Como te chamas?</h2>
      <p className="modal-note">Escolhe um nome para jogares online. Não precisas de conta.</p>
      <input
        className="duel-name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="O teu nome"
        maxLength={24}
        autoFocus
      />
      <button className="share-btn" type="submit" disabled={!name.trim()}>
        Continuar
      </button>
      <div className="account-or"><span>ou</span></div>
      <DiscordButton />
      <Link className="link-btn" to={`/conta?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
        Entrar ou criar conta com email
      </Link>
    </form>
  )
}

function InviteBox({ code, gameTitle }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${window.location.pathname}?sala=${code}`
  const copy = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tuga Games', text: 'Vem jogar comigo!', url: link })
        return
      } catch {
        // cancelado, copia
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copia o link:', link)
    }
  }
  return (
    <>
      <p>Partilha este código:</p>
      <div className="duel-code" data-testid="room-code">{code}</div>
      <button className="share-btn" onClick={copy}>
        {copied ? 'Copiado! ✓' : 'Copiar link de convite'}
      </button>
      <InviteFriends title={`${gameTitle}, sala ${code}`} url={link} />
    </>
  )
}

function Room({ game, code, me, logic, renderGame, renderLobbyOptions, prepareStart, onLeave }) {
  const room = useGameRoom({ game, code, me, logic })
  const { state, amHost, online, hostOnline, error, setError, notFound, dispatch } = room
  const [starting, setStarting] = useState(false)

  const start = async () => {
    setStarting(true)
    try {
      const extra = prepareStart ? await prepareStart() : {}
      dispatch({ type: 'start', ...extra })
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  if (!state) {
    return (
      <div className="duel-panel">
        {notFound ? (
          <>
            <p>Não encontrámos a sala <strong>{code}</strong>.</p>
            <p className="modal-note">Confirma o código, ou pede ao anfitrião para ter a página aberta.</p>
          </>
        ) : (
          <p>A entrar na sala {code}…</p>
        )}
        <button className="mode-btn" onClick={onLeave}>Voltar</button>
      </div>
    )
  }

  const isOnline = (id) => online.some((p) => p?.id === id)
  const seated = state.players.some((p) => p.id === me.id)

  if (state.status === 'lobby') {
    const full = state.players.length >= state.maxPlayers
    return (
      <div className="duel-panel room-lobby">
        <InviteBox code={code} gameTitle={gameByKey(game)?.title || 'Jogo'} />
        <p className="modal-note">
          {state.players.length}/{state.maxPlayers} jogadores · mínimo {logic.minPlayers}
        </p>
        <div className="room-players">
          {state.players.map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              you={p.id === me.id}
              online={isOnline(p.id)}
              extra={p.id === state.hostId ? <span title="Anfitrião">👑</span> : null}
            />
          ))}
        </div>
        {!seated && <p className="modal-note">{full ? 'A sala está cheia.' : 'A entrar…'}</p>}
        {renderLobbyOptions?.({ state, amHost, dispatch })}
        {amHost ? (
          <button
            className="share-btn"
            onClick={start}
            disabled={starting || state.players.length < logic.minPlayers}
          >
            Começar jogo
          </button>
        ) : (
          <p className="modal-note">À espera que o anfitrião comece…</p>
        )}
        {!hostOnline && <p className="duel-error">O anfitrião está desligado.</p>}
        {error && <p className="duel-error">{error}</p>}
        <button
          className="link-btn"
          onClick={() => {
            if (!amHost) dispatch({ type: 'leave' })
            onLeave()
          }}
        >
          Sair da sala
        </button>
      </div>
    )
  }

  return (
    <div className="room-playing">
      {!hostOnline && (
        <p className="room-banner">O anfitrião desligou-se. O jogo continua quando ele voltar.</p>
      )}
      {!seated && <p className="room-banner room-banner--info">Estás a ver como espectador.</p>}
      {renderGame({ ...room, state, game: state.game, me, isOnline })}
      {error && <p className="duel-error room-error">{error}</p>}
      <div className="room-footer">
        {amHost && (
          <button className="link-btn" onClick={() => dispatch({ type: 'lobby' })}>
            Voltar ao lobby
          </button>
        )}
        <button className="link-btn" onClick={onLeave}>Sair da sala</button>
      </div>
    </div>
  )
}

export default function OnlineGame({ game, logic, renderGame, renderLobbyOptions, prepareStart }) {
  const { me, needsName, setGuestName, loading } = usePlayerIdentity()
  const [params, setParams] = useSearchParams()
  const code = (params.get('sala') || '').toUpperCase()
  const [joinCode, setJoinCode] = useState('')

  const goTo = (c) => {
    const next = new URLSearchParams(params)
    if (c) next.set('sala', c)
    else next.delete('sala')
    next.set('modo', 'online')
    setParams(next)
  }

  if (loading) return <div className="duel-panel">A carregar…</div>
  if (needsName) return <NamePrompt onSubmit={setGuestName} />

  if (code) {
    return (
      <Room
        key={code}
        game={game}
        code={code}
        me={me}
        logic={logic}
        renderGame={renderGame}
        renderLobbyOptions={renderLobbyOptions}
        prepareStart={prepareStart}
        onLeave={() => goTo(null)}
      />
    )
  }

  const create = () => {
    const c = randomRoomCode()
    forgetRoom(game, c)
    createRoomState(game, c, me, logic)
    track('create_room', { game_name: game })
    goTo(c)
  }

  return (
    <div className="duel-panel">
      <p className="modal-note">
        A jogar como <strong>{me.name}</strong>
      </p>
      <button className="share-btn" onClick={create}>Criar sala</button>
      <form
        className="duel-join"
        onSubmit={(e) => {
          e.preventDefault()
          if (joinCode.trim().length >= 4) goTo(joinCode.trim().toUpperCase())
        }}
      >
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Código"
          maxLength={6}
          aria-label="Código da sala"
        />
        <button className="mode-btn" type="submit" disabled={joinCode.trim().length < 4}>
          Entrar
        </button>
      </form>
    </div>
  )
}
