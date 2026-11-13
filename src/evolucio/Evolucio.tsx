// Apartat «Evolució» d'un episodi (etapa 3C): el gràfic de l'escala principal
// amb el resum («De 7 a 3 en 6 sessions (−57 %)»), els secundaris opcionals,
// les altres escales (plegades) i els punts més usats. Amb una sola sessió,
// un missatge suau en lloc d'un gràfic buit.

import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  nomsSecundaris,
  ordenades,
  resumEscala,
  serieEscalaOrl,
  serieEvolucio,
  serieMymop,
  seriePgic,
  type IdEscalaEvolucio,
  type PuntEscala,
  type SessioEvolucio,
} from '../domini/evolucio'
import type { Valoracio } from '../domini/valoracio'
import { formatar, t } from '../i18n/t'
import { GraficEscala, MostraSerie, type SerieGrafic } from './GraficEscala'
import { PuntsMesUsats } from './PuntsMesUsats'
import { textResum } from './textos'

const e = t.evolucio

interface Props {
  sessions: readonly SessioEvolucio[]
  sessionsPacient: readonly SessioEvolucio[]
  valoracions: readonly Valoracio[]
}

export function Evolucio({ sessions, sessionsPacient, valoracions }: Props) {
  const navegar = useNavigate()
  const [secundaris, setSecundaris] = useState(false)
  const llista = ordenades(sessions)
  if (llista.length < 2) return <p className="evolucio-buida">{e.unaSessio}</p>

  const serie = serieEvolucio(llista)
  const noms = nomsSecundaris(llista)
  const resum = resumEscala(serie.map((p) => ({ numero: p.numero, valor: p.principal })))
  const hiHaSecundaris = serie.some((p) => p.secundari1 !== null || p.secundari2 !== null)
  const series: SerieGrafic[] = [
    { id: 'principal', nom: e.principal, valors: serie.map((p) => p.principal), forma: 'cercle', classe: 'serie-principal' },
  ]
  if (secundaris && serie.some((p) => p.secundari1 !== null))
    series.push({ id: 's1', nom: noms.secundari1 || formatar(e.secundari, { n: '1' }), valors: serie.map((p) => p.secundari1), forma: 'quadrat', classe: 'serie-2' })
  if (secundaris && serie.some((p) => p.secundari2 !== null))
    series.push({ id: 's2', nom: noms.secundari2 || formatar(e.secundari, { n: '2' }), valors: serie.map((p) => p.secundari2), forma: 'triangle', classe: 'serie-3' })

  const altres: { id: IdEscalaEvolucio; punts: PuntEscala[]; max: number; min?: number }[] = [
    { id: 'thi' as const, punts: serieEscalaOrl('thi', valoracions, llista), max: 100 },
    { id: 'dhi' as const, punts: serieEscalaOrl('dhi', valoracions, llista), max: 100 },
    { id: 'snot22' as const, punts: serieEscalaOrl('snot22', valoracions, llista), max: 110 },
    { id: 'nasal010' as const, punts: serieEscalaOrl('nasal010', valoracions, llista), max: 10 },
    { id: 'mymop' as const, punts: serieMymop(llista), max: 6 },
    { id: 'pgic' as const, punts: seriePgic(llista), max: 7, min: 1 },
  ].filter((x) => x.punts.length > 0)

  const obrir = (id: string) => void navegar(`/visita/${id}`)

  return (
    <div className="evolucio">
      <section className="bloc-evolucio" aria-label={e.escalaPrincipal}>
        <h4>{e.escalaPrincipal}</h4>
        <p className="resum-evolucio" data-testid="resum-evolucio">
          {resum ? textResum(resum) : e.senseEscala}
        </p>
        <GraficEscala
          titol={e.escalaPrincipal}
          columnes={serie.map((p) => ({ numero: p.numero, dia: p.dia, sessioId: p.sessioId }))}
          series={series}
          min={0}
          max={10}
          marques={serie.map((p) => p.canviTractament)}
          onObrir={obrir}
          detall={(i) => {
            const p = serie[i]!
            return (
              <>
                <span className="linia-globus">
                  {formatar(e.puntsN, { n: String(p.punts) })} · {p.retencio === null ? e.senseRetencio : formatar(e.retencioN, { n: String(p.retencio) })}
                </span>
                {p.canviTractament && <span className="linia-globus">◇ {e.canviTractament}</span>}
              </>
            )
          }}
        />
        <div className="llegenda-grafic">
          {series.map((s) => (
            <span key={s.id}>
              <MostraSerie serie={s} /> {s.nom}
            </span>
          ))}
          {serie.some((p) => p.canviTractament) && (
            <span>
              <svg className="mostra-serie" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path className="marca-canvi" d="M7 2 l5 5 l-5 5 l-5 -5 z" />
              </svg>{' '}
              {e.canviTractamentDetall}
            </span>
          )}
          {hiHaSecundaris && (
            <label className="interruptor">
              <input type="checkbox" role="switch" checked={secundaris} onChange={(ev) => setSecundaris(ev.target.checked)} />
              {e.mostrarSecundaris}
            </label>
          )}
        </div>
      </section>

      {altres.length > 0 && (
        <section className="bloc-evolucio altres-escales" aria-label={e.altresEscales}>
          <h4>{e.altresEscales}</h4>
          {altres.map((x) => (
            <details key={x.id} className="escala-petita">
              <summary>
                {e.escales[x.id]}
                {(() => {
                  // PGIC: nivells, no una puntuació (el percentatge no hi té sentit): l'últim, amb el nom
                  if (x.id === 'pgic') {
                    const darrer = x.punts.at(-1)!.valor
                    return <span className="detall">&nbsp;· {formatar(t.pgic.triat, { n: String(darrer), nom: t.pgic.nivells[darrer] ?? '' })}</span>
                  }
                  const r = resumEscala(x.punts)
                  return r ? <span className="detall">&nbsp;· {textResum(r)}</span> : null
                })()}
              </summary>
              <GraficEscala
                titol={e.escales[x.id]}
                columnes={x.punts.map((p) => ({ numero: p.numero, dia: p.dia, sessioId: p.sessioId }))}
                series={[{ id: x.id, nom: e.escales[x.id], valors: x.punts.map((p) => p.valor), forma: 'cercle', classe: 'serie-principal' }]}
                min={x.min ?? 0}
                max={x.max}
                onObrir={obrir}
                alcada={160}
              />
            </details>
          ))}
        </section>
      )}

      <PuntsMesUsats sessionsEpisodi={llista} sessionsPacient={sessionsPacient} />
    </div>
  )
}
