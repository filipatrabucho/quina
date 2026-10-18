// Usado só no build: gera o HTML de cada página para aparecer logo, antes do
// JavaScript carregar (o browser depois "acorda" a página com hydrateRoot).
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.jsx'

export function render(url) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>
  )
}
