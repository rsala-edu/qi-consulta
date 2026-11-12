// Escala 0–10 de l'app: una barra horitzontal d'11 caselles en una sola fila,
// amb un degradat suau de jade (0) a cinabri (10). El valor triat, ben marcat;
// el de l'última sessió, amb un punt petit a la seva casella. Es tria tocant o
// lliscant el dit (o amb les fletxes del teclat); tocar el valor triat el treu.

import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { formatar, t } from '../i18n/t'

interface Props {
  etiqueta: string
  valor: number | null
  /** El de l'última sessió (punt petit a la casella) */
  anterior?: number | null
  onCanviar(v: number | null): void
  disabled?: boolean
  min?: number
  max?: number
}

/** Moviment mínim (px) perquè un toc passi a ser lliscar */
const LLISCAR = 6

export function BarraEscala({ etiqueta, valor, anterior = null, onCanviar, disabled = false, min = 0, max = 10 }: Props) {
  const barra = useRef<HTMLDivElement>(null)
  const gest = useRef<{ x: number; mogut: boolean } | null>(null)
  const valors = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const inactiu = () => disabled || !!barra.current?.closest('fieldset:disabled')

  const valorA = (clientX: number) => {
    const r = barra.current!.getBoundingClientRect()
    const i = Math.floor(((clientX - r.left) / r.width) * valors.length)
    return valors[Math.max(0, Math.min(valors.length - 1, i))]!
  }

  const baixar = (e: PointerEvent<HTMLDivElement>) => {
    if (inactiu() || e.button !== 0) return
    gest.current = { x: e.clientX, mogut: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moure = (e: PointerEvent<HTMLDivElement>) => {
    const g = gest.current
    if (!g) return
    if (!g.mogut && Math.abs(e.clientX - g.x) < LLISCAR) return
    g.mogut = true
    const v = valorA(e.clientX)
    if (v !== valor) onCanviar(v)
  }
  const aixecar = (e: PointerEvent<HTMLDivElement>) => {
    const g = gest.current
    gest.current = null
    if (!g || g.mogut) return
    const v = valorA(e.clientX)
    onCanviar(v === valor ? null : v)
  }

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (inactiu()) return
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    const nou = pas ? Math.max(min, Math.min(max, (valor ?? (pas > 0 ? min - 1 : max + 1)) + pas)) : e.key === 'Home' ? min : e.key === 'End' ? max : null
    if (nou === null) return
    e.preventDefault()
    onCanviar(nou)
    barra.current?.querySelector<HTMLButtonElement>(`[data-valor="${nou}"]`)?.focus()
  }

  return (
    <div className="camp barra-escala">
      <div className="capcalera-escala">
        <span className="etiqueta-camp">{etiqueta}</span>
        {anterior !== null && (
          <span className="detall escala-anterior">
            <span className="punt-anterior" aria-hidden="true" /> {formatar(t.visita.escalaAnterior, { n: String(anterior) })}
          </span>
        )}
      </div>
      <div
        ref={barra}
        className={`caselles-escala${disabled ? ' inactiva' : ''}`}
        role="radiogroup"
        aria-label={etiqueta}
        onPointerDown={baixar}
        onPointerMove={moure}
        onPointerUp={aixecar}
        onPointerCancel={() => (gest.current = null)}
        onKeyDown={tecla}
      >
        {valors.map((n, i) => (
          <button
            key={n}
            type="button"
            role="radio"
            data-valor={n}
            aria-checked={valor === n}
            tabIndex={(valor ?? min) === n ? 0 : -1}
            disabled={disabled}
            className={`casella-escala${valor === n ? ' triada' : ''}`}
            style={{ '--p': `${Math.round((i / (valors.length - 1)) * 100)}%` } as CSSProperties}
            // Amb el ratolí o el dit ho fan baixar/aixecar; el clic només compta des del teclat
            onClick={(e) => e.detail === 0 && !inactiu() && onCanviar(valor === n ? null : n)}
          >
            {n}
            {anterior === n && <span className="punt-anterior" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}
