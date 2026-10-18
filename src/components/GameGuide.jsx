import { GUIDES } from '../data/gameGuides.js'

// Texto por baixo de cada jogo: o que é, regras, dicas e perguntas.
export default function GameGuide({ game }) {
  const g = GUIDES[game.key]
  if (!g) return null
  return (
    <section className="game-guide" aria-labelledby="guia-titulo">
      <h2 id="guia-titulo">Como jogar {game.title}</h2>
      <p className="game-guide__intro">{g.intro}</p>
      <div className="game-guide__cols">
        <div>
          <h3>Regras</h3>
          <ul>{g.rules.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        {g.tips?.length > 0 && (
          <div>
            <h3>Dicas</h3>
            <ul>{g.tips.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
      </div>
      {g.faq?.length > 0 && (
        <div className="game-guide__faq">
          <h3>Perguntas frequentes</h3>
          {g.faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
