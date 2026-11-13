// PGIC a la pestanya «Com està»: com està la persona, en conjunt, des que va
// començar el tractament, de 1 (molt millor) a 7 (molt pitjor). Es demana com
// el MYMOP (a la primera sessió i cada 4); les altres sessions, si es vol.
// Etiquetes pròpies en català (llicència: docs/especificacions.md).

import { useState } from 'react'
import { BarraEscala } from '../../components/BarraEscala'
import { Boto } from '../../components/Boto'
import { tocaPgic } from '../../domini/escales'
import { formatar, t } from '../../i18n/t'

const p = t.pgic

export function BlocPgic({
  numero,
  valor,
  anterior,
  disabled,
  onCanviar,
}: {
  numero: number
  valor: number | null
  anterior: number | null
  disabled?: boolean
  onCanviar(v: number | null): void
}) {
  const toca = tocaPgic(numero)
  const [obert, setObert] = useState(false)
  if (valor === null && !toca && !obert) {
    return (
      <p className="accions accions-esquerra">
        <Boto variant="discret" onClick={() => setObert(true)}>
          {p.afegir}
        </Boto>
      </p>
    )
  }
  return (
    <section className="bloc-pgic" aria-label={p.nom}>
      <h2>{p.nom}</h2>
      {toca && valor === null && <p className="avis-suau" role="note">{formatar(p.toca, { n: String(numero) })}</p>}
      <p className="detall">{p.explicacio}</p>
      {/* El mateix component que l'escala 0–10, amb el rang 1–7 */}
      <BarraEscala etiqueta={p.escala} min={1} max={7} valor={valor} anterior={anterior} disabled={disabled} onCanviar={onCanviar} />
      <p role="status">{valor !== null && formatar(p.triat, { n: String(valor), nom: p.nivells[valor] ?? '' })}</p>
    </section>
  )
}
