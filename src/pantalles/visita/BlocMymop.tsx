// MYMOP a la pestanya «Com està»: dos símptomes, una activitat i el benestar,
// de 0 (el millor) a 6 (el pitjor). Es demana a la primera sessió de l'episodi
// i cada 4 sessions (avís discret quan toca); les altres sessions, si es vol.
// Només es desen els noms que tria la persona i les puntuacions (llicència:
// docs/especificacions.md).

import { useId, useState } from 'react'
import { Boto } from '../../components/Boto'
import { mymopBuit, perfilMymop, tocaMymop, type Mymop } from '../../domini/escales'
import { formatar, t } from '../../i18n/t'

const m = t.mymop

function Escala06({ etiqueta, valor, onCanviar }: { etiqueta: string; valor: number | null; onCanviar(v: number | null): void }) {
  return (
    <div className="escala-mymop" role="radiogroup" aria-label={etiqueta}>
      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} onClick={() => onCanviar(valor === n ? null : n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

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
      <Escala06 etiqueta={formatar(m.puntuacioDe, { nom })} valor={dades[k].puntuacio} onCanviar={(v) => posar({ [k]: { ...dades[k], puntuacio: v } })} />
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
        <span className="nom-camp">{m.benestar}</span>
        <Escala06 etiqueta={m.benestar} valor={dades.benestar} onCanviar={(v) => posar({ benestar: v })} />
      </div>
      <p role="status">
        {perfil !== null && formatar(m.perfil, { n: perfil.toLocaleString('ca') })}
        {perfilAnterior !== null && ` · ${formatar(m.perfilAnterior, { n: perfilAnterior.toLocaleString('ca') })}`}
      </p>
    </section>
  )
}
