// Depois do vite build: cria uma página HTML por jogo (com título, descrição,
// canonical e dados estruturados próprios) e o sitemap.xml.
// O Netlify serve /xadrez/index.html em /xadrez antes da regra da SPA.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAMES } from '../src/data/games.js'
import { seoFor, SITE_URL, SITE_NAME, PUBLIC_PATHS } from '../src/data/seo.js'
import { GUIDES } from '../src/data/gameGuides.js'
import { render } from '../dist-ssr/entry-server.js'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
let base = readFileSync(join(dist, 'index.html'), 'utf8')

// Google Analytics 4 (com o modo de consentimento: até a pessoa aceitar na
// mensagem de cookies da Google, só são enviadas contagens sem cookies).
// O script carrega depois de a página aparecer, para não atrasar nada.
const gaId = (process.env.VITE_GA_ID || 'G-W28QZ5ZBHF').trim()
if (/^G-[A-Z0-9]+$/.test(gaId)) {
  const ga =
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;` +
    `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});` +
    `gtag('js',new Date());gtag('config','${gaId}',{send_page_view:false});` +
    `(function(){var d=false;function l(){if(d)return;d=true;var s=document.createElement('script');s.async=true;` +
    `s.src='https://www.googletagmanager.com/gtag/js?id=${gaId}';document.head.appendChild(s)}` +
    `if(document.readyState==='complete')setTimeout(l,800);else addEventListener('load',function(){setTimeout(l,800)});` +
    `['pointerdown','keydown','scroll','touchstart'].forEach(function(e){addEventListener(e,l,{once:true,passive:true})})})();`
  base = base.replace('</head>', `  <script>${ga}</script>\n  </head>`)
  console.log(`analytics: Google Analytics ${gaId}`)
}

// AdSense: o código de verificação vai no <head> de todas as páginas e cria-se
// o ads.txt (o ID pode ser trocado com VITE_ADSENSE_CLIENT no Netlify).
const adsClient = (process.env.VITE_ADSENSE_CLIENT || 'ca-pub-5462942064593521').trim()
if (/^ca-pub-\d+$/.test(adsClient)) {
  const hint = process.env.VITE_ADSENSE_GAMES === 'on' ? "s.dataset.adFrequencyHint='60s';" : ''
  // O script do AdSense só carrega quando a pessoa mexe na página (scroll,
  // toque, tecla) ou 4 s depois de a página acabar de carregar: assim não
  // atrasa a primeira pintura. Os anúncios pedidos antes ficam em fila.
  const loader =
    `(function(){var d=false;function l(){if(d)return;d=true;var s=document.createElement('script');` +
    `s.async=true;s.crossOrigin='anonymous';${hint}s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}';` +
    `document.head.appendChild(s)}window.__tgLoadAds=l;window.adsbygoogle=window.adsbygoogle||[];` +
    `['scroll','pointerdown','keydown','touchstart'].forEach(function(e){addEventListener(e,l,{once:true,passive:true})});` +
    `addEventListener('load',function(){setTimeout(l,4000)})})();`
  base = base.replace(
    '</head>',
    `  <meta name="google-adsense-account" content="${adsClient}" />\n    <script>${loader}</script>\n  </head>`
  )
  writeFileSync(join(dist, 'ads.txt'), `google.com, ${adsClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`)
  console.log(`ads: AdSense ${adsClient} e ads.txt`)
} else if (adsClient) {
  console.warn(`ads: VITE_ADSENSE_CLIENT inválido (${adsClient}); deve ser ca-pub-seguido de números`)
}
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
  const faq = GUIDES[g.key]?.faq || []
  const game = {
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
  if (!faq.length) return game
  return [
    game,
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ]
}

function fallback(s) {
  const links = GAMES.filter((g) => !g.beta)
    .map((g) => `<li><a href="${g.to}">${esc(g.title)}</a>: ${esc(g.description)}</li>`)
    .join('')
  const h1 = s.game ? `${esc(s.game.title)} online grátis` : 'Jogos online grátis em português'
  const g = s.game && GUIDES[s.game.key]
  const guide = g
    ? `<h2>Como jogar ${esc(s.game.title)}</h2><p>${esc(g.intro)}</p><h3>Regras</h3><ul>${g.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` +
      (g.tips?.length ? `<h3>Dicas</h3><ul>${g.tips.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '')
    : ''
  return `<noscript><h1>${h1}</h1><p>${esc(s.description)}</p>${guide}<ul>${links}</ul><p><a href="/sobre">Sobre</a> · <a href="/contacto">Contacto</a></p></noscript>`
}

// HTML da página já desenhado (o React aproveita-o ao carregar).
function prerender(path) {
  try {
    return render(path)
  } catch (e) {
    console.warn(`seo: não deu para pré-desenhar ${path}: ${e.message}`)
    return ''
  }
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
    .replace('<div id="root"></div>', `<div id="root">${prerender(path)}</div>`)
  const ld = jsonLd(s)
  if (ld) html = html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  </head>`)
  return html
}

writeFileSync(join(dist, 'index.html'), page('/'))
const paths = [...GAMES.map((g) => g.to), '/conta', '/sobre', '/contacto']
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
