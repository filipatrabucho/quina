import { useEffect, useMemo, useState } from 'react'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import BotLevelPicker from '../../components/BotLevelPicker.jsx'
import Scoreboard from '../../components/Scoreboard.jsx'
import { recordResultOnce } from '../../lib/social.js'
import { SIZE, SHIPS, TOTAL_CELLS, canPlace, randomFleet, applyShot, botShot, navalOnline, rc } from './navalLogic.js'

const COLS = 'ABCDEFGHIJ'.split('')

// Grelha 10x10 com coordenadas. `cellState(i)` devolve { cls, label }.
function Grid({ cellState, onCell, onHover, disabled, testid }) {
  return (
    <div className="naval-grid" data-testid={testid} onMouseLeave={() => onHover?.(null)}>
      <span className="naval-grid__corner" />
      {COLS.map((c) => <span key={c} className="naval-grid__coord">{c}</span>)}
      {Array.from({ length: SIZE }, (_, r) => (
        <Row key={r} r={r} cellState={cellState} onCell={onCell} onHover={onHover} disabled={disabled} />
      ))}
    </div>
  )
}

function Row({ r, cellState, onCell, onHover, disabled }) {
  return (
    <>
      <span className="naval-grid__coord">{r + 1}</span>
      {Array.from({ length: SIZE }, (_, c) => {
        const i = r * SIZE + c
        const st = cellState(i)
        return (
          <button
            key={i}
            className={`naval-cell ${st.cls || ''}`}
            onClick={() => onCell?.(i)}
            onMouseEnter={() => onHover?.(i)}
            disabled={disabled || st.disabled}
            aria-label={`${COLS[c]}${r + 1}${st.label ? `: ${st.label}` : ''}`}
            data-cell={i}
          />
        )
      })}
    </>
  )
}

