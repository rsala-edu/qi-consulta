// MYMOP a la pestanya «Com està»: dos símptomes, una activitat i el benestar,
// de 0 (el millor) a 6 (el pitjor). Es demana a la primera sessió de l'episodi
// i cada 4 sessions (avís discret quan toca); les altres sessions, si es vol.
// Només es desen els noms que tria la persona i les puntuacions (llicència:
// docs/especificacions.md).

import { useId, useState } from 'react'
import { BarraEscala } from '../../components/BarraEscala'
import { Boto } from '../../components/Boto'
import { mymopBuit, perfilMymop, tocaMymop, type Mymop } from '../../domini/escales'
import { formatar, t } from '../../i18n/t'

const m = t.mymop

export function BlocMymop({
  numero,
  mymop,
  anterior,
  onCanviar,
}: {
  numero: number
  mymop: Mymop | null
  anterior: Mymop | null
  onCanviar(m: Mymop | null): void
}) {
  const id = useId()
  const toca = tocaMymop(numero)
  const [obert, setObert] = useState(false)
  if (!mymop && !toca && !obert) {
    return (
      <p className="accions accions-esquerra">
        <Boto variant="discret" onClick={() => setObert(true)}>
          {m.afegir}
        </Boto>
      </p>
    )
  }
  const dades = mymop ?? mymopBuit(anterior)
  const posar = (canvis: Partial<Mymop>) => onCanviar({ ...dades, ...canvis })
  const perfil = perfilMymop(mymop)
  const perfilAnterior = perfilMymop(anterior)
  const fila = (k: 'simptoma1' | 'simptoma2' | 'activitat', nom: string) => (
    <div className="fila-mymop">
      <div className="camp">
        <label htmlFor={`${id}-${k}`}>{nom}</label>
        <input id={`${id}-${k}`} value={dades[k].nom} onChange={(e) => posar({ [k]: { ...dades[k], nom: e.target.value } })} />
      </div>
      {/* El mateix component que l'escala 0–10, amb el rang 0–6 */}
      <BarraEscala
        etiqueta={formatar(m.puntuacioDe, { nom })}
        etiquetaVisible={m.puntuacio}
        min={0}
        max={6}
        valor={dades[k].puntuacio}
        anterior={anterior?.[k].puntuacio ?? null}
        onCanviar={(v) => posar({ [k]: { ...dades[k], puntuacio: v } })}
      />
    </div>
  )
  return (
    <section className="bloc-mymop" aria-label={m.titol}>
      <h2>{m.titol}</h2>
      {toca && !mymop && <p className="avis-suau" role="note">{formatar(m.toca, { n: String(numero) })}</p>}
      <p className="detall">{m.explicacio}</p>
      {fila('simptoma1', m.simptoma1)}
      {fila('simptoma2', m.simptoma2)}
      {fila('activitat', m.activitat)}
      <div className="fila-mymop">
        <BarraEscala
          etiqueta={m.benestar}
          etiquetaVisible={`${m.benestar} (0–6)`}
          min={0}
          max={6}
          valor={dades.benestar}
          anterior={anterior?.benestar ?? null}
          onCanviar={(v) => posar({ benestar: v })}
        />
      </div>
      <p role="status">
        {perfil !== null && formatar(m.perfil, { n: perfil.toLocaleString('ca') })}
        {perfilAnterior !== null && ` · ${formatar(m.perfilAnterior, { n: perfilAnterior.toLocaleString('ca') })}`}
      </p>
    </section>
  )
}
