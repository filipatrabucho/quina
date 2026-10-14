import { Link } from 'react-router-dom'

const GAMES = [
  {
    to: '/palavras',
    title: 'Palavras',
    description: 'Adivinha a palavra do dia em 6 tentativas. Também com Dueto, Quarteto e 1vs1.',
    accent: 'a',
  },
  {
    to: '/fiada',
    title: 'Fiada',
    description: 'Organiza os teus azulejos numerados por ordem crescente antes do adversário.',
    accent: 'b',
    teste: 'Ainda em testes.',
  },
  {
    to: '/quatro-em-linha',
    title: '4 em Linha',
    description: 'Deixa cair as peças e junta quatro seguidas. Contra o bot ou online.',
    accent: 'a',
  },
  {
    to: '/galo',
    title: 'Jogo do Galo',
    description: 'O clássico três em linha. Contra o bot ou contra um amigo.',
    accent: 'b',
  },
  {
    to: '/xadrez',
    title: 'Xadrez',
    description: 'Partidas de xadrez contra o bot (3 níveis) ou online.',
    accent: 'a',
  },
  {
    to: '/memes',
    title: 'Jogo dos Memes',
    description: 'Cria o meme mais engraçado e vota nos dos amigos. Multiplayer, 2 a 8 jogadores.',
    accent: 'b',
  },
]

export default function Hub() {
  return (
    <main className="hub">
      <p className="hub__intro">Um portal de mini-jogos diários.</p>
      <div className="hub__grid">
        {GAMES.map((game) => (
          <Link key={game.to} to={game.to} className={`hub-card hub-card--${game.accent}`}>
            <h2>{game.title}</h2>
            <p>{game.description}</p>
            {game.teste && <p className="hub-card__teste">{game.teste}</p>}
            <span className="hub-card__cta">Jogar →</span>
          </Link>
        ))}
      </div>
      {import.meta.env.VITE_TIP_URL && (
        <a
          className="tip-link tip-link--footer"
          href={import.meta.env.VITE_TIP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          ☕ Oferece-me um café
        </a>
      )}
    </main>
  )
}