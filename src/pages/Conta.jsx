import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getDisplayName, getAvatarUrl, getAvatarSeed } from '../lib/discordProfile.js'
import {
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  uploadAvatarFile,
  regenerateAvatar,
  changeUsername,
  ensureStoredAvatar,
} from '../lib/account.js'
import Avatar from '../components/Avatar.jsx'
import DiscordButton from '../components/DiscordButton.jsx'
import SocialIcon from '../components/SocialIcon.jsx'
import { useSocial } from '../social/SocialContext.jsx'
import { getOrCreateMyProfile, updatePublicProfile, SOCIAL_NETWORKS, socialUrl } from '../lib/social.js'

function useReturnTo() {
  const [params] = useSearchParams()
  const voltar = params.get('voltar')
  // Só caminhos internos (evita redirecionar para outros sites).
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : null
}

function AuthForms() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (params.get('modo') === 'criar' ? 'criar' : 'entrar'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const navigate = useNavigate()
  const returnTo = useReturnTo()

  const run = async (fn) => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (tab === 'entrar') {
      run(async () => {
        await signInWithEmail({ email, password })
        if (returnTo) navigate(returnTo)
      })
    } else {
      run(async () => {
        const { needsConfirmation } = await signUpWithEmail({ email, password, username })
        if (needsConfirmation) {
          setInfo('Conta criada. Enviámos-te um email de confirmação; depois de confirmares, já podes entrar.')
          setTab('entrar')
        } else if (returnTo) {
          navigate(returnTo)
        }
      })
    }
  }

  const handleReset = () => {
    if (!email.trim()) {
      setError('Escreve o teu email primeiro.')
      return
    }
    run(async () => {
      await sendPasswordReset(email)
      setInfo('Se existir uma conta com esse email, vais receber um link para mudares a password.')
    })
  }

  return (
    <div className="account-card account-card--auth">
      <div className="account-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'entrar'}
          className={`mode-btn${tab === 'entrar' ? ' mode-btn--active' : ''}`}
          onClick={() => { setTab('entrar'); setError('') }}
        >
          Entrar
        </button>
        <button
          role="tab"
          aria-selected={tab === 'criar'}
          className={`mode-btn${tab === 'criar' ? ' mode-btn--active' : ''}`}
          onClick={() => { setTab('criar'); setError('') }}
        >
          Criar conta
        </button>
      </div>

      <DiscordButton returnTo={returnTo || '/conta'} label={tab === 'criar' ? 'Criar conta com Discord' : 'Entrar com Discord'} />
      <div className="account-or"><span>ou com email</span></div>

      <form className="account-form" onSubmit={handleSubmit}>
        {tab === 'criar' && (
          <>
            <label className="account-field">
              <span>Username</span>
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                maxLength={20}
                required
              />
            </label>
          </>
        )}
        <label className="account-field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="account-field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'criar' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        <button className="share-btn" type="submit" disabled={busy}>
          {tab === 'criar' ? 'Criar conta' : 'Entrar'}
        </button>
        {tab === 'entrar' && (
          <button type="button" className="link-btn" onClick={handleReset} disabled={busy}>
            Esqueci-me da password
          </button>
        )}
        {error && <p className="duel-error">{error}</p>}
        {info && <p className="account-info">{info}</p>}
      </form>
    </div>
  )
}

