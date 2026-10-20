import { useEffect, useMemo, useState } from 'react'
import { gameBreak } from '../../lib/ads.js'
import GameShell from '../../components/GameShell.jsx'
import OnlineGame from '../../components/rooms/OnlineGame.jsx'
import Avatar from '../../components/Avatar.jsx'
import { recordResultOnce } from '../../lib/social.js'
import ColonosBoard, { PLAYER_COLORS } from './ColonosBoard.jsx'
import {
  RES, RES_NAME, COSTS, DEV_NAME, PIECES, WIN_POINTS, applyAction, currentPlayer, handSize, points, legalSettlements, legalRoads,
  legalCities, robberVictims, portRates, bank, countPieces, pendingActors, startGame, rematch, colonosOnline,
} from './colonosLogic.js'
import { botAction } from './colonosBot.js'
import { HEXES } from './board.js'
import { ResourceCard, ResIcon, DevCard, DicePair, Die } from './Cards.jsx'

const hasCards = (hand, cost) => RES.every((r) => (hand[r] || 0) >= (cost[r] || 0))
const BUILD_LABEL = { estrada: 'Estrada', aldeia: 'Aldeia', cidade: 'Cidade', desenvolvimento: 'Carta' }

// Ícone de recurso com número (custos, trocas, ganhos).
function ResChip({ res, n }) {
  return <ResIcon res={res} n={n === '' ? undefined : n} />
}

function Cost({ cost }) {
  return (
    <span className="col-cost">
      {RES.filter((r) => cost[r]).map((r) => <ResIcon key={r} res={r} n={cost[r] > 1 ? cost[r] : undefined} />)}
    </span>
  )
}

const Gains = ({ gains }) =>
  gains && Object.keys(gains).length ? (
    <span className="col-gains">{RES.filter((r) => gains[r]).map((r) => <ResIcon key={r} res={r} n={`+${gains[r]}`} />)}</span>
  ) : null

function Stepper({ value, onChange, max = 19 }) {
  return (
    <span className="col-stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Menos">−</button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Mais">+</button>
    </span>
  )
}

function CardPicker({ title, hand, count, onConfirm, confirmLabel }) {
  const [pick, setPick] = useState(Object.fromEntries(RES.map((r) => [r, 0])))
  const total = handSize(pick)
  return (
    <div className="col-modal" role="dialog" aria-label={title}>
      <p><strong>{title}</strong></p>
      {RES.map((r) => (
        <div key={r} className="col-trade-row">
          <ResChip res={r} n={hand ? hand[r] : ''} />
          <span className="col-trade-row__name">{RES_NAME[r]}</span>
          <Stepper value={pick[r]} max={hand ? hand[r] : count} onChange={(v) => setPick((p) => ({ ...p, [r]: v }))} />
        </div>
      ))}
      <button className="share-btn" disabled={total !== count} onClick={() => onConfirm(pick)} data-testid="col-pick-ok">
        {confirmLabel} ({total}/{count})
      </button>
    </div>
  )
}

