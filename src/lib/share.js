import { lengthOf } from '../games/snake/snakeLogic.js'
import { gameByKey } from '../data/games.js'

const SITE = 'https://tugagames.pt'

// Texto e link para partilhar o resultado de uma partida. O link leva UTM para
// se ver no Analytics quantas visitas vêm das partilhas.
export function shareMessage({ game, won, detail }) {
  const g = gameByKey(game)
  const title = g?.title || 'Tuga Games'
  const url = `${SITE}${g?.to || '/'}?utm_source=partilha&utm_medium=social&utm_campaign=fim_de_jogo`
  let line
  if (game === 'snake' && Number(detail) > 0) line = `A minha cobra chegou a ${lengthOf(detail)} de tamanho na Snake 🐍`
  else if (game === 'emojis' && Number(detail) > 0) line = `Fiz ${detail} pontos no Emoji Battle 😎`
  else if (won) line = `Ganhei uma partida de ${title} 🏆`
  else line = `Estive a jogar ${title} 🎮`
  return { title, text: `${line} no Tuga Games. Consegues fazer melhor?`, url }
}

// O wa.me estraga os emojis (aparecem como �) quando passa pela página de
// redirecionamento; o api.whatsapp.com/send mantém-nos.
export const whatsappUrl = ({ text, url }) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`
