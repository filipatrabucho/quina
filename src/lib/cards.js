// Baralho francês partilhado (Blackjack, Poker).
export const SUITS = ['s', 'h', 'd', 'c']
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }
export const SUIT_NAME = { s: 'Espadas', h: 'Copas', d: 'Ouros', c: 'Paus' }
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

// `decks` baralhos juntos (ex.: 6 no Blackjack). Cada carta tem um id único.
export function buildDeck(decks = 1) {
  const deck = []
  let n = 0
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: n++, suit, rank })
  return deck
}

export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const isRed = (card) => card.suit === 'h' || card.suit === 'd'
export const cardLabel = (card) => `${card.rank}${SUIT_SYMBOL[card.suit]}`