function TradePanel({ game, meId, onAction, people, onClose }) {
  const [give, setGive] = useState(Object.fromEntries(RES.map((r) => [r, 0])))
  const [want, setWant] = useState(Object.fromEntries(RES.map((r) => [r, 0])))
  const hand = game.hands[meId]
  const rates = portRates(game, meId)
  const giveRes = RES.filter((r) => give[r])
  const wantRes = RES.filter((r) => want[r])
  const bankOk = giveRes.length === 1 && wantRes.length === 1 && give[giveRes[0]] === rates[giveRes[0]] && want[wantRes[0]] === 1 && bank(game)[wantRes[0]] > 0
  const offer = game.offer
  const name = (id) => people(id)?.name || 'Jogador'

  if (offer) {
    const accepted = game.order.filter((id) => offer.responses[id] === 'aceita')
    return (
      <div className="col-trade">
        <p className="col-trade__title">A tua proposta</p>
        <p className="col-offer">Dás {RES.filter((r) => offer.give[r]).map((r) => <ResChip key={r} res={r} n={offer.give[r]} />)} e queres {RES.filter((r) => offer.want[r]).map((r) => <ResChip key={r} res={r} n={offer.want[r]} />)}</p>
        <ul className="col-responses">
          {game.order.filter((id) => id !== meId).map((id) => (
            <li key={id}>
              {name(id)}: <b className={`col-resp col-resp--${offer.responses[id] || 'espera'}`}>{offer.responses[id] === 'aceita' ? 'aceita' : offer.responses[id] === 'recusa' ? 'recusa' : 'a pensar…'}</b>
              {offer.responses[id] === 'aceita' && <button className="btn btn--primary btn--small" onClick={() => onAction({ type: 'confirmTrade', with: id })} data-testid={`col-confirm-${id}`}>Trocar</button>}
            </li>
          ))}
        </ul>
        {!accepted.length && <p className="modal-note">À espera de respostas…</p>}
        <button className="link-btn" onClick={() => onAction({ type: 'cancelOffer' })}>Cancelar proposta</button>
      </div>
    )
  }

  return (
    <div className="col-trade">
      <div className="col-trade__head">
        <p className="col-trade__title">Trocar</p>
        <button className="link-btn" onClick={onClose}>Fechar</button>
      </div>
      <div className="col-trade-grid">
        <span />
        <small>Dou</small>
        <small>Quero</small>
        {RES.map((r) => (
          <div key={r} className="col-trade-grid__row">
            <span className="col-trade-row__res"><ResChip res={r} n={hand[r]} /> {RES_NAME[r]} <em>{rates[r]}:1</em></span>
            <Stepper value={give[r]} max={hand[r]} onChange={(v) => { setGive((g) => ({ ...g, [r]: v })); if (v) setWant((w) => ({ ...w, [r]: 0 })) }} />
            <Stepper value={want[r]} onChange={(v) => { setWant((w) => ({ ...w, [r]: v })); if (v) setGive((g) => ({ ...g, [r]: 0 })) }} />
          </div>
        ))}
      </div>
      <div className="col-trade__actions">
        <button className="btn btn--outline btn--small" disabled={!bankOk} onClick={() => onAction({ type: 'bank', give: giveRes[0], get: wantRes[0] })} data-testid="col-bank">
          Trocar com o banco
        </button>
        <button className="btn btn--primary btn--small" disabled={!giveRes.length || !wantRes.length} onClick={() => onAction({ type: 'offer', give, want })} data-testid="col-offer">
          Propor aos jogadores
        </button>
      </div>
      <p className="modal-note">Banco: dás 4 iguais por 1 (ou 3:1 e 2:1 com portos). Aos jogadores podes propor o que quiseres.</p>
    </div>
  )
}

