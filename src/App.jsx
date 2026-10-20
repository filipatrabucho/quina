import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Hub from './pages/Hub.jsx'
import BetaGate from './components/BetaGate.jsx'
import Sobre from './pages/Sobre.jsx'
import Contacto from './pages/Contacto.jsx'
import LoginGate from './components/LoginGate.jsx'

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

const page = (el) => <Suspense fallback={<p className="page-loading">A carregar…</p>}>{el}</Suspense>
// Os jogos só se jogam com conta.
const game = (el) => <LoginGate>{page(el)}</LoginGate>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hub />} />
        <Route path="palavras" element={game(<PalavrasGame />)} />
        <Route path="fiada" element={<BetaGate game="fiada">{game(<FiadaGame />)}</BetaGate>} />
        <Route path="quatro-em-linha" element={game(<QuatroGame />)} />
        <Route path="galo" element={game(<GaloGame />)} />
        <Route path="xadrez" element={game(<XadrezGame />)} />
        <Route path="memes" element={game(<MemesGame />)} />
        <Route path="batalha-naval" element={game(<NavalGame />)} />
        <Route path="stop" element={game(<StopGame />)} />
        <Route path="cartas" element={game(<CartasGame />)} />
        <Route path="snake" element={game(<SnakeGame />)} />
        <Route path="memoria" element={game(<MemoriaGame />)} />
        <Route path="99" element={game(<NoventaGame />)} />
        <Route path="2-verdades-1-mentira" element={game(<VerdadesGame />)} />
        <Route path="continua-a-frase" element={game(<FraseGame />)} />
        <Route path="bombas" element={<BetaGate game="bombas">{game(<BombasGame />)}</BetaGate>} />
        <Route path="blackjack" element={<BetaGate game="blackjack">{game(<BlackjackGame />)}</BetaGate>} />
        <Route path="poker" element={<BetaGate game="poker">{game(<PokerGame />)}</BetaGate>} />
        <Route path="emoji-battle" element={game(<EmojisGame />)} />
        <Route path="colonos" element={<BetaGate game="colonos">{game(<ColonosGame />)}</BetaGate>} />
        <Route path="conta" element={page(<Conta />)} />
        <Route path="u/:username" element={page(<Perfil />)} />
        <Route path="admin" element={page(<Admin />)} />
        <Route path="sobre" element={<Sobre />} />
        <Route path="contacto" element={<Contacto />} />
      </Route>
    </Routes>
  )
}
