import { useAuth } from '../hooks/useAuth.js'

// Entrar (ou criar conta) com o Discord.
export default function DiscordButton({ returnTo, label = 'Entrar com Discord' }) {
  const { signInWithDiscord } = useAuth()
  return (
    <button type="button" className="btn-discord" onClick={() => signInWithDiscord(returnTo)} data-testid="discord-login">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
        <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.2a18.2 18.2 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
      </svg>
      {label}
    </button>
  )
}