function DevCards({ game, meId, onAction, canPlay }) {
  const [choosing, setChoosing] = useState(null)
  const cards = game.devHands[meId] || []
  const groups = {}
  for (const c of cards) (groups[c.type] ||= []).push(c)
  if (!cards.length) return <p className="modal-note">Ainda não tens cartas de desenvolvimento.</p>
  return (
    <div className="col-devs">
      {Object.entries(groups).map(([type, list]) => {
        const ready = list.some((c) => c.turn < game.turnNo)
        const playable = type !== 'ponto' && ready && canPlay && (game.phase === 'main' || (game.phase === 'roll' && type === 'cavaleiro'))
        return (
          <DevCard key={type} type={type} count={list.length} disabled={type !== 'ponto' && !playable}>
            {type === 'ponto' ? (
              <small className="dcard__note">Ponto escondido</small>
            ) : (
              <button
                className="dcard__play"
                disabled={!playable}
                title={!ready ? 'Comprada nesta vez: só a podes jogar na próxima' : undefined}
                onClick={() => (type === 'fartura' || type === 'monopolio' ? setChoosing(type) : onAction({ type: 'playDev', card: type }))}
                data-testid={`col-dev-${type}`}
              >
                {ready ? 'Jogar' : 'Na próxima vez'}
              </button>
            )}
          </DevCard>
        )
      })}
      {choosing === 'monopolio' && (
        <div className="col-modal" role="dialog">
          <p><strong>Monopólio: que recurso queres levar a todos?</strong></p>
          <div className="col-respick">
            {RES.map((r) => (
              <button key={r} className="mode-btn" onClick={() => { onAction({ type: 'playDev', card: 'monopolio', res: r }); setChoosing(null) }}>
                <ResIcon res={r} /> {RES_NAME[r]}
              </button>
            ))}
          </div>
          <button className="link-btn" onClick={() => setChoosing(null)}>Cancelar</button>
        </div>
      )}
      {choosing === 'fartura' && (
        <div className="col-overlay">
          <CardPicker
            title="Ano de fartura: escolhe 2 cartas do banco"
            count={2}
            confirmLabel="Receber"
            onConfirm={(pick) => {
              const list = RES.flatMap((r) => Array(pick[r]).fill(r))
              onAction({ type: 'playDev', card: 'fartura', res: list[0], res2: list[1] })
              setChoosing(null)
            }}
          />
          <button className="link-btn" onClick={() => setChoosing(null)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

const EVENT_ICON = { sete: '🎲', ladrao: '🦹', premio: '🏆', cavaleiro: '🛡️', estradas: '🛤️', fartura: '🌾', monopolio: '💰' }

// Aviso grande em cima do mapa: 7, ladrão, cartas de desenvolvimento e prémios.
function EventBanner({ game, meId, name, colorOf }) {
  const ev = game.event
  const [shown, setShown] = useState(null)
  const firstSeq = useState(() => ev?.seq || 0)[0]
  useEffect(() => {
    if (!ev || ev.seq <= firstSeq) return undefined
    setShown(ev)
    const t = setTimeout(() => setShown((cur) => (cur?.seq === ev.seq ? null : cur)), 4000)
    return () => clearTimeout(t)
  }, [ev?.seq]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null
  const who = shown.by === meId ? 'Tu' : name(shown.by)
  const me = shown.by === meId
  let title = ''
  let sub = ''
  let icon = EVENT_ICON[shown.kind]
  if (shown.kind === 'sete') {
    title = `${who} ${me ? 'tiraste' : 'tirou'} um 7!`
    sub = 'Quem tem mais de 7 cartas descarta metade e o ladrão vai mexer-se.'
  } else if (shown.kind === 'ladrao') {
    title = `${who} ${me ? 'moveste' : 'moveu'} o ladrão`
    sub = !shown.victim
      ? 'Esse terreno deixa de produzir.'
      : me
        ? `e roubaste uma carta a ${name(shown.victim)}`
        : shown.victim === meId
          ? 'e roubou-te uma carta!'
          : `e roubou uma carta a ${name(shown.victim)}`
  } else if (shown.kind === 'dev') {
    icon = EVENT_ICON[shown.card]
    title = `${who} ${me ? 'jogaste' : 'jogou'} ${DEV_NAME[shown.card]}`
    if (shown.card === 'cavaleiro') sub = 'Vai mover o ladrão e roubar uma carta.'
    if (shown.card === 'estradas') sub = 'Constrói 2 estradas grátis.'
    const took = me ? 'Levaste' : 'Levou'
    if (shown.card === 'fartura') sub = `${took} ${(shown.res || []).map((r) => RES_NAME[r]).join(' e ')} do banco.`
    if (shown.card === 'monopolio') sub = `${took} todas as cartas de ${RES_NAME[shown.res]} (${shown.total}).`
  } else if (shown.kind === 'premio') {
    title = `${who} ${me ? 'ficaste' : 'ficou'} com ${shown.award === 'estrada' ? 'a Estrada mais longa' : 'o Maior exército'}`
    sub = '+2 pontos'
  }
  return (
    <div className={`col-event col-event--${shown.kind}`} role="status" data-testid="col-event" style={{ '--pc': colorOf(shown.by) }} key={shown.seq}>
      <span className="col-event__icon" aria-hidden="true">{icon}</span>
      <span className="col-event__text">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  )
}

export function ColonosTable({ game, meId, people, onAction, isOnline }) {
  const [mode, setMode] = useState(null)
  const [trading, setTrading] = useState(false)
  const [robberHex, setRobberHex] = useState(null)
  const cur = currentPlayer(game)
  const myTurn = cur === meId && !game.winner
  const colorOf = (id) => PLAYER_COLORS[game.order.indexOf(id)] || '#999'
  const name = (id) => (id === meId ? 'Tu' : people(id)?.name || 'Jogador')
  const hand = game.hands[meId]
  const seated = game.order.includes(meId)

  // Aviso quando perco cartas sem ser por troca (ladrão, Monopólio). Fica
  // visível uns segundos e não aparece outra vez ao voltar à página.
  const lossSeq = game.losses?.seq || 0
  const [shownSeq, setShownSeq] = useState(lossSeq)
  const [recentLoss, setRecentLoss] = useState(false)
  useEffect(() => {
    if (lossSeq <= shownSeq) return undefined
    setShownSeq(lossSeq)
    const L = game.losses
    if (!L?.cards?.[meId] && L?.by !== meId) return undefined
    setRecentLoss(true)
    const t = setTimeout(() => setRecentLoss(false), 9000)
    return () => clearTimeout(t)
  }, [lossSeq]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMode(null)
    setRobberHex(null)
  }, [game.phase, cur])
  useEffect(() => {
    if (game.offer) setTrading(false)
  }, [game.offer])

  let targets = null
  if (myTurn) {
    if (game.phase === 'setup') targets = game.setup.expect === 'aldeia' ? { vertices: legalSettlements(game, meId, true) } : { edges: legalRoads(game, meId, game.setup.vertex) }
    else if (game.phase === 'robber') targets = { hexes: HEXES.map((_, i) => i).filter((i) => i !== game.board.robber) }
    else if (game.phase === 'estradas') targets = { edges: legalRoads(game, meId) }
    else if (mode === 'estrada') targets = { edges: legalRoads(game, meId) }
    else if (mode === 'aldeia') targets = { vertices: legalSettlements(game, meId) }
    else if (mode === 'cidade') targets = { vertices: legalCities(game, meId) }
  }

  const act = (a) => {
    onAction(a)
    setMode(null)
  }
  const onVertex = (v) => {
    if (game.phase === 'setup') act({ type: 'build', kind: 'aldeia', at: v })
    else act({ type: 'build', kind: mode, at: v })
  }
  const onEdge = (e) => act({ type: 'build', kind: 'estrada', at: e })
  const onHex = (h) => {
    const victims = robberVictims(game, h, meId)
    if (victims.length <= 1) act({ type: 'robber', hex: h, victim: victims[0] })
    else setRobberHex(h)
  }

  const status = (() => {
    if (game.winner) return game.winner === meId ? 'Ganhaste! Chegaste aos 10 pontos.' : `${name(game.winner)} ganhou com ${points(game, game.winner, true)} pontos.`
    if (game.phase === 'discard') {
      if (game.discards[meId]) return `Saiu 7: tens de descartar ${game.discards[meId]} cartas.`
      return 'Saiu 7: à espera que os outros descartem…'
    }
    if (!myTurn) return game.phase === 'setup' ? `${name(cur)} está a colocar ${game.setup.expect === 'aldeia' ? 'uma aldeia' : 'uma estrada'}…` : `Vez de ${name(cur)}…`
    if (game.phase === 'setup') return game.setup.expect === 'aldeia' ? `Coloca a tua ${game.setup.i < game.order.length ? 'primeira' : 'segunda'} aldeia num cruzamento.` : 'Agora uma estrada a sair dessa aldeia.'
    if (game.phase === 'roll') return 'É a tua vez: lança os dados.'
    if (game.phase === 'robber') return 'Move o ladrão para outro terreno.'
    if (game.phase === 'estradas') return `Constrói ${game.freeRoads} ${game.freeRoads === 1 ? 'estrada grátis' : 'estradas grátis'}.`
    if (mode) return `Escolhe onde pôr a ${BUILD_LABEL[mode].toLowerCase()}.`
    return 'Constrói, troca ou termina a tua vez.'
  })()

  const can = (kind) =>
    myTurn && game.phase === 'main' && hasCards(hand, COSTS[kind]) &&
    (kind === 'desenvolvimento' ? game.devDeck.length > 0 : countPieces(game, meId, kind) < PIECES[kind]) &&
    (kind === 'estrada' ? legalRoads(game, meId).length > 0 : kind === 'aldeia' ? legalSettlements(game, meId).length > 0 : kind === 'cidade' ? legalCities(game, meId).length > 0 : true)

  const fmt = (msg) => msg.replace(/@([\w-]+)/g, (_, id) => name(id))
  const lost = recentLoss && game.losses?.cards?.[meId]
  const lostText = (() => {
    const L = game.losses
    if (!recentLoss || !L) return ''
    const list = (cards) => RES.filter((r) => cards?.[r]).map((r) => `${cards[r]} ${RES_NAME[r]}`).join(' e ')
    if (L.kind === 'ladrao') {
      if (L.by === meId) {
        const [victim, cards] = Object.entries(L.cards)[0] || []
        return victim ? `Roubaste ${list(cards)} a ${name(victim)}.` : ''
      }
      return lost ? `Saiu 7: ${name(L.by)} moveu o ladrão e roubou-te ${list(lost)}.` : ''
    }
    if (L.kind === 'monopolio' && lost) return `${name(L.by)} jogou a carta Monopólio e levou-te ${list(lost)}.`
    return ''
  })()
  const offer = game.offer
  const respondable = offer && offer.from !== meId && seated && !game.winner

  return (
    <div className="colonos">
      <div className="colonos__board">
        <DicePair dice={game.dice} rollKey={game.rollNo} total={game.dice ? game.dice[0] + game.dice[1] : 0} />
        <ColonosBoard game={game} colorOf={colorOf} targets={targets} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
        <EventBanner game={game} meId={meId} name={name} colorOf={colorOf} />
        {robberHex != null && (
          <div className="col-modal col-modal--float" role="dialog">
            <p><strong>Roubar a quem?</strong></p>
            {robberVictims(game, robberHex, meId).map((id) => (
              <button key={id} className="mode-btn" onClick={() => { act({ type: 'robber', hex: robberHex, victim: id }); setRobberHex(null) }}>
                {name(id)} ({handSize(game.hands[id])} cartas)
              </button>
            ))}
            <button className="link-btn" onClick={() => setRobberHex(null)}>Cancelar</button>
          </div>
        )}
      </div>

      <aside className="colonos__side">
        {lostText && (
          <div className={`col-alert${lost ? ' col-alert--loss' : ''}`} role="status" data-testid="col-loss">
            <span>{lostText}</span>
            <button type="button" className="col-alert__close" onClick={() => setRecentLoss(false)} aria-label="Fechar">×</button>
          </div>
        )}
        <p className={`col-status${myTurn ? ' col-status--me' : ''}`} data-testid="col-status">{status}</p>

        <div className="col-players">
          {game.order.map((id) => {
            const p = people(id)
            return (
              <div key={id} className={`col-player${id === cur && !game.winner ? ' col-player--turn' : ''}`} style={{ '--pc': colorOf(id) }} data-testid={`col-player-${id}`}>
                <Avatar src={p?.avatar} seed={p?.seed || id} name={p?.name} size={32} />
                <div className="col-player__info">
                  <span className="col-player__name">{name(id)}{isOnline && id !== meId && !isOnline(id) ? ' · offline' : ''}</span>
                  <span className="col-player__stats">
                    <span title="Cartas de recursos na mão" className="col-player__cards"><i className="col-cardback" />{handSize(game.hands[id])}</span>
                    <span title="Cartas de desenvolvimento" className="col-player__cards"><i className="col-cardback col-cardback--dev" />{game.devHands[id].length}</span>
                    <span title="Cavaleiros jogados">{game.knights[id]} cav.</span>
                    <span title="Estrada mais comprida">{game.roadLengths[id]} est.</span>
                  </span>
                  <span className="col-player__badges">
                    {game.awards.estrada === id && <em>Estrada mais longa</em>}
                    {game.awards.exercito === id && <em>Maior exército</em>}
                  </span>
                  <Gains gains={game.gains?.[id]} />
                </div>
                <b className="col-player__vp" title="Pontos">{points(game, id, id === meId || !!game.winner)}</b>
              </div>
            )
          })}
        </div>

        {seated && (
          <div className="col-hand" data-testid="col-hand">
            {RES.map((r) => (
              <ResourceCard key={r} res={r} n={hand[r]} size="lg" dim={!hand[r]} pop={game.gains?.[meId]?.[r] ? game.gains[meId][r] : 0} loss={lost?.[r] || 0} lossKey={lossSeq} />
            ))}
          </div>
        )}

        {myTurn && game.phase === 'roll' && (
          <button className="share-btn col-roll" onClick={() => onAction({ type: 'roll' })} data-testid="col-roll">
            <span className="col-roll__dice" aria-hidden="true"><Die value={5} /><Die value={2} red /></span>
            Lançar dados
          </button>
        )}

        {myTurn && game.phase === 'main' && !trading && !offer && (
          <>
            <div className="col-build">
              {['estrada', 'aldeia', 'cidade'].map((k) => (
                <button
                  key={k}
                  className={`col-build__btn${mode === k ? ' col-build__btn--on' : ''}`}
                  disabled={!can(k)}
                  onClick={() => setMode(mode === k ? null : k)}
                  data-testid={`col-build-${k}`}
                >
                  <span>{BUILD_LABEL[k]}</span>
                  <Cost cost={COSTS[k]} />
                </button>
              ))}
              <button className="col-build__btn" disabled={!can('desenvolvimento')} onClick={() => onAction({ type: 'buyDev' })} data-testid="col-buy-dev">
                <span>Carta de desenv.</span>
                <Cost cost={COSTS.desenvolvimento} />
              </button>
            </div>
            <div className="col-turn-actions">
              <button className="btn btn--outline btn--small" onClick={() => setTrading(true)} data-testid="col-trade">Trocar</button>
              <button className="btn btn--primary btn--small" onClick={() => onAction({ type: 'endTurn' })} data-testid="col-end">Terminar vez</button>
            </div>
          </>
        )}

        {myTurn && game.phase === 'main' && (trading || offer) && (
          <TradePanel game={game} meId={meId} people={people} onAction={onAction} onClose={() => setTrading(false)} />
        )}

        {respondable && (
          <div className="col-trade col-trade--incoming" data-testid="col-incoming">
            <p className="col-trade__title">{name(offer.from)} propõe uma troca</p>
            <p className="col-offer">
              Dá-te {RES.filter((r) => offer.give[r]).map((r) => <ResChip key={r} res={r} n={offer.give[r]} />)} e quer {RES.filter((r) => offer.want[r]).map((r) => <ResChip key={r} res={r} n={offer.want[r]} />)}
            </p>
            {offer.responses[meId] ? (
              <p className="modal-note">Respondeste: {offer.responses[meId]}.</p>
            ) : (
              <div className="col-turn-actions">
                <button className="btn btn--outline btn--small" onClick={() => onAction({ type: 'respond', accept: false })}>Recusar</button>
                <button className="btn btn--primary btn--small" disabled={!hasCards(hand, offer.want)} onClick={() => onAction({ type: 'respond', accept: true })} data-testid="col-accept">Aceitar</button>
              </div>
            )}
          </div>
        )}

        {seated && (
          <details className="col-section" open>
            <summary>Cartas de desenvolvimento ({game.devHands[meId].length})</summary>
            <DevCards game={game} meId={meId} onAction={onAction} canPlay={myTurn && !game.devPlayed} />
          </details>
        )}

        <details className="col-section">
          <summary>Custos</summary>
          <ul className="col-costs">
            {Object.entries(COSTS).map(([k, c]) => (
              <li key={k}><span>{BUILD_LABEL[k] === 'Carta' ? 'Carta de desenvolvimento' : BUILD_LABEL[k]}</span><Cost cost={c} /></li>
            ))}
          </ul>
          <p className="modal-note">Ganha quem chegar a {WIN_POINTS} pontos na sua vez. Aldeia 1, cidade 2, estrada mais longa 2, maior exército 2.</p>
        </details>

        <ol className="col-log" data-testid="col-log">
          {game.log
            .map((l, i) => ({ ...l, key: i }))
            .filter((l) => !l.only || l.only.includes(meId))
            .slice(-10)
            .reverse()
            .map((l) => (
              <li key={l.key} className={l.only ? 'col-log__private' : ''}>
                {l.by && <b style={{ color: colorOf(l.by) }}>{name(l.by)}</b>} {fmt(l.msg)}
                {l.only && <em title="Só tu vês isto"> (só tu vês)</em>}
              </li>
            ))}
        </ol>
      </aside>

      {seated && game.phase === 'discard' && game.discards[meId] > 0 && (
        <div className="col-overlay">
          <CardPicker title={`Descarta ${game.discards[meId]} cartas`} hand={hand} count={game.discards[meId]} confirmLabel="Descartar" onConfirm={(cards) => onAction({ type: 'discard', cards })} />
        </div>
      )}
    </div>
  )
}

const BOT_NAMES = ['Bot Rita', 'Bot Zé', 'Bot Inês']

function VsBots() {
  const [bots, setBots] = useState(3)
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const people = (id) => (id === 'tu' ? { name: 'Tu' } : { name: BOT_NAMES[Number(id.slice(3))], seed: id })

  useEffect(() => {
    if (!game || game.winner) return undefined
    const bot = pendingActors(game).find((id) => id !== 'tu' && botAction(game, id))
    if (!bot) return undefined
    const delay = game.phase === 'setup' ? 450 : game.offer ? 500 : 650
    const t = setTimeout(() => {
      setGame((g) => {
        const a = g && botAction(g, bot)
        if (!a) return g
        try {
          return applyAction(g, bot, a)
        } catch {
          return g.phase === 'main' && currentPlayer(g) === bot ? applyAction(g, bot, { type: 'endTurn' }) : g
        }
      })
    }, delay)
    return () => clearTimeout(t)
  }, [game])

  useEffect(() => {
    if (game?.winner) recordResultOnce(`colonos-bot-${Date.now()}`, 'colonos', game.winner === 'tu')
  }, [game?.winner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return (
      <div className="game-panel">
        <p className="game-status">Contra quantos bots queres jogar?</p>
        <div className="bot-levels">
          {[1, 2, 3].map((n) => (
            <button key={n} className={`mode-btn${bots === n ? ' mode-btn--active' : ''}`} onClick={() => setBots(n)}>{n} {n === 1 ? 'bot' : 'bots'}</button>
          ))}
        </div>
        <button className="share-btn" onClick={() => setGame(startGame(['tu', ...Array.from({ length: bots }, (_, i) => `bot${i}`)]))} data-testid="col-start">Começar</button>
      </div>
    )
  }
  return (
    <div className="game-panel game-panel--full">
      <ColonosTable
        game={game}
        meId="tu"
        people={people}
        onAction={(a) => {
          setError('')
          try {
            setGame(applyAction(game, 'tu', a))
          } catch (e) {
            setError(e.message)
          }
        }}
      />
      {error && <p className="duel-error">{error}</p>}
      {game.winner && (
        <div className="game-actions">
          <button className="share-btn" onClick={() => gameBreak('colonos', () => setGame(rematch(game)))}>Jogar outra vez</button>
          <button className="mode-btn" onClick={() => setGame(null)}>Mudar nº de bots</button>
        </div>
      )}
    </div>
  )
}

function OnlineBoard({ state, game, me, dispatch, isOnline }) {
  const people = (id) => state.players.find((p) => p.id === id)
  const seated = game.order.includes(me.id)
  useEffect(() => {
    if (game.winner && seated) recordResultOnce(`colonos-${state.code}-${game.round}`, 'colonos', game.winner === me.id)
  }, [game.winner, game.round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game-panel game-panel--full">
      <ColonosTable game={game} meId={me.id} people={people} onAction={dispatch} isOnline={isOnline} />
      {game.winner && seated && <button className="share-btn" onClick={() => dispatch({ type: 'rematch' })}>Jogar outra vez</button>}
    </div>
  )
}

const HELP = (
  <>
    <p>Coloniza a ilha: no início cada jogador põe 2 aldeias e 2 estradas (a segunda aldeia já dá recursos).</p>
    <p>Na tua vez lanças os dados: todos os terrenos com esse número dão recursos a quem tem aldeias (1) ou cidades (2) à volta. Com 7 o ladrão mexe-se: quem tem mais de 7 cartas descarta metade, e tu roubas uma carta a alguém.</p>
    <p>Usa os recursos para construir estradas, aldeias, cidades e comprar cartas de desenvolvimento. Troca com o banco (4:1, ou melhor com portos) ou com os outros jogadores.</p>
    <p>Ganha quem chegar aos <strong>10 pontos</strong>. A estrada mais longa (5+) e o maior exército (3+ cavaleiros) valem 2 pontos cada.</p>
  </>
)

export default function ColonosGame() {
  const modes = useMemo(() => [{ key: 'bot', label: 'vs Bots' }, { key: 'online', label: 'Multiplayer' }], [])
  return (
    <GameShell game="colonos" title="Colonos" help={HELP} modes={modes} wide>
      {(mode) => (mode === 'bot' ? <VsBots /> : <OnlineGame game="colonos" logic={colonosOnline} renderGame={(props) => <OnlineBoard {...props} />} />)}
    </GameShell>
  )
}
