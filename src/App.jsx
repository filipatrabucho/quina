import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Hub from './pages/Hub.jsx'
import PalavrasGame from './games/palavras/PalavrasGame.jsx'
import FiadaGame from './games/fiada/FiadaGame.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hub />} />
        <Route path="palavras" element={<PalavrasGame />} />
        <Route path="fiada" element={<FiadaGame />} />
      </Route>
    </Routes>
  )
}