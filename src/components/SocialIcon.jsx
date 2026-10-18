// Ícones simples das redes sociais (desenhos próprios, cor de cada marca).
const ICONS = {
  twitch: {
    color: '#9146FF',
    path: <path d="M6 4l-1.5 3.5V18H8v2h2.2l2-2H15l4-4V4zm11.5 9.3L15.3 15.5H12l-2 2v-2H7V5.5h10.5zM14.5 8h-1.5v4h1.5zm-4 0H9v4h1.5z" />,
  },
  youtube: {
    color: '#FF0000',
    path: <path d="M21 8.2a2.5 2.5 0 0 0-1.8-1.8C17.6 6 12 6 12 6s-5.6 0-7.2.4A2.5 2.5 0 0 0 3 8.2 26 26 0 0 0 2.6 12 26 26 0 0 0 3 15.8a2.5 2.5 0 0 0 1.8 1.8C6.4 18 12 18 12 18s5.6 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-3.8 26 26 0 0 0-.4-3.8zM10 14.6V9.4l4.6 2.6z" />,
  },
  instagram: {
    color: '#E1306C',
    path: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="16.8" cy="7.2" r="1.2" />
      </>
    ),
  },
  tiktok: {
    color: '#111111',
    path: <path d="M16.5 3.5c.3 2 1.6 3.5 3.5 3.8v3a7 7 0 0 1-3.5-1.1v6a5.3 5.3 0 1 1-5.3-5.3c.3 0 .6 0 .9.1v3.1a2.3 2.3 0 1 0 1.4 2.1V3.5z" />,
  },
  x: {
    color: '#000000',
    path: <path d="M17.5 4h3l-6.5 7.4L21.7 20h-6l-4.7-6.1L5.6 20h-3l7-8L2.4 4h6.1l4.2 5.6zm-1 14.3h1.6L7.6 5.6H5.8z" />,
  },
  steam: {
    color: '#1B2838',
    path: (
      <>
        <circle cx="15.5" cy="9" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="15.5" cy="9" r="1.5" />
        <circle cx="8.2" cy="15.6" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 13.5l5.7 2.1M10.5 14.3l3.3-2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  discord: {
    color: '#5865F2',
    path: <path d="M19.3 5.6A16 16 0 0 0 15.4 4.4l-.5 1a14.7 14.7 0 0 0-5.8 0l-.5-1a16 16 0 0 0-3.9 1.2C2.2 9.3 1.5 12.9 1.8 16.4a16.2 16.2 0 0 0 4.8 2.4l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3a11.6 11.6 0 0 0 9.9 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.4-4.1-.6-7.7-2.6-10.8zM8.8 14.3c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2zm6.4 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.7 2-1.7 2z" />,
  },
  site: {
    color: '#2F80ED',
    path: (
      <>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 12h16M12 4c2.4 2.4 2.4 13.6 0 16M12 4c-2.4 2.4-2.4 13.6 0 16" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
}

export default function SocialIcon({ network, size = 22 }) {
  const icon = ICONS[network] || ICONS.site
  return (
    <span className="social-icon" style={{ '--sc': icon.color, width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="currentColor">
        {icon.path}
      </svg>
    </span>
  )
}
