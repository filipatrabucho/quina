// Separado do resto para o gerador de bonecos (~300 kB) só ser descarregado
// quando é preciso.
import { createAvatar } from '@dicebear/core'
import * as adventurer from '@dicebear/adventurer'

export function generatedAvatarSvg(seed) {
  return createAvatar(adventurer, {
    seed: String(seed || 'quina'),
    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
    radius: 50,
  }).toString()
}
