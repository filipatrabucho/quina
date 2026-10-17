import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Hub from './pages/Hub.jsx'
import PalavrasGame from './games/palavras/PalavrasGame.jsx'
import FiadaGame from './games/fiada/FiadaGame.jsx'

// Os jogos novos só são descarregados quando se abrem.
const Conta = lazy(() => import('./pages/Conta.jsx'))
const Perfil = lazy(() => import('./pages/Perfil.jsx'))
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

const page = (el) => <Suspense fallback={<p className="page-loading">A carregar…</p>}>{el}</Suspense>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hub />} />
        <Route path="palavras" element={<PalavrasGame />} />
        <Route path="fiada" element={<FiadaGame />} />
        <Route path="quatro-em-linha" element={page(<QuatroGame />)} />
        <Route path="galo" element={page(<GaloGame />)} />
        <Route path="xadrez" element={page(<XadrezGame />)} />
        <Route path="memes" element={page(<MemesGame />)} />
        <Route path="batalha-naval" element={page(<NavalGame />)} />
        <Route path="stop" element={page(<StopGame />)} />
        <Route path="cartas" element={page(<CartasGame />)} />
        <Route path="snake" element={page(<SnakeGame />)} />
        <Route path="memoria" element={page(<MemoriaGame />)} />
        <Route path="99" element={page(<NoventaGame />)} />
        <Route path="2-verdades-1-mentira" element={page(<VerdadesGame />)} />
        <Route path="continua-a-frase" element={page(<FraseGame />)} />
        <Route path="emoji-battle" element={page(<EmojisGame />)} />
        <Route path="conta" element={page(<Conta />)} />
        <Route path="u/:username" element={page(<Perfil />)} />
      </Route>
    </Routes>
  )
}
