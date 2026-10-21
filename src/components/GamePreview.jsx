import GameIcon from './GameIcon.jsx'

// Pré-visualizações desenhadas de cada jogo, para as miniaturas da página inicial.
const L = (letters, states) =>
  letters.split('').map((ch, i) => (
    <span key={i} className={`pv-tile pv-tile--${states[i]}`}>{ch}</span>
  ))

export default function GamePreview({ game }) {
  switch (game) {
    case 'palavras':
      return (
        <div className="pv pv-palavras">
          <div className="pv-row">{L('PRAIA', 'xyxxg')}</div>
          <div className="pv-row">{L('TUGAS', 'gyxgx')}</div>
          <div className="pv-row">{L('JOGAR', 'ggggg')}</div>
        </div>
      )
    case 'quatro': {
      const grid = [
        '.......',
        '.......',
        '...y...',
        '..ry...',
        '.yrrr..',
        'yrryyr.',
      ]
      return (
        <div className="pv pv-quatro">
          <div className="pv-q-board">
            {grid.join('').split('').map((c, i) => <span key={i} className={`pv-q-hole pv-q-${c === '.' ? 'e' : c}`} />)}
          </div>
        </div>
      )
    }
    case 'xadrez': {
      const pieces = { 2: '♜', 5: '♚', 9: '♟', 14: '♞', 18: '♙', 21: '♕', 26: '♘', 29: '♔' }
      return (
        <div className="pv pv-xadrez">
          <div className="pv-x-board">
            {Array.from({ length: 32 }, (_, i) => (
              <span key={i} className={(Math.floor(i / 8) + i) % 2 ? 'pv-x-d' : 'pv-x-l'}>{pieces[i] || ''}</span>
            ))}
          </div>
        </div>
      )
    }
    case 'galo':
      return (
        <div className="pv pv-galo">
          <div className="pv-g-board">
            {'XO.OX..OX'.split('').map((c, i) => <span key={i} className={`pv-g-${c === '.' ? 'e' : c.toLowerCase()}`}>{c === '.' ? '' : c}</span>)}
          </div>
        </div>
      )
    case 'naval': {
      const ship = new Set([8, 9, 10, 22, 30, 38])
      const hit = new Set([9, 30])
      const miss = new Set([3, 19, 27, 44])
      return (
        <div className="pv pv-naval">
          <div className="pv-n-board">
            {Array.from({ length: 48 }, (_, i) => (
              <span key={i} className={`${ship.has(i) ? 'pv-n-ship' : ''} ${hit.has(i) ? 'pv-n-hit' : ''} ${miss.has(i) ? 'pv-n-miss' : ''}`} />
            ))}
          </div>
        </div>
      )
    }
    case 'stop':
      return (
        <div className="pv pv-stop">
          <div className="pv-s-paper">
            <div className="pv-s-letter">A</div>
            <p><b>Nome</b> Ana</p>
            <p><b>País</b> Angola</p>
            <p><b>Animal</b> Abelha</p>
            <p><b>Cor</b> Azul</p>
          </div>
        </div>
      )
    case 'emojis':
      return (
        <div className="pv pv-emojis">
          <div className="pv-e-clue">🦁👑🌅</div>
          <div className="pv-e-answer">O Rei <u>    </u></div>
        </div>
      )
    case 'memes':
      return (
        <div className="pv pv-memes">
          <div className="pv-m-card">
            <span className="pv-m-top">quando ganhas</span>
            <span className="pv-m-face">😎</span>
            <span className="pv-m-bot">ao teu primo</span>
          </div>
        </div>
      )
    case 'snake': {
      const body = new Set([25, 26, 27, 28, 36, 44, 52, 53, 54])
      return (
        <div className="pv pv-snake">
          <div className="pv-sn-board">
            {Array.from({ length: 64 }, (_, i) => (
              <span key={i} className={body.has(i) ? (i === 54 ? 'pv-sn-head' : 'pv-sn-body') : i === 14 ? 'pv-sn-apple' : ''} />
            ))}
          </div>
        </div>
      )
    }
    case 'memoria':
      return (
        <div className="pv pv-memoria">
          {['★', '', '♥', '', '', '♥', '', '★'].map((c, i) => (
            <span key={i} className={c ? 'pv-mm-up' : 'pv-mm-down'}>{c}</span>
          ))}
        </div>
      )
    case 'cartas':
      return (
        <div className="pv pv-cartas">
          <span className="pv-c-card pv-c-r">7</span>
          <span className="pv-c-card pv-c-b">+2</span>
          <span className="pv-c-card pv-c-g">3</span>
          <span className="pv-c-card pv-c-y">⟲</span>
        </div>
      )
    case 'noventa':
      return (
        <div className="pv pv-noventa">
          <div className="pv-90-count">87</div>
          <div className="pv-90-cards"><span>K</span><span>9</span><span>4</span></div>
        </div>
      )
    case 'verdades':
      return (
        <div className="pv pv-verdades">
          <p><i>✓</i> Já fui a Marrocos</p>
          <p><i>✗</i> Tenho 3 gatos</p>
          <p><i>✓</i> Sei tocar guitarra</p>
        </div>
      )
    case 'frase':
      return (
        <div className="pv pv-frase">
          <div className="pv-f-bubble">Hoje acordei e…</div>
          <div className="pv-f-bubble pv-f-bubble--me">…o gato estava a pagar a renda 😂</div>
        </div>
      )
    case 'bombas': {
      // mini arena 7×5: # parede, + caixa, B bomba, F chama, 1/2 jogadores
      const map = ['#######', '#1.+F.#', '#.#F#+#', '#+FFFB#', '###F#2#']
      return (
        <div className="pv pv-bombas">
          {map.join('').split('').map((c, i) => (
            <span key={i} className={`pv-b-${{ '#': 'wall', '+': 'crate', B: 'bomb', F: 'fire', 1: 'p1', 2: 'p2' }[c] || 'floor'}`} />
          ))}
        </div>
      )
    }
    case 'blackjack':
      return (
        <div className="pv pv-bj">
          <div className="pv-bj__row">
            <span className="pv-card">A<i>♠</i></span>
            <span className="pv-card pv-card--red">K<i>♥</i></span>
          </div>
          <span className="pv-bj__val">21</span>
        </div>
      )
    case 'poker':
      return (
        <div className="pv pv-poker">
          <div className="pv-bj__row">
            {[['A', '♠'], ['K', '♠'], ['Q', '♠'], ['J', '♠'], ['10', '♠']].map(([r, s]) => (
              <span key={r} className="pv-card pv-card--sm">{r}<i>{s}</i></span>
            ))}
          </div>
          <span className="pv-bj__val">All-in!</span>
        </div>
      )
    case 'emojidia':
      return (
        <div className="pv pv-poker pv-emojidia">
          <span className="pv-emojidia__e">🦁👑🌅</span>
          <span className="pv-bj__val">🟩🟨🟩🟥🟩</span>
        </div>
      )
    case 'sueca':
      return (
        <div className="pv pv-poker pv-sueca">
          <div className="pv-bj__row">
            {[['A', '♥'], ['7', '♥'], ['K', '♠'], ['J', '♣']].map(([r, s]) => (
              <span key={r} className={`pv-card pv-card--sm${s === '♥' ? ' pv-card--red' : ''}`}>{r}<i>{s}</i></span>
            ))}
          </div>
          <span className="pv-bj__val">Trunfo ♥</span>
        </div>
      )
    case 'colonos':
      return (
        <div className="pv pv-colonos">
          {['#3D8B37', '#C9A227', '#9C5B2E', '#7A8B99', '#C9A227', '#3D8B37', '#E3C78F'].map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </div>
      )
    default:
      return (
        <div className="pv">
          <GameIcon game={game} size={64} />
        </div>
      )
  }
}
