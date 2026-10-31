import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GUIDES } from '../data/gameGuides.js'
import { getTopPlayers, STATS_CHANGED, SCORE_GAMES } from '../lib/social.js'
import { supabase } from '../lib/supabaseClient.js'
import Avatar from './Avatar.jsx'
import { lengthOf } from '../games/snake/snakeLogic.js'
import { useRules, openRules, closeRules } from '../lib/rules.js'

// Jogos que já têm o seu próprio botão de ajuda no ecrã.
const OWN_HELP = ['palavras', 'fiada']

// De quanto em quanto tempo o top volta a ser lido (se o tempo real falhar).
const TOP_REFRESH_MS = 20000

// Top 3 de quem mais ganhou neste jogo (só contas). Atualiza sozinho.
function TopPlayers({ game }) {
  const [top, setTop] = useState(null)
  useEffect(() => {
    let alive = true
    let timer = null
    setTop(null)
    const load = () =>
      getTopPlayers(game.key)
        .then((list) => alive && setTop(list))
        .catch(() => alive && setTop((t) => t ?? []))
    // Junta vários avisos seguidos numa só leitura.
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 400)
    }
    load()

    // A minha vitória (gravada neste browser) e as dos outros (tempo real).
    const onMine = (e) => e.detail?.game === game.key && soon()
    window.addEventListener(STATS_CHANGED, onMine)
    const channel = supabase
      .channel(`top-${game.key}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_stats', filter: `game=eq.${game.key}` }, soon)
      .subscribe()

    // Rede de segurança: volta a ler de vez em quando e ao voltar ao separador.
    const poll = setInterval(() => document.visibilityState === 'visible' && load(), TOP_REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && soon()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      alive = false
      clearTimeout(timer)
      clearInterval(poll)
      window.removeEventListener(STATS_CHANGED, onMine)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      supabase.removeChannel(channel)
    }
  }, [game.key])
  if (top === null) return <p className="game-top__empty">A carregar…</p>
  if (!top.length) {
    return <p className="game-top__empty">{SCORE_GAMES.includes(game.key) ? 'Ainda não há recordes de contas. Cria conta e sê o primeiro do top!' : 'Ainda ninguém ganhou com conta. Cria conta e sê o primeiro do top!'}</p>
  }
  return (
    <ol className="game-top" data-testid="game-top">
      {top.map((x, i) => (
        <li key={x.user_id} className={`game-top__row game-top__row--${i + 1}`}>
          <span className="game-top__pos">{i + 1}</span>
          <Avatar src={x.profile.avatar_url} seed={x.profile.id} name={x.profile.username} size={30} />
          <Link to={`/u/${x.profile.username}`} className="game-top__name">{x.profile.username}</Link>
          {SCORE_GAMES.includes(game.key) ? (
            <span className="game-top__wins"><b>{lengthOf(x.best_score)}</b> de tamanho</span>
          ) : (
            <span className="game-top__wins"><b>{x.wins}</b> {x.wins === 1 ? 'vitória' : 'vitórias'}</span>
          )}
        </li>
      ))}
    </ol>
  )
}

// Top 3 do jogo, centrado por baixo do jogo.
export function GameTop({ game }) {
  return (
    <section className="game-topbox" aria-label={`Top 3 em ${game.title}`} data-testid="game-topbox">
      <h2>🏆 Top 3 em {game.title}</h2>
      <TopPlayers game={game} />
      <Link to="/ranking" className="game-topbox__more">Ver o ranking geral do site →</Link>
    </section>
  )
}

// Janela "Como jogar": resumo do jogo + regras, dicas e perguntas.
// Fica sempre na página (escondida até se abrir), para o Google também a ler.
export default function GameRules({ game }) {
  const g = GUIDES[game.key]
  const { open, help, shell } = useRules()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && closeRules()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  // Fecha ao mudar de jogo.
  useEffect(() => () => closeRules(), [game.key])
  return (
    <>
      {!shell && !OWN_HELP.includes(game.key) && (
        <button type="button" className="rules-fab" onClick={openRules} data-testid="rules-open">
          <span aria-hidden="true">?</span> Como jogar
        </button>
      )}
      <div className="modal-overlay rules-overlay" hidden={!open} onClick={closeRules} data-testid="rules-modal">
        <div className="modal rules-modal" role="dialog" aria-modal="true" aria-label={`Como jogar ${game.title}`} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={closeRules} aria-label="Fechar">×</button>
          <h2>Como jogar {game.title}</h2>
          {g?.intro && <p className="rules-intro">{g.intro}</p>}
          {help && <div className="rules-help">{help}</div>}
          {g && (
            <>
              <details className="rules-item" open={!help}>
                <summary>Regras</summary>
                <ul>{g.rules.map((r) => <li key={r}>{r}</li>)}</ul>
              </details>
              {g.tips?.length > 0 && (
                <details className="rules-item">
                  <summary>Dicas</summary>
                  <ul>{g.tips.map((r) => <li key={r}>{r}</li>)}</ul>
                </details>
              )}
              {g.faq?.length > 0 && (
                <details className="rules-item">
                  <summary>Perguntas frequentes</summary>
                  {g.faq.map(([q, a]) => (
                    <div key={q} className="game-guide__faq">
                      <h3>{q}</h3>
                      <p>{a}</p>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          <button type="button" className="share-btn rules-ok" onClick={closeRules}>Percebi, vamos jogar!</button>
        </div>
      </div>
    </>
  )
}
