import { Link } from 'react-router-dom'
import { useSocial } from '../social/SocialContext.jsx'
import { gameByKey } from '../data/games.js'
import GameIcon from './GameIcon.jsx'

// Jogos em beta: só o admin e os testers os podem abrir.
export default function BetaGate({ game, children }) {
  const s = useSocial()
  const info = gameByKey(game)
  if (!info?.beta || s?.canSeeBeta) return children
  if (!s?.roleLoaded) return <p className="page-loading">A carregar…</p>
  return (
    <div className="beta-locked" data-testid="beta-locked">
      <GameIcon game={game} size={72} />
      <h2>{info.title} está em testes</h2>
      <p>Este jogo ainda está a ser afinado e, por agora, só os testers o podem jogar. Volta em breve!</p>
      {!s?.enabled && <p className="modal-note">Se és tester, entra com a tua conta.</p>}
      <div className="game-actions">
        <Link className="btn btn--primary btn--small" to="/">Ver os outros jogos</Link>
        {!s?.enabled && <Link className="btn btn--outline btn--small" to={`/conta?voltar=${encodeURIComponent(info.to)}`}>Entrar</Link>}
      </div>
    </div>
  )
}
