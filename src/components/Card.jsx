import { SUIT_SYMBOL, isRed } from '../lib/cards.js'

// Carta de jogar normal (sem efeitos). `hidden` mostra as costas.
export default function Card({ card, hidden = false, small = false, highlight = false, dim = false, testid }) {
  if (hidden || !card) {
    return <span className={`pcard pcard--back${small ? ' pcard--small' : ''}`} data-testid={testid} aria-label="Carta virada para baixo" />
  }
  return (
    <span
      className={`pcard${isRed(card) ? ' pcard--red' : ''}${small ? ' pcard--small' : ''}${highlight ? ' pcard--hl' : ''}${dim ? ' pcard--dim' : ''}`}
      data-testid={testid}
      aria-label={`${card.rank} de ${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="pcard__corner">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</span>
      <span className="pcard__suit">{SUIT_SYMBOL[card.suit]}</span>
      <span className="pcard__corner pcard__corner--br">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</span>
    </span>
  )
}
