import test from 'node:test'
import assert from 'node:assert/strict'
import { lisbonDay, dayNumber, puzzlesOfDay, squares, shareText, streakOf, msToNextDay, PER_DAY } from '../src/games/emojidia/emojiDia.js'
import { PUZZLES } from '../src/games/emojis/puzzles.js'

test('dia de Lisboa e número do desafio', () => {
  assert.equal(dayNumber('2026-10-21'), 1)
  assert.equal(dayNumber('2026-10-22'), 2)
  assert.equal(lisbonDay(Date.UTC(2026, 9, 22, 23, 30)), '2026-10-23', 'às 23:30 UTC já é dia 23 em Lisboa (verão)')
})

test('5 enigmas por dia, iguais para todos, sem repetir em dias seguidos', () => {
  const a = puzzlesOfDay(1)
  assert.deepEqual(a, puzzlesOfDay(1))
  assert.equal(new Set(a).size, PER_DAY)
  const seen = new Set()
  const days = Math.floor(PUZZLES.length / PER_DAY)
  for (let n = 1; n <= days; n++) for (const id of puzzlesOfDay(n)) seen.add(id)
  assert.equal(seen.size, days * PER_DAY, 'não repete até a lista dar a volta')
})

test('partilha e sequência de dias', () => {
  assert.equal(squares([1, 2, 0, 3, 1]), '🟩🟨🟥🟧🟩')
  const s = shareText(7, [1, 2, 0, 3, 1])
  assert.match(s.text, /Emoji do Dia #7 🟩🟨🟥🟧🟩 4\/5/)
  assert.match(s.url, /emoji-do-dia\?utm_source=partilha/)
  assert.equal(streakOf(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24'), 3)
  assert.equal(streakOf(['2026-10-22', '2026-10-23'], '2026-10-24'), 2, 'ainda não jogou hoje: conta até ontem')
  assert.equal(streakOf(['2026-10-22'], '2026-10-24'), 0)
  const ms = msToNextDay(Date.UTC(2026, 9, 22, 22, 0))
  assert.ok(ms > 0 && ms <= 60 * 60000 + 60000, 'meia-noite de Lisboa (UTC+1) é daqui a 1 hora')
})
