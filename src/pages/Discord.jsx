import { Link } from 'react-router-dom'
import { gameByKey } from '../data/games.js'
import { useSocial } from '../social/SocialContext.jsx'
import GameIcon from '../components/GameIcon.jsx'
import { PARTY_GAMES, TABLE_GAMES, DISCORD_STEPS, DISCORD_FAQ } from '../data/discordPage.js'

const playersLabel = (p) => `${p.replace(' a ', '–')} jogadores`

function GameRow({ keys }) {
  const s = useSocial()
  const games = keys.map(gameByKey).filter((g) => g && (!g.beta || s?.canSeeBeta))
  return (
    <div className="dc-games">
      {games.map((g) => (
        <div key={g.key} className="dc-game">
          <GameIcon game={g.key} size={44} />
          <div className="dc-game__text">
            <b>{g.title}</b>
            <small>{playersLabel(g.players)}</small>
            <p>{g.description}</p>
          </div>
          <Link to={`${g.to}?modo=online`} className="btn btn--primary btn--small" data-testid={`dc-room-${g.key}`}>Criar sala</Link>
        </div>
      ))}
    </div>
  )
}

export default function Discord() {
  return (
    <main className="info-page dc">
      <span className="eyebrow">Para jogar em chamada</span>
      <h1>Jogos para jogar no Discord com amigos</h1>
      <p className="info-page__lead">
        Estão numa chamada no Discord e não sabem o que fazer? Abre um mini-jogo no Tuga Games, cola o link da sala no chat e joguem todos ao mesmo
        tempo, enquanto falam. É grátis, em português e não precisa de instalar nada nem de adicionar bots ao servidor.
      </p>

      <ol className="dc-steps">
        {DISCORD_STEPS.map(([t, d], i) => (
          <li key={t}>
            <span className="dc-steps__n">{i + 1}</span>
            <b>{t}</b>
            <small>{d}</small>
          </li>
        ))}
      </ol>

      <h2>Jogos de festa para a chamada</h2>
      <p>Para rir em grupo: adivinhar filmes por emojis, legendar memes, inventar finais de frases e descobrir quem está a mentir.</p>
      <GameRow keys={PARTY_GAMES} />

      <h2>Cartas e tabuleiro com o grupo</h2>
      <p>Os clássicos de sempre, para 2 a 4 (ou mais): Sueca, Bisca, Dominó, Xadrez e companhia. Os lugares vazios podem ficar com bots.</p>
      <GameRow keys={TABLE_GAMES} />

      <h2>Perguntas frequentes</h2>
      <div className="dc-faq">
        {DISCORD_FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <p className="dc-solo">
        Sozinho agora? Joga uma <Link to="/sueca?modo=bot&jogar=1">Sueca contra bots</Link> ou o <Link to="/emoji-do-dia">Emoji do Dia</Link>.
      </p>
    </main>
  )
}
