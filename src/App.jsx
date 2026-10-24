import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Hub from './pages/Hub.jsx'
import BetaGate from './components/BetaGate.jsx'
import Sobre from './pages/Sobre.jsx'
import Contacto from './pages/Contacto.jsx'
import Discord from './pages/Discord.jsx'

// Os jogos novos só são descarregados quando se abrem.
const PalavrasGame = lazy(() => import('./games/palavras/PalavrasGame.jsx'))
const FiadaGame = lazy(() => import('./games/fiada/FiadaGame.jsx'))
const Conta = lazy(() => import('./pages/Conta.jsx'))
const Perfil = lazy(() => import('./pages/Perfil.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const QuatroGame = lazy(() => import('./games/quatro/QuatroGame.jsx'))
const GaloGame = lazy(() => import('./games/galo/GaloGame.jsx'))
const XadrezGame = lazy(() => import('./games/xadrez/XadrezGame.jsx'))
const MemesGame = lazy(() => import('./games/memes/MemesGame.jsx'))
const NavalGame = lazy(() => import('./games/naval/NavalGame.jsx'))
const StopGame = lazy(() => import('./games/stop/StopGame.jsx'))
const CartasGame = lazy(() => import('./games/cartas/CartasGame.jsx'))
const SnakeGame = lazy(() => import('./games/snake/SnakeGame.jsx'))
const MemoriaGame = lazy(() => import('./games/memoria/MemoriaGame.jsx'))
const NoventaGame = lazy(() => import('./games/noventa/NoventaGame.jsx'))
const VerdadesGame = lazy(() => import('./games/verdades/VerdadesGame.jsx'))
const FraseGame = lazy(() => import('./games/frase/FraseGame.jsx'))
const EmojisGame = lazy(() => import('./games/emojis/EmojisGame.jsx'))
const ColonosGame = lazy(() => import('./games/colonos/ColonosGame.jsx'))
const BombasGame = lazy(() => import('./games/bombas/BombasGame.jsx'))
const BlackjackGame = lazy(() => import('./games/blackjack/BlackjackGame.jsx'))
const PokerGame = lazy(() => import('./games/poker/PokerGame.jsx'))
const SuecaGame = lazy(() => import('./games/sueca/SuecaGame.jsx'))
const BiscaGame = lazy(() => import('./games/bisca/BiscaGame.jsx'))
const DominoGame = lazy(() => import('./games/domino/DominoGame.jsx'))
const SpiderGame = lazy(() => import('./games/solitario/SpiderGame.jsx'))
const FreecellGame = lazy(() => import('./games/solitario/FreecellGame.jsx'))
const EmojiDiaGame = lazy(() => import('./games/emojidia/EmojiDiaGame.jsx'))

const page = (el) => <Suspense fallback={<p className="page-loading">A carregar…</p>}>{el}</Suspense>
// Os jogos abrem para todos (as salas online pedem conta, ver LoginGate); os
// que estão em beta (no código ou mudados no backoffice) só para testers.
const game = (key, el) => <BetaGate game={key}>{page(el)}</BetaGate>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hub />} />
        <Route path="palavras" element={game('palavras', <PalavrasGame />)} />
        <Route path="fiada" element={game('fiada', <FiadaGame />)} />
        <Route path="quatro-em-linha" element={game('quatro', <QuatroGame />)} />
        <Route path="galo" element={game('galo', <GaloGame />)} />
        <Route path="xadrez" element={game('xadrez', <XadrezGame />)} />
        <Route path="memes" element={game('memes', <MemesGame />)} />
        <Route path="batalha-naval" element={game('naval', <NavalGame />)} />
        <Route path="stop" element={game('stop', <StopGame />)} />
        <Route path="cartas" element={game('cartas', <CartasGame />)} />
        <Route path="snake" element={game('snake', <SnakeGame />)} />
        <Route path="memoria" element={game('memoria', <MemoriaGame />)} />
        <Route path="99" element={game('noventa', <NoventaGame />)} />
        <Route path="2-verdades-1-mentira" element={game('verdades', <VerdadesGame />)} />
        <Route path="continua-a-frase" element={game('frase', <FraseGame />)} />
        <Route path="bombas" element={game('bombas', <BombasGame />)} />
        <Route path="blackjack" element={game('blackjack', <BlackjackGame />)} />
        <Route path="poker" element={game('poker', <PokerGame />)} />
        <Route path="emoji-do-dia" element={game('emojidia', <EmojiDiaGame />)} />
        <Route path="spider" element={game('spider', <SpiderGame />)} />
        <Route path="freecell" element={game('freecell', <FreecellGame />)} />
        <Route path="domino" element={game('domino', <DominoGame />)} />
        <Route path="bisca" element={game('bisca', <BiscaGame />)} />
        <Route path="sueca" element={game('sueca', <SuecaGame />)} />
        <Route path="emoji-battle" element={game('emojis', <EmojisGame />)} />
        <Route path="colonos" element={game('colonos', <ColonosGame />)} />
        <Route path="conta" element={page(<Conta />)} />
        <Route path="u/:username" element={page(<Perfil />)} />
        <Route path="admin" element={page(<Admin />)} />
        <Route path="jogos-para-discord" element={<Discord />} />
        <Route path="sobre" element={<Sobre />} />
        <Route path="contacto" element={<Contacto />} />
      </Route>
    </Routes>
  )
}
