import GameIcon from './GameIcon.jsx'
import Tile from '../games/domino/Tile.jsx'
import Astro from '../games/impostor/Astro.jsx'

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
    case 'spider':
    case 'freecell':
      return (
        <div className={`pv pv-sol pv-${game}`}>
          {(game === 'spider' ? [['K', '♠'], ['Q', '♠'], ['J', '♠'], ['10', '♠']] : [['K', '♣'], ['Q', '♥'], ['J', '♠'], ['10', '♦']]).map(([r, s], i) => (
            <span key={r} className={`pv-card pv-card--sm${s === '♥' || s === '♦' ? ' pv-card--red' : ''}`} style={{ marginTop: i * 12 }}>{r}<i>{s}</i></span>
          ))}
        </div>
      )
    case 'desenho':
      return (
        <div className="pv pv-desenho">
          <svg viewBox="0 0 120 90" aria-hidden="true">
            <rect x="2" y="2" width="116" height="86" rx="8" fill="#fff" />
            <circle cx="60" cy="38" r="18" fill="none" stroke="#14141C" strokeWidth="3" />
            <path d="M48 34h4M68 34h4M50 46q10 8 20 0" stroke="#14141C" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M30 78q30-16 60 0" stroke="#2FBF71" strokeWidth="4" fill="none" strokeLinecap="round" />
            <text x="96" y="26" fontSize="18" fontWeight="900" fill="#E5243B">?</text>
          </svg>
        </div>
      )
    case 'bombapalavras':
      return (
        <div className="pv pv-bombapalavras">
          <svg viewBox="0 0 120 120" width="88" height="88" aria-hidden="true">
            <circle cx="58" cy="66" r="44" fill="#15151C" />
            <rect x="64" y="14" width="20" height="16" rx="4" fill="#3A3F58" transform="rotate(35 74 22)" />
            <path d="M80 16q8-12 18-6" stroke="#F4E6C3" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="99" cy="9" r="6" fill="#FFC93C" />
          </svg>
          <b>CA</b>
        </div>
      )
    case 'impostor':
      return (
        <div className="pv pv-impostor">
          <Astro color="#2F80ED" size={34} />
          <Astro color="#E5243B" size={44} />
          <Astro color="#2FBF71" size={34} />
        </div>
      )
    case 'domino':
      return (
        <div className="pv pv-domino">
          <Tile l={6} r={6} vertical />
          <Tile l={6} r={3} />
          <Tile l={3} r={1} />
        </div>
      )
    case 'bisca':
      return (
        <div className="pv pv-poker pv-bisca">
          <div className="pv-bj__row">
            {[['A', '♦'], ['7', '♣'], ['K', '♦']].map(([r, s]) => (
              <span key={r} className={`pv-card${s === '♦' ? ' pv-card--red' : ''}`}>{r}<i>{s}</i></span>
            ))}
          </div>
          <span className="pv-bj__val">Trunfo ♦</span>
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
