import { useRef, useState } from 'react'

// Imagem do meme com as legendas por cima (texto branco com contorno
// preto, à moda clássica). Em modo de edição, as legendas arrastam-se.
export default function MemeCanvas({ template, captions, editable = false, onMoveCaption, small = false }) {
  const boxRef = useRef(null)
  const [broken, setBroken] = useState(false)
  const drag = useRef(null)

  const pointerDown = (i) => (e) => {
    if (!editable) return
    e.preventDefault()
    drag.current = i
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const pointerMove = (e) => {
    if (drag.current == null || !boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(97, Math.max(3, ((e.clientY - rect.top) / rect.height) * 100))
    onMoveCaption?.(drag.current, Math.round(x), Math.round(y))
  }
  const pointerUp = () => {
    drag.current = null
  }

  return (
    <div
      ref={boxRef}
      className={`meme${small ? ' meme--small' : ''}${editable ? ' meme--editable' : ''}`}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      {broken ? (
        <div className="meme__broken">Não foi possível carregar «{template.name}».</div>
      ) : (
        <img
          src={template.url}
          alt={template.name}
          className="meme__img"
          draggable={false}
          onError={() => setBroken(true)}
          referrerPolicy="no-referrer"
        />
      )}
      {captions.map((c, i) =>
        c.text.trim() || editable ? (
          <span
            key={i}
            className={`meme__caption${!c.text.trim() ? ' meme__caption--empty' : ''}`}
            // A âncora desloca-se com a posição, para o texto nunca sair da imagem.
            style={{ left: `${c.x}%`, top: `${c.y}%`, transform: `translate(-${c.x}%, -${c.y}%)` }}
            onPointerDown={pointerDown(i)}
          >
            {c.text.trim() || `Texto ${i + 1}`}
          </span>
        ) : null
      )}
    </div>
  )
}
