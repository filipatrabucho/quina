import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Hub from './pages/Hub.jsx'
import PalavrasGame from './games/palavras/PalavrasGame.jsx'
import FiadaGame from './games/fiada/FiadaGame.jsx'

// Os jogos novos só são descarregados quando se abrem.
const Conta = lazy(() => import('./pages/Conta.jsx'))
const QuatroGame = lazy(() => import('./games/quatro/QuatroGame.jsx'))
const GaloGame = lazy(() => import('./games/galo/GaloGame.jsx'))
const XadrezGame = lazy(() => import('./games/xadrez/XadrezGame.jsx'))
const MemesGame = lazy(() => import('./games/memes/MemesGame.jsx'))

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
        <Route path="conta" element={page(<Conta />)} />
      </Route>
    </Routes>
  )
}
