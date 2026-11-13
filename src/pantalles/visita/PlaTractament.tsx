// Pla de tractament de l'episodi (etapa 3B): sessions previstes, freqüència,
// objectius, tècniques previstes i data de revisió. Es desa sol a l'episodi;
// les sessions previstes surten a la capçalera de la visita («Sessió 4 de 10»).

import { useId, useMemo } from 'react'
import { Xip } from '../../cataleg/components/Cataleg'
import { FREQUENCIES_PLA, PLA_BUIT, TECNIQUES_PLA, type DadesEpisodi, type Episodi, type Pla } from '../../domini/episodi'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useAutodesat } from './useAutodesat'

const p = t.pla

const dadesDe = (e: Episodi): DadesEpisodi => {
  const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...d } = e
  return d
}

export function PlaTractament({ episodi, editable, onPla }: { episodi: Episodi; editable: boolean; onPla(pla: Pla | null): void }) {
  const magatzem = useMagatzem()
  const id = useId()
  // Estable entre renders: si fos un objecte nou a cada render, en acabar de
  // desar es prendria l'episodi d'en obrir la visita per una versió nova i es
  // tornarien a veure els valors d'abans (el pla «no es deixava canviar»)
  const desat = useMemo(() => dadesDe(episodi), [episodi])
  const { dades, setDades, desant, pendent } = useAutodesat<DadesEpisodi>(
    desat,
    async (d, inicial) => {
      const desat = dadesDe(await magatzem.actualitzarEpisodi(episodi.id, d, inicial))
      onPla(desat.pla)
      return desat
    },
    editable,
  )
  const pla = dades.pla ?? PLA_BUIT
  const canviar = (canvis: Partial<Pla>) => {
    const nou = { ...pla, ...canvis }
    setDades((d) => ({ ...d, pla: nou }))
    onPla(nou)
  }
  return (
    <section className="pla-tractament seccio-cataleg oberta" aria-label={p.titol}>
      <div className="cos-seccio">
        <h2>
          {p.titol} <span className="detall" role="status">{desant ? t.visita.desant : pendent ? '' : t.visita.desat}</span>
        </h2>
        <div className="camp">
          <label htmlFor={`${id}-sessions`}>{p.sessions}</label>
          <input
            id={`${id}-sessions`}
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={pla.sessions ?? ''}
            disabled={!editable}
            onChange={(e) => canviar({ sessions: e.target.value === '' ? null : Math.max(1, Math.min(100, Math.round(Number(e.target.value)))) })}
          />
        </div>
        <div className="camp-xips" role="group" aria-label={p.frequencia}>
          <span className="nom-camp">{p.frequencia}</span>
          <div className="xips">
            {FREQUENCIES_PLA.map((f) => (
              <Xip
                key={f}
                opcio={{ id: f, ca: p.frequencies[f] }}
                triat={pla.frequencia === f}
                disabled={!editable}
                onClick={() => canviar({ frequencia: pla.frequencia === f ? null : f })}
              />
            ))}
          </div>
        </div>
        <div className="camp-xips" role="group" aria-label={p.tecniques}>
          <span className="nom-camp">{p.tecniques}</span>
          <div className="xips">
            {TECNIQUES_PLA.map((x) => (
              <Xip
                key={x}
                opcio={{ id: x, ca: p.nomsTecniques[x] }}
                triat={pla.tecniques.includes(x)}
                disabled={!editable}
                onClick={() => canviar({ tecniques: pla.tecniques.includes(x) ? pla.tecniques.filter((y) => y !== x) : [...pla.tecniques, x] })}
              />
            ))}
          </div>
        </div>
        <div className="camp">
          <label htmlFor={`${id}-objectius`}>{p.objectius}</label>
          <textarea id={`${id}-objectius`} rows={3} value={pla.objectius} disabled={!editable} onChange={(e) => canviar({ objectius: e.target.value })} />
        </div>
        <div className="camp">
          <label htmlFor={`${id}-revisio`}>{p.revisio}</label>
          <input
            id={`${id}-revisio`}
            type="date"
            value={pla.revisio ?? ''}
            disabled={!editable}
            onChange={(e) => canviar({ revisio: e.target.value || null })}
          />
        </div>
      </div>
    </section>
  )
}
