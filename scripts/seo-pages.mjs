// Depois do vite build: cria uma página HTML por jogo (com título, descrição,
// canonical e dados estruturados próprios) e o sitemap.xml.
// O Netlify serve /xadrez/index.html em /xadrez antes da regra da SPA.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAMES } from '../src/data/games.js'
import { seoFor, SITE_URL, SITE_NAME, PUBLIC_PATHS } from '../src/data/seo.js'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const base = readFileSync(join(dist, 'index.html'), 'utf8')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function jsonLd(s) {
  if (s.path === '/') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Jogos do ${SITE_NAME}`,
      itemListElement: GAMES.filter((g) => !g.beta).map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + g.to, name: g.title })),
    }
  }
  if (!s.game) return null
  const g = s.game
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: g.title,
    url: SITE_URL + g.to,
    description: g.description,
    inLanguage: 'pt-PT',
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: g.tags.includes('online') ? 'MultiPlayer' : 'SinglePlayer',
    numberOfPlayers: g.players,
    image: `${SITE_URL}/og-image.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@id': `${SITE_URL}/#org` },
  }
}

function fallback(s) {
  const links = GAMES.filter((g) => !g.beta)
    .map((g) => `<li><a href="${g.to}">${esc(g.title)}</a>: ${esc(g.description)}</li>`)
    .join('')
  const h1 = s.game ? `${esc(s.game.title)} online grátis` : 'Jogos online grátis em português'
  return `<noscript><h1>${h1}</h1><p>${esc(s.description)}</p><ul>${links}</ul></noscript>`
}

function page(path) {
  const s = seoFor(path)
  const url = SITE_URL + (path === '/' ? '/' : path)
  let html = base
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(s.description)}`)
    .replace(/(<meta name="robots" content=")[^"]*/, `$1${s.noindex ? 'noindex, follow' : 'index, follow'}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(s.title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(s.description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(s.title)}`)
    .replace('<!--seo-fallback-->', fallback(s))
  const ld = jsonLd(s)
  if (ld) html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  </head>`)
  return html
}

writeFileSync(join(dist, 'index.html'), page('/'))
const paths = [...GAMES.map((g) => g.to), '/conta']
for (const p of paths) {
  const dir = join(dist, p)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), page(p))
}

const today = new Date().toISOString().slice(0, 10)
const urls = PUBLIC_PATHS.map(
  (p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod><changefreq>${p === '/' || p === '/palavras' ? 'daily' : 'weekly'}</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`
)
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
console.log(`seo: ${paths.length + 1} páginas e sitemap com ${urls.length} endereços`)
