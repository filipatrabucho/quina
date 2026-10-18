import { Link } from 'react-router-dom'
import { GAMES } from '../data/games.js'
import GameIcon from '../components/GameIcon.jsx'

export default function Sobre() {
  const games = GAMES.filter((g) => !g.beta)
  return (
    <main className="info-page">
      <span className="eyebrow">Tuga Games PT</span>
      <h1>Sobre nós</h1>
      <p className="info-page__lead">
        O Tuga Games PT é um site de mini-jogos online grátis, feito em Portugal e todo em português de Portugal. A ideia é simples:
        abrir o browser e jogar logo, sozinho, contra o computador ou com os amigos, sem instalar nada e sem precisar de conta.
      </p>

      <h2>O que podes jogar</h2>
      <p>
        Temos clássicos de tabuleiro como o Xadrez, o 4 em Linha, o Jogo do Galo e a Batalha Naval, jogos de palavras como o Palavras
        (uma palavra nova todos os dias) e o Stop, jogos de cartas como o 99 e as Cartas Coloridas, e jogos de festa para jogar em grupo,
        como o Jogo dos Memes, o Continua a Frase, Duas Verdades e Uma Mentira e o Emoji Battle.
      </p>
      <div className="info-games">
        {games.map((g) => (
          <Link key={g.key} to={g.to} className="info-game">
            <GameIcon game={g.key} size={32} />
            <span>{g.title}</span>
          </Link>
        ))}
      </div>

      <h2>Como funciona o multiplayer</h2>
      <p>
        Nos jogos online crias uma sala e envias o link ou o código aos amigos. Não é preciso conta: basta escolheres um nome. Se criares
        conta (com email ou com o Discord) ficas com perfil público, lista de amigos, chat, convites diretos, estatísticas e medalhas.
      </p>

      <h2>Porque é grátis</h2>
      <p>
        O site é mantido com publicidade. Tentamos que os anúncios não atrapalhem o jogo e nunca pedimos pagamentos para jogar. Podes
        ver como tratamos os dados na <a href="/privacidade.html">política de privacidade</a> e as regras de utilização nos{' '}
        <a href="/termos.html">termos</a>.
      </p>

      <h2>Sugestões</h2>
      <p>
        Estamos sempre a acrescentar jogos novos e a melhorar os que já existem. Tens uma ideia, encontraste um erro ou queres propor uma
        parceria? <Link to="/contacto">Fala connosco</Link>.
      </p>
    </main>
  )
}