function PublicProfileForm({ user }) {
  const [loaded, setLoaded] = useState(false)
  const [exists, setExists] = useState(false)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ error: '', info: '' })

  useEffect(() => {
    getOrCreateMyProfile(user.id)
      .then((p) => {
        setExists(!!p)
        setUsername(p?.username || '')
        setBio(p?.bio || '')
        setLinks(p?.links || {})
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [user.id])

  if (!loaded || !exists) return null

  const save = async (e) => {
    e.preventDefault()
    const bad = SOCIAL_NETWORKS.find((n) => links[n.key]?.trim() && n.key !== 'discord' && !socialUrl(n.key, links[n.key]))
    if (bad) {
      setMsg({ error: `O link de ${bad.label} não é válido (usa o teu @ ou um endereço https://).`, info: '' })
      return
    }
    setBusy(true)
    setMsg({ error: '', info: '' })
    try {
      const clean = Object.fromEntries(Object.entries(links).map(([k, v]) => [k, String(v).trim().slice(0, 120)]).filter(([, v]) => v))
      await updatePublicProfile(user.id, { bio: bio.trim().slice(0, 300), links: clean })
      setMsg({ error: '', info: 'Perfil público guardado.' })
    } catch (err) {
      setMsg({ error: err.message, info: '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="account-card account-form" onSubmit={save}>
      <div className="account-card__title">
        <h3>Perfil público</h3>
        <Link to={`/u/${username}`} className="link-btn">Ver o meu perfil</Link>
      </div>
      <label className="account-field">
        <span>Descrição</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Fala um pouco sobre ti…" />
        <small className="modal-note">{bio.length}/300</small>
      </label>
      <div className="account-links">
        {SOCIAL_NETWORKS.map((n) => (
          <label key={n.key} className="account-field">
            <span className="account-field__net"><SocialIcon network={n.key} size={20} /> {n.label}</span>
            <input
              value={links[n.key] || ''}
              onChange={(e) => setLinks((l) => ({ ...l, [n.key]: e.target.value }))}
              placeholder={n.key === 'site' ? 'https://…' : n.key === 'discord' ? 'nome#0000 ou username' : '@utilizador'}
              maxLength={120}
            />
          </label>
        ))}
      </div>
      <button className="btn btn--primary btn--small" type="submit" disabled={busy}>Guardar perfil público</button>
      {msg.error && <p className="duel-error">{msg.error}</p>}
      {msg.info && <p className="account-info">{msg.info}</p>}
    </form>
  )
}

function AdminLink() {
  const s = useSocial()
  if (s?.role !== 'admin') return null
  return <Link className="btn btn--outline btn--small" to="/admin">Gerir testers</Link>
}

function Profile({ user, signOut }) {
  const [username, setUsername] = useState(getDisplayName(user))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const fileRef = useRef(null)
  const isDiscord = !user.user_metadata?.username && user.app_metadata?.provider === 'discord'

  useEffect(() => {
    ensureStoredAvatar(user)
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, okMsg) => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await fn()
      if (okMsg) setInfo(okMsg)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-card">
      <div className="account-profile">
        <Avatar src={getAvatarUrl(user)} seed={getAvatarSeed(user)} name={getDisplayName(user)} size={112} />
        <div className="account-profile__actions">
          <button className="mode-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Carregar foto
          </button>
          <button
            className="mode-btn"
            onClick={() => run(() => regenerateAvatar(user), 'Avatar atualizado.')}
            disabled={busy}
          >
            Gerar novo avatar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            data-testid="avatar-file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) run(() => uploadAvatarFile(user, file), 'Foto atualizada.')
            }}
          />
        </div>
      </div>

      {!isDiscord && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => changeUsername(user, username), 'Username atualizado.')
          }}
        >
          <label className="account-field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
          </label>
          <button className="mode-btn" type="submit" disabled={busy || username.trim() === getDisplayName(user)}>
            Guardar username
          </button>
        </form>
      )}

      {user.email && <p className="modal-note">Email: {user.email}</p>}
      <AdminLink />
      {error && <p className="duel-error">{error}</p>}
      {info && <p className="account-info">{info}</p>}
      <button className="link-btn" onClick={signOut}>Terminar sessão</button>
    </div>
  )
}

export default function Conta() {
  const { user, loading, signOut } = useAuth()

  return (
    <main className="account-page">
      <h2 className="game-title">A minha conta</h2>
      {loading ? (
        <p>A carregar…</p>
      ) : user && !user.is_anonymous ? (
        <>
          <Profile user={user} signOut={signOut} />
          <PublicProfileForm user={user} />
        </>
      ) : (
        <>
          {user?.is_anonymous && (
            <p className="modal-note">
              Estás a jogar como convidado ({getDisplayName(user)}). Cria uma conta para guardares o teu nome e avatar.
            </p>
          )}
          <AuthForms />
        </>
      )}
    </main>
  )
}
