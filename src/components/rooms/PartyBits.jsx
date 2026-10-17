import { useEffect, useState } from 'react'
import Avatar from '../Avatar.jsx'
import { ClockIcon } from '../Icons.jsx'

// Peças comuns aos jogos de grupo com rondas (tempo, jogadores, classificação).
export function useCountdown(deadline, serverNow) {
  const [left, setLeft] = useState(() => (deadline ? Math.max(0, deadline - serverNow()) : 0))
  useEffect(() => {
    if (!deadline) return undefined
    const update = () => setLeft(Math.max(0, deadline - serverNow()))
    update()
    const t = setInterval(update, 250)
    return () => clearInterval(t)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps
  return Math.ceil(left / 1000)
}

export function Timer({ deadline, serverNow }) {
  const s = useCountdown(deadline, serverNow)
  if (!deadline) return null
  return (
    <span className={`meme-timer${s <= 10 ? ' meme-timer--hurry' : ''}`} data-testid="party-timer">
      <ClockIcon /> {s}s
    </span>
  )
}

export function PlayerLine({ players, highlight }) {
  return (
    <div className="meme-players">
      {players.map((p) => (
        <span key={p.id} className={`meme-player${highlight(p.id) ? ' meme-player--done' : ''}`} title={p.name}>
          <Avatar src={p.avatar} seed={p.seed} name={p.name} size={26} />
          {highlight(p.id) && <span className="meme-player__check">✓</span>}
        </span>
      ))}
    </div>
  )
}

export function Standings({ state, game, me, plus }) {
  const rows = state.players
    .filter((p) => game.playerIds.includes(p.id))
    .sort((a, b) => (game.scores[b.id] || 0) - (game.scores[a.id] || 0))
  return (
    <ol className="meme-standings" data-testid="party-standings">
      {rows.map((p, i) => (
        <li key={p.id} className={p.id === me.id ? 'meme-standings__me' : ''}>
          <span className="meme-standings__pos">{i + 1}.</span>
          <Avatar src={p.avatar} seed={p.seed} name={p.name} size={24} />
          <span className="meme-standings__name">{p.name}</span>
          {plus && plus[p.id] > 0 && <span className="stop-plus">+{plus[p.id]}</span>}
          <span className="meme-standings__pts">{game.scores[p.id] || 0}</span>
        </li>
      ))}
    </ol>
  )
}

export function winnersOf(state, game) {
  const top = Math.max(...game.playerIds.map((id) => game.scores[id] || 0))
  return { top, winners: state.players.filter((p) => game.playerIds.includes(p.id) && (game.scores[p.id] || 0) === top) }
}

export function SettingSelect({ label, value, options, onChange, format = (v) => v }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}>
        {options.map((o) => <option key={o} value={o}>{format(o)}</option>)}
      </select>
    </label>
  )
}
