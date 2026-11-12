// Llegenda dels colors de les tècniques, sota el mapa (cos i orella). On no hi
// ha alçada per mostrar-la sempre (pestanya Tractament, pantalles baixes), el
// CSS l'amaga i mostra el botó «ⓘ Colors», que l'obre en un globus petit.

import { useEffect, useId, useRef, useState } from 'react'
import { COLOR_TECNICA, type Tecnica } from '../../domini/puntMarcat'
import { t } from '../../i18n/t'

export function LlegendaColors({ tecniques }: { tecniques: readonly { tecnica: Tecnica; nom: string }[] }) {
  const [oberta, setOberta] = useState(false)
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)

  // Es tanca en tocar fora o amb Esc
  useEffect(() => {
    if (!oberta) return
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setOberta(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setOberta(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [oberta])

  return (
    <div ref={caixa} className="llegenda-colors">
      <button type="button" className="boto-colors" aria-expanded={oberta} aria-controls={id} onClick={() => setOberta((o) => !o)}>
        {t.mapa.colors}
      </button>
      <ul id={id} className={`llegenda${oberta ? ' oberta' : ''}`} aria-label={t.mapa.tecnicaTitol}>
        {tecniques.map(({ tecnica, nom }) => (
          <li key={tecnica}>
            <span className="punt-color" style={{ background: COLOR_TECNICA[tecnica] }} />
            {nom}
          </li>
        ))}
      </ul>
    </div>
  )
}
