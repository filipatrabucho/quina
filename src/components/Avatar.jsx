import { useEffect, useState } from 'react'
import { generatedAvatarUri, generatedAvatarUriSync } from '../lib/avatar.js'

export function useGeneratedAvatar(seed) {
  const [uri, setUri] = useState(() => (seed ? generatedAvatarUriSync(seed) : null))
  useEffect(() => {
    if (!seed) {
      setUri(null)
      return undefined
    }
    let alive = true
    generatedAvatarUri(seed).then((u) => alive && setUri(u))
    return () => {
      alive = false
    }
  }, [seed])
  return uri
}

// Mostra a foto/URL se houver; senão o boneco gerado a partir da seed;
// senão a inicial do nome.
export default function Avatar({ src, seed, name, size = 32, className = '' }) {
  const [broken, setBroken] = useState(false)
  const generated = useGeneratedAvatar(!src || broken ? seed : null)
  const finalSrc = (!broken && src) || generated
  const style = { width: size, height: size }
  if (finalSrc) {
    return <img src={finalSrc} alt="" className={`avatar ${className}`} style={style} onError={() => setBroken(true)} />
  }
  return (
    <span className={`avatar avatar--initial ${className}`} style={{ ...style, fontSize: size * 0.45 }}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}