// Fase de posicionar os navios.
function Placement({ onReady, waiting }) {
  const [fleet, setFleet] = useState([])
  const [horizontal, setHorizontal] = useState(true)
  const [hover, setHover] = useState(null)
  const nextShip = SHIPS.find((s) => !fleet.some((f) => f.key === s.key))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'r' || e.key === 'R') setHorizontal((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const preview = useMemo(() => {
    if (hover == null || !nextShip) return null
    const cells = canPlace(fleet, nextShip.size, hover, horizontal)
    return { cells: cells || [], ok: !!cells }
  }, [hover, nextShip, fleet, horizontal])

  const owner = (i) => fleet.find((s) => s.cells.includes(i))
  const cellState = (i) => {
    if (owner(i)) return { cls: 'naval-cell--ship', label: 'navio' }
    if (preview && preview.cells.includes(i)) return { cls: preview.ok ? 'naval-cell--preview' : 'naval-cell--bad' }
    return {}
  }
  const click = (i) => {
    const o = owner(i)
    if (o) return setFleet((f) => f.filter((s) => s !== o)) // apanha o navio de volta
    if (!nextShip) return
    const cells = canPlace(fleet, nextShip.size, i, horizontal)
    if (cells) setFleet((f) => [...f, { key: nextShip.key, cells }])
  }

  return (
    <div className="naval-placement">
      <p className="game-status">
        {nextShip ? `Coloca o ${nextShip.name} (${nextShip.size} casas)` : 'Frota pronta!'}
      </p>
      <div className="naval-fleet-list">
        {SHIPS.map((s) => (
          <span key={s.key} className={`naval-fleet-item${fleet.some((f) => f.key === s.key) ? ' naval-fleet-item--done' : ''}${nextShip?.key === s.key ? ' naval-fleet-item--current' : ''}`}>
            {s.name} <i>{'■'.repeat(s.size)}</i>
          </span>
        ))}
      </div>
      <Grid cellState={cellState} onCell={click} onHover={setHover} testid="naval-placement" />
      <p className="modal-note">Toca numa casa para pôr o navio. Toca num navio para o tirar. Os navios não se podem tocar.</p>
      <div className="game-actions">
        <button className="mode-btn" onClick={() => setHorizontal((h) => !h)}>Rodar ({horizontal ? 'horizontal' : 'vertical'})</button>
        <button className="mode-btn" onClick={() => setFleet(randomFleet())}>Aleatório</button>
        <button className="mode-btn" onClick={() => setFleet([])} disabled={!fleet.length}>Limpar</button>
      </div>
      <button className="share-btn naval-ready" onClick={() => onReady(fleet)} disabled={!!nextShip || waiting}>
        Pronto
      </button>
    </div>
  )
}

// Dois mares lado a lado: o meu (com os tiros do adversário) e o dele (com os meus tiros).
function Battle({ myFleet, myShots, enemyShots, canShoot, onShoot, lastShot }) {
  const enemyMap = new Map(myShots.map((s) => [s.i, s]))
  const sunkCells = new Set(myShots.filter((s) => s.sunkCells).flatMap((s) => s.sunkCells))
  const incoming = new Map(enemyShots.map((s) => [s.i, s]))
  const myShipCells = new Set(myFleet.flatMap((s) => s.cells))

  const enemyState = (i) => {
    const s = enemyMap.get(i)
    if (!s) return { cls: canShoot ? 'naval-cell--target' : '' }
    const last = lastShot && lastShot.i === i ? ' naval-cell--last' : ''
    if (sunkCells.has(i)) return { cls: 'naval-cell--sunk' + last, label: 'afundado', disabled: true }
    return s.hit ? { cls: 'naval-cell--hit' + last, label: 'acerto', disabled: true } : { cls: 'naval-cell--miss' + last, label: 'água', disabled: true }
  }
  const myState = (i) => {
    const s = incoming.get(i)
    const ship = myShipCells.has(i)
    if (s) return { cls: s.hit ? 'naval-cell--ship naval-cell--hit' : 'naval-cell--miss', label: s.hit ? 'atingido' : 'água' }
    return ship ? { cls: 'naval-cell--ship', label: 'navio' } : {}
  }
  const myHits = myShots.filter((s) => s.hit).length
  const enemyHits = enemyShots.filter((s) => s.hit).length
  return (
    <div className="naval-battle">
      <div className="naval-board">
        <h4>Mar inimigo <span>{myHits}/{TOTAL_CELLS}</span></h4>
        <Grid cellState={enemyState} onCell={(i) => canShoot && !enemyMap.has(i) && onShoot(i)} disabled={!canShoot} testid="naval-enemy" />
      </div>
      <div className="naval-board naval-board--mine">
        <h4>A tua frota <span>{TOTAL_CELLS - enemyHits}/{TOTAL_CELLS}</span></h4>
        <Grid cellState={myState} disabled testid="naval-mine" />
      </div>
    </div>
  )
}

function shotText(shot, who) {
  if (!shot) return ''
  const [r, c] = rc(shot.i)
  const pos = `${COLS[c]}${r + 1}`
  if (shot.sunk) return `${who} afundou o ${SHIPS.find((s) => s.key === shot.sunk)?.name} em ${pos}!`
  return shot.hit ? `${who} acertou em ${pos}!` : `${who} acertou na água em ${pos}.`
}

function VsBot() {
  const [level, setLevel] = useState('medio')
  const [game, setGame] = useState(null) // { myFleet, botFleet, myShots, botShots, turn, winner, last }
  const [score, setScore] = useState({ tu: 0, bot: 0 })

  useEffect(() => {
    if (!game || game.winner || game.turn !== 'bot') return undefined
    const t = setTimeout(() => {
      setGame((g) => {
        if (!g || g.winner || g.turn !== 'bot') return g
        const free = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((i) => !g.botShots.some((s) => s.i === i))
        const cell = level === 'facil' && Math.random() < 0.6 ? free[Math.floor(Math.random() * free.length)] : botShot(g.botShots)
        const res = applyShot(g.botShots, g.myFleet, cell)
        const last = { i: cell, hit: res.hit, sunk: res.sunk, by: 'bot' }
        if (res.allSunk) return { ...g, botShots: res.shots, winner: 'bot', last }
        return { ...g, botShots: res.shots, turn: 'tu', last }
      })
    }, 700)
    return () => clearTimeout(t)
  }, [game, level])

  useEffect(() => {
    if (!game?.winner) return
    setScore((s) => ({ ...s, [game.winner]: s[game.winner] + 1 }))
    recordResultOnce(`naval-bot-${Date.now()}`, 'naval', game.winner === 'tu')
  }, [game?.winner]) // eslint-disable-line react-hooks/exhaustive-deps

  const shoot = (cell) => {
    setGame((g) => {
      if (!g || g.winner || g.turn !== 'tu') return g
      const res = applyShot(g.myShots, g.botFleet, cell)
      const last = { i: cell, hit: res.hit, sunk: res.sunk, by: 'tu' }
      if (res.allSunk) return { ...g, myShots: res.shots, winner: 'tu', last }
      return { ...g, myShots: res.shots, turn: 'bot', last }
    })
  }

  return (
    <div className="game-panel game-panel--wide naval">
      <BotLevelPicker value={level} onChange={setLevel} />
      <Scoreboard
        sides={[
          { name: 'Tu', score: score.tu, active: game && !game.winner && game.turn === 'tu' },
          { name: 'Bot', seed: 'bot-naval', score: score.bot, active: game && !game.winner && game.turn === 'bot' },
        ]}
      />
      {!game ? (
        <Placement onReady={(fleet) => setGame({ myFleet: fleet, botFleet: randomFleet(), myShots: [], botShots: [], turn: 'tu', winner: null, last: null })} />
      ) : (
        <>
          <p className="game-status" data-testid="naval-status">
            {game.winner
              ? game.winner === 'tu' ? 'Ganhaste! Afundaste a frota toda.' : 'O bot afundou a tua frota.'
              : game.turn === 'tu' ? 'É a tua vez: escolhe onde disparar.' : 'O bot está a apontar…'}
          </p>
          {game.last && <p className="naval-log">{shotText(game.last, game.last.by === 'tu' ? 'Tu' : 'O bot')}</p>}
          <Battle myFleet={game.myFleet} myShots={game.myShots} enemyShots={game.botShots} canShoot={!game.winner && game.turn === 'tu'} onShoot={shoot} lastShot={game.last} />
          {game.winner && <button className="share-btn" onClick={() => setGame(null)}>Jogar outra vez</button>}
        </>
      )}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const seated = game.ids.includes(me.id)
  const other = game.ids.find((id) => id !== me.id)
  const player = (id) => state.players.find((p) => p.id === id)

  useEffect(() => {
    if (game.phase === 'fim' && seated) recordResultOnce(`naval-${state.code}-${game.round}`, 'naval', game.winner === me.id)
  }, [game.phase, game.round]) // eslint-disable-line react-hooks/exhaustive-deps

  const sides = game.ids.map((id) => {
    const p = player(id)
    return { name: `${p?.name ?? '?'}${p && !isOnline(id) ? ' · offline' : ''}`, avatar: p?.avatar, seed: p?.seed, score: game.score[id], active: game.phase === 'jogar' && game.turn === id }
  })

  if (!seated) {
    return (
      <div className="game-panel game-panel--wide naval">
        <Scoreboard sides={sides} />
        <p className="game-status">Estás a ver como espectador.</p>
      </div>
    )
  }

  if (game.phase === 'colocar') {
    const mine = game.fleets[me.id]
    return (
      <div className="game-panel game-panel--wide naval">
        <Scoreboard sides={sides} />
        {mine ? (
          <>
            <p className="game-status">Frota pronta. À espera de {player(other)?.name}…</p>
            <button className="mode-btn" onClick={() => dispatch({ type: 'unready' })}>Mudar os navios</button>
          </>
        ) : (
          <Placement onReady={(fleet) => dispatch({ type: 'fleet', fleet })} />
        )}
      </div>
    )
  }

  const myTurn = game.phase === 'jogar' && game.turn === me.id
  return (
    <div className="game-panel game-panel--wide naval">
      <Scoreboard sides={sides} />
      <p className="game-status" data-testid="naval-status">
        {game.phase === 'fim'
          ? game.winner === me.id ? 'Ganhaste! Afundaste a frota toda.' : `${player(game.winner)?.name} afundou a tua frota.`
          : myTurn ? 'É a tua vez: escolhe onde disparar.' : `Vez de ${player(game.turn)?.name}…`}
      </p>
      {game.lastShot && <p className="naval-log">{shotText(game.lastShot, game.lastShot.by === me.id ? 'Tu' : player(game.lastShot.by)?.name)}</p>}
      <Battle
        myFleet={game.fleets[me.id]}
        myShots={game.shots[me.id]}
        enemyShots={game.shots[other]}
        canShoot={myTurn}
        onShoot={(cell) => dispatch({ type: 'shoot', cell })}
        lastShot={game.lastShot}
      />
      {game.phase === 'fim' && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Desforra</button>}
    </div>
  )
}

const HELP = (
  <>
    <p>Posiciona os teus 5 navios na grelha (podes usar "Aleatório"). Os navios não se podem tocar.</p>
    <p>Depois, à vez, escolhe uma casa do mar inimigo para disparar. Ganha quem afundar primeiro todos os navios do adversário.</p>
    <p className="modal-note">Porta-aviões (5), Couraçado (4), Cruzador (3), Submarino (3) e Contratorpedeiro (2).</p>
  </>
)

export default function NavalGame() {
  return (
    <GameShell
      game="naval"
      title="Batalha Naval"
      help={HELP}
      modes={[
        { key: 'bot', label: 'vs Bot' },
        { key: 'online', label: 'Multiplayer' },
      ]}
    >
      {(mode) => (mode === 'bot' ? <VsBot /> : <OnlineGame game="naval" logic={navalOnline} renderGame={(props) => <OnlineBoard {...props} />} />)}
    </GameShell>
  )
}
