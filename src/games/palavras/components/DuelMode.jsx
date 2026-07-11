import { useEffect, useState, useCallback, useMemo } from 'react'
import Board from './Board.jsx'
import Keyboard from './Keyboard.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  createDuel,
  createOrJoinDuelForInstance,
  joinDuel,
  getDuel,
  submitSecretWord,
  submitDuelGuess,
  subscribeToDuel,
  hasSubmittedSecretWord,
} from '../lib/duels.js'
import { WORD_LENGTH, computeKeyboardStatuses } from '../utils/gameLogic.js'
import { isRealWord, preloadDictionary } from '../utils/dictionary.js'

const DUEL_MAX_GUESSES = 6

export default function DuelMode({ onExit }) {
  const { user, loading, signInWithDiscord, signOut, discordActivity } = useAuth()
  const [duel, setDuel] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [wordInput, setWordInput] = useState('')
  const [myWordSubmitted, setMyWordSubmitted] = useState(false)
  const [currentGuess, setCurrentGuess] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    preloadDictionary()
  }, [])

  useEffect(() => {
    if (!duel) return undefined
    return subscribeToDuel(duel.id, (updated) => setDuel(updated))
  }, [duel?.id])

  useEffect(() => {
    if (duel?.id) localStorage.setItem('quina-duelo-atual', duel.id)
  }, [duel?.id])

  // Guardar o convite assim que chega (mesmo antes do login) e limpar o
  // URL logo de seguida — nunca deixar um URL grande ir para o login do
  // Discord.
  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('duelo')
    if (!inviteCode) return
    localStorage.setItem('quina-convite-pendente', inviteCode)
    const url = new URL(window.location.href)
    url.searchParams.delete('duelo')
    window.history.replaceState({}, '', url)
  }, [])

  // Fora do Discord: se recarregares a página a meio de um jogo, volta a
  // entrar na mesma sala em vez de te devolver ao lobby (a não ser que
  // tenhas um convite pendente — esse tem prioridade).
  useEffect(() => {
    if (!user || duel || discordActivity) return
    if (localStorage.getItem('quina-convite-pendente')) return
    const saved = localStorage.getItem('quina-duelo-atual')
    if (!saved) return
    getDuel(saved)
      .then((d) => {
        if (d.host_id === user.id || d.guest_id === user.id) setDuel(d)
        else localStorage.removeItem('quina-duelo-atual')
      })
      .catch(() => localStorage.removeItem('quina-duelo-atual'))
  }, [user, duel, discordActivity])

  // Entrar automaticamente na sala de um convite pendente, assim que
  // tivermos sessão iniciada.
  useEffect(() => {
    if (!user || duel) return
    const inviteCode = localStorage.getItem('quina-convite-pendente')
    if (!inviteCode) return
    localStorage.removeItem('quina-convite-pendente')
    joinDuel(inviteCode)
      .then(setDuel)
      .catch((e) => setError(e.message))
  }, [user, duel])

  // Dentro do Discord, entra automaticamente na sala do canal de voz atual
  // (sem precisar de código manual).
  useEffect(() => {
    if (!user || !discordActivity?.instanceId || duel) return
    createOrJoinDuelForInstance(discordActivity.instanceId)
      .then(setDuel)
      .catch((e) => setError(e.message))
  }, [user, discordActivity, duel])

  const isHost = duel && user && duel.host_id === user.id
  const myGuesses = duel ? (isHost ? duel.host_guesses : duel.guest_guesses) : []
  const oppGuesses = duel ? (isHost ? duel.guest_guesses : duel.host_guesses) : []
  const iWon = duel ? (isHost ? duel.host_won : duel.guest_won) : false
  const oppWon = duel ? (isHost ? duel.guest_won : duel.host_won) : false

  const myStatusesPerGuess = useMemo(() => myGuesses.map((g) => g.statuses), [myGuesses])
  const myGuessWords = useMemo(() => myGuesses.map((g) => g.guess), [myGuesses])
  const keyboardStatuses = useMemo(
    () => computeKeyboardStatuses(myGuessWords, myStatusesPerGuess),
    [myGuessWords, myStatusesPerGuess]
  )

  // Se a página for recarregada a meio da fase de escolha da palavra,
  // confirma se já a tinhas submetido (para não pedir outra vez).
  useEffect(() => {
    if (!duel || duel.status !== 'a-escolher') return
    hasSubmittedSecretWord(duel.id).then(setMyWordSubmitted)
  }, [duel?.id, duel?.status])

  const handleCreate = async () => {
    setBusy(true)
    setError('')
    try {
      setDuel(await createDuel())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    setBusy(true)
    setError('')
    try {
      setDuel(await joinDuel(joinCode))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitWord = async () => {
    if (wordInput.length !== WORD_LENGTH) {
      setError('A palavra tem de ter 5 letras')
      return
    }
    setBusy(true)
    setError('')
    try {
      const ok = await isRealWord(wordInput)
      if (!ok) {
        setError('Essa palavra não existe')
        return
      }
      await submitSecretWord(duel.id, wordInput)
      setMyWordSubmitted(true)
      setDuel(await getDuel(duel.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== WORD_LENGTH) {
      setError('Faltam letras')
      return
    }
    setBusy(true)
    setError('')
    try {
      const ok = await isRealWord(currentGuess)
      if (!ok) {
        setError('Palavra desconhecida')
        return
      }
      await submitDuelGuess(duel.id, currentGuess)
      setCurrentGuess('')
      setDuel(await getDuel(duel.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [currentGuess, duel])

  const handleGuessKey = useCallback(
    (key) => {
      if (!duel || duel.status !== 'a-jogar' || iWon) return
      if (key === 'ENTER') {
        submitGuess()
      } else if (key === 'BACK') {
        setCurrentGuess((g) => g.slice(0, -1))
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((g) => g + key)
      }
    },
    [duel, currentGuess, iWon, submitGuess]
  )

  useEffect(() => {
    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toUpperCase()
      if (key === 'ENTER') handleGuessKey('ENTER')
      else if (key === 'BACKSPACE') handleGuessKey('BACK')
      else if (/^[A-Z]$/.test(key)) handleGuessKey(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleGuessKey])

  const [copied, setCopied] = useState(false)

  const handleCopyInvite = async () => {
    const link = `${window.location.origin}${window.location.pathname}?duelo=${duel.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Quina — 1vs1', text: 'Vem jogar comigo!', url: link })
        return
      } catch {
        // utilizador cancelou a partilha nativa, cai para copiar
      }
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <div className="duel-panel">A carregar…</div>

  if (!user) {
    return (
      <div className="duel-panel">
        <button className="icon-btn" onClick={onExit} aria-label="Voltar">←</button>
        <h2>Entra com o Discord para jogar 1vs1</h2>
        <button className="share-btn" onClick={signInWithDiscord}>Entrar com Discord</button>
      </div>
    )
  }

  if (!duel) {
    return (
      <div className="duel-panel">
        <button className="icon-btn" onClick={onExit} aria-label="Voltar">←</button>
        <p>Sessão iniciada como {user.user_metadata?.full_name || user.email}</p>
        <button className="share-btn" onClick={handleCreate} disabled={busy}>Criar sala</button>
        <div className="duel-join">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código da sala"
            maxLength={6}
          />
          <button className="mode-btn" onClick={handleJoin} disabled={busy || joinCode.length !== 6}>
            Entrar
          </button>
        </div>
        {error && <p className="duel-error">{error}</p>}
        <button className="modal-note" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={signOut}>
          Sair da conta
        </button>
      </div>
    )
  }

  if (duel.status === 'a-espera') {
    return (
      <div className="duel-panel">
        <p>Partilha este código com o teu adversário:</p>
        <div className="duel-code">{duel.code}</div>
        <button className="share-btn" onClick={handleCopyInvite}>
          {copied ? 'Copiado! ✓' : 'Copiar link de convite'}
        </button>
        <p className="modal-note">À espera que o segundo jogador entre…</p>
      </div>
    )
  }

  if (duel.status === 'a-escolher') {
    if (myWordSubmitted) {
      return (
        <div className="duel-panel">
          <p>À espera que o adversário escolha a palavra secreta…</p>
        </div>
      )
    }
    return (
      <div className="duel-panel">
        <p>Escolhe a tua palavra secreta (o adversário vai tentar adivinhá-la):</p>
        <input
          value={wordInput}
          onChange={(e) => setWordInput(e.target.value.toUpperCase().slice(0, 5))}
          maxLength={5}
        />
        <button className="share-btn" onClick={handleSubmitWord} disabled={busy}>Confirmar</button>
        {error && <p className="duel-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="duel-panel">
      <div className="duel-scoreboard">
        <div>Tu: {myGuesses.length}/{DUEL_MAX_GUESSES} {iWon && '🏆'}</div>
        <div>Adversário: {oppGuesses.length}/{DUEL_MAX_GUESSES} {oppWon && '🏆'}</div>
      </div>
      <Board
        guesses={myGuessWords}
        statusesPerGuess={myStatusesPerGuess}
        currentGuess={duel.status === 'a-jogar' && !iWon ? currentGuess : ''}
        maxGuesses={DUEL_MAX_GUESSES}
        solved={iWon}
      />
      {duel.status === 'terminado' && (
        <>
          <p className="duel-result">
            {iWon && oppWon ? 'Empate!' : iWon ? 'Ganhaste! 🏆' : oppWon ? 'Perdeste.' : 'Ninguém acertou.'}
          </p>
          <button
            className="share-btn"
            onClick={() => {
              localStorage.removeItem('quina-duelo-atual')
              setDuel(null)
              setMyWordSubmitted(false)
            }}
          >
            Novo duelo
          </button>
        </>
      )}
      {duel.status === 'a-jogar' && !iWon && <Keyboard statuses={keyboardStatuses} onKey={handleGuessKey} />}
      {error && <p className="duel-error">{error}</p>}
    </div>
  )
}