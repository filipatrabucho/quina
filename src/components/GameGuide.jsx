import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GUIDES } from '../data/gameGuides.js'
import { getTopPlayers } from '../lib/social.js'
import Avatar from './Avatar.jsx'

// Top 3 de quem mais ganhou neste jogo (só contas).
function TopPlayers({ game }) {
  const [top, setTop] = useState(null)
  useEffect(() => {
    let alive = true
    setTop(null)
    getTopPlayers(game.key)
      .then((list) => alive && setTop(list))
      .catch(() => alive && setTop([]))
    return () => {
      alive = false
    }
  }, [game.key])
  if (top === null) return <p className="game-top__empty">A carregar…</p>
  if (!top.length) return <p className="game-top__empty">Ainda ninguém ganhou com conta. Cria conta e sê o primeiro do top!</p>
  return (
    <ol className="game-top" data-testid="game-top">
      {top.map((x, i) => (
        <li key={x.user_id} className={`game-top__row game-top__row--${i + 1}`}>
          <span className="game-top__pos">{i + 1}</span>
          <Avatar src={x.profile.avatar_url} seed={x.profile.id} name={x.profile.username} size={30} />
          <Link to={`/u/${x.profile.username}`} className="game-top__name">{x.profile.username}</Link>
          <span className="game-top__wins"><b>{x.wins}</b> {x.wins === 1 ? 'vitória' : 'vitórias'}</span>
        </li>
      ))}
    </ol>
  )
}

// Coluna do jogo: regras, dicas, perguntas e top 3, em acordeão.
// No PC fica à esquerda do jogo; no telemóvel por baixo.
export default function GameGuide({ game }) {
  const g = GUIDES[game.key]
  return (
    <aside className="game-guide" aria-label={`Sobre o jogo ${game.title}`}>
      <details className="game-guide__item" open>
        <summary>Top 3 jogadores</summary>
        <TopPlayers game={game} />
      </details>
      {g && (
        <>
          <details className="game-guide__item" open>
            <summary>Como jogar {game.title}</summary>
            <p className="game-guide__intro">{g.intro}</p>
            <ul>{g.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
          {g.tips?.length > 0 && (
            <details className="game-guide__item">
              <summary>Dicas</summary>
              <ul>{g.tips.map((r) => <li key={r}>{r}</li>)}</ul>
            </details>
          )}
          {g.faq?.length > 0 && (
            <details className="game-guide__item">
              <summary>Perguntas frequentes</summary>
              {g.faq.map(([q, a]) => (
                <div key={q} className="game-guide__faq">
                  <h3>{q}</h3>
                  <p>{a}</p>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </aside>
  )
}
