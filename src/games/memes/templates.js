// Modelos de memes (imagens do imgflip). Primeiro tentamos a lista
// atualizada da API pública do imgflip; se falhar, usamos esta.
const FALLBACK = [
  ['30b1gx', 'Drake Hotline Bling', 2],
  ['1g8my4', 'Two Buttons', 3],
  ['1ur9b0', 'Distracted Boyfriend', 3],
  ['261o3j', 'Running Away Balloon', 5],
  ['3lmzyx', 'UNO Draw 25 Cards', 2],
  ['22bdq6', 'Left Exit 12 Off Ramp', 3],
  ['24y43o', 'Change My Mind', 2],
  ['9ehk', 'Batman Slapping Robin', 2],
  ['1jwhww', 'Expanding Brain', 4],
  ['23ls', 'Disaster Girl', 2],
  ['26jxvz', "Gru's Plan", 4],
  ['3oevdk', 'Bernie I Am Once Again Asking', 2],
  ['1o00in', 'Is This A Pigeon', 3],
  ['345v97', 'Woman Yelling At Cat', 2],
  ['43a45p', 'Buff Doge vs. Cheems', 4],
  ['2fm6x', 'Waiting Skeleton', 2],
  ['1otk96', 'Mocking Spongebob', 2],
  ['1bij', 'One Does Not Simply', 2],
  ['gk5el', 'Hide the Pain Harold', 2],
  ['1h7in3', 'Roll Safe Think About It', 2],
  ['39t1o', 'Leonardo Dicaprio Cheers', 2],
  ['2gnnjh', 'Monkey Puppet', 2],
  ['28s2gu', 'Epic Handshake', 3],
  ['1c1uej', 'Sad Pablo Escobar', 3],
  ['1ihzfe', 'X, X Everywhere', 2],
  ['1bgw', 'Futurama Fry', 2],
  ['26am', 'Ancient Aliens', 2],
  ['1bhk', 'Success Kid', 2],
  ['wxica', 'This Is Fine', 2],
  ['54hjww', 'Trade Offer', 3],
  ['1b42wl', 'Bike Fall', 3],
  ['2kbn1e', 'Surprised Pikachu', 3],
  ['38el31', 'Clown Applying Makeup', 4],
  ['m78d', 'Boardroom Meeting Suggestion', 4],
  ['1e7ql7', 'Evil Kermit', 2],
  ['grr', 'The Rock Driving', 2],
  ['1yxkcp', 'Blank Nut Button', 2],
].map(([id, name, boxes]) => ({ id, name, boxes, url: `https://i.imgflip.com/${id}.jpg` }))

let cached = null

export async function loadTemplates() {
  if (cached) return cached
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('https://api.imgflip.com/get_memes', { signal: ctrl.signal })
    clearTimeout(t)
    const json = await res.json()
    const list = (json?.data?.memes || [])
      .filter((m) => m.url && m.box_count >= 1 && m.box_count <= 5)
      .map((m) => ({ id: String(m.id), name: m.name, boxes: Math.max(2, m.box_count), url: m.url }))
    cached = list.length >= 20 ? list : FALLBACK
  } catch {
    cached = FALLBACK
  }
  return cached
}

export { FALLBACK as FALLBACK_TEMPLATES }
