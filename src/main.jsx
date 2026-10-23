import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { applyGameSettings } from './data/games.js'
import { registerServiceWorker } from './lib/app.js'
import './index.css'

// Estado beta/produção com que o build desenhou as páginas (igual ao do HTML).
if (window.__TG_GAMES__) applyGameSettings(window.__TG_GAMES__)
// Instalar como app e lembretes (só na versão publicada).
registerServiceWorker()

const root = document.getElementById('root')
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// As páginas vêm já desenhadas do build: aproveita o HTML em vez de o refazer.
// Os jogos carregam à parte, por isso o build desenha "A carregar…" no lugar
// deles e o React avisa (erro 419) quando os desenha no browser: é esperado.
const expected = (e) => /#419|could not finish this Suspense boundary/.test(String(e?.message || e))
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, app, {
    onRecoverableError: (e) => {
      if (!expected(e)) console.error(e)
    },
  })
}
else ReactDOM.createRoot(root).render(app)
