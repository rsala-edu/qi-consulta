// Seccions dels catàlegs a la pantalla: plegables, amb xips per tocar,
// «Normal / sense alteracions» i «Altres / observacions». A les sessions de
// seguiment, el que hi havia a l'última surt en gris amb «Igual que l'última».

import { useId, useState, type ReactNode } from 'react'
import { formatar, t } from '../../i18n/t'
import {
  ambAltres,
  ambCamp,
  ambSeccio,
  campsVisibles,
  canviarNormal,
  esBuida,
  opcionsVisibles,
  resumSeccio,
  seccionsVisibles,
  tocarOpcio,
  type AjustosCatalegs,
  type Context,
} from '../motor'
import type { Camp, CampEspecial, CampGraella, DadesSeccio, DadesSeccions, Grup, Opcio, Seccio, TermeXines, ValorCamp } from '../tipus'

const c = t.cataleg

export const xines = (x: TermeXines) => [x.pinyin, x.hanzi].filter(Boolean).join(' ')

/** Components propis d'alguns camps (dibuix de la llengua, audiograma, codis CIM…) */
export type Especials = Partial<
  Record<CampEspecial['component'], (p: { seccio: Seccio; camp: CampEspecial; valor: ValorCamp | undefined; onCanviar(v: ValorCamp): void; editable: boolean }) => ReactNode>
>

interface PropsGrup {
  grup: Grup
  seccions: DadesSeccions
  onCanviar(seccions: Record<string, DadesSeccio>): void
  ajustos: AjustosCatalegs
  context?: Context
  /** Els valors de l'última sessió (seguiment) */
  anteriors?: DadesSeccions
  editable: boolean
  especials?: Especials
  /** Títol del grup visible (si n'hi ha més d'un a la pestanya) */
  ambTitol?: boolean
}

export function GrupCataleg({ grup, seccions, onCanviar, ajustos, context, anteriors, editable, especials, ambTitol }: PropsGrup) {
  const visibles = seccionsVisibles(grup, ajustos, seccions, context)
  return (
    <section className="grup-cataleg" aria-label={grup.ca}>
      {ambTitol && <h2>{grup.ca}</h2>}
      {visibles.map((s) => (
        <SeccioCataleg
          key={s.id}
          seccio={s}
          dades={seccions[s.id]}
          anterior={anteriors?.[s.id]}
          ajustos={ajustos}
          editable={editable}
          especials={especials}
          onCanviar={(d) => onCanviar(ambSeccio(seccions, s.id, d))}
        />
      ))}
    </section>
  )
}

interface PropsSeccio {
  seccio: Seccio
  dades: DadesSeccio | undefined
  anterior?: DadesSeccio
  ajustos: AjustosCatalegs
  editable: boolean
  especials?: Especials
  onCanviar(d: DadesSeccio | undefined): void
}

export function SeccioCataleg({ seccio, dades, anterior, ajustos, editable, especials, onCanviar }: PropsSeccio) {
  const [oberta, setOberta] = useState(false)
  const resum = resumSeccio(seccio, dades, c.normal)
  const resumAnterior = anterior ? resumSeccio(seccio, anterior, c.normal) : ''
  const id = `seccio-${seccio.id.replace(/\W/g, '-')}`
  return (
    <div className={`seccio-cataleg${oberta ? ' oberta' : ''}${dades?.normal ? ' normal' : ''}`}>
      <h3 className="capcalera-seccio">
        <button type="button" aria-expanded={oberta} aria-controls={id} onClick={() => setOberta((x) => !x)}>
          <span className="nom-seccio">
            {seccio.ca}
            {(seccio.pinyin || seccio.hanzi) && <span className="xines"> {xines(seccio)}</span>}
          </span>
          {resum ? (
            <span className="resum-seccio">{resum}</span>
          ) : resumAnterior ? (
            <span className="resum-seccio anterior">{formatar(c.ultima, { resum: resumAnterior })}</span>
          ) : null}
        </button>
      </h3>
      {oberta && (
        <div id={id} className="cos-seccio" role="region" aria-label={seccio.ca}>
          {(!seccio.senseNormal || (anterior && !esBuida(anterior))) && (
            <div className="accions-seccio">
              {!seccio.senseNormal && (
                <button
                  type="button"
                  className="xip xip-normal"
                  aria-pressed={!!dades?.normal}
                  disabled={!editable}
                  onClick={() => onCanviar(canviarNormal(dades))}
                >
                  {c.normal}
                </button>
              )}
              {anterior && !esBuida(anterior) && (
                <button type="button" className="boto boto-discret" disabled={!editable} onClick={() => onCanviar(structuredClone(anterior))}>
                  {c.igualQueUltima}
                </button>
              )}
            </div>
          )}
          {resumAnterior && <p className="anterior">{formatar(c.ultima, { resum: resumAnterior })}</p>}
          {campsVisibles(seccio, ajustos, dades).map((camp) => (
            <CampCataleg
              key={camp.id}
              seccio={seccio}
              camp={camp}
              dades={dades}
              ajustos={ajustos}
              editable={editable}
              especials={especials}
              onCanviar={onCanviar}
            />
          ))}
          <div className="camp">
            <label htmlFor={`${id}-altres`}>{c.altres}</label>
            <textarea
              id={`${id}-altres`}
              rows={2}
              value={dades?.altres ?? ''}
              disabled={!editable}
              onChange={(e) => onCanviar(ambAltres(dades, e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CampCataleg({
  seccio,
  camp,
  dades,
  ajustos,
  editable,
  especials,
  onCanviar,
}: Omit<PropsSeccio, 'anterior'> & { camp: Camp }) {
  const valor = dades?.valors?.[camp.id]
  const idCamp = useId()
  const nom = (
    <>
      {camp.ca}
      {(camp.pinyin || camp.hanzi) && <span className="xines"> {xines(camp)}</span>}
    </>
  )
  if (camp.tipus === 'simple' || camp.tipus === 'multiple') {
    const triats = new Set(typeof valor === 'string' ? [valor] : Array.isArray(valor) ? (valor as string[]) : [])
    return (
      <div className="camp-xips" role="group" aria-label={camp.ca}>
        <span className="nom-camp">{nom}</span>
        {camp.ajuda && <span className="detall">{camp.ajuda}</span>}
        <div className="xips">
          {opcionsVisibles(seccio, camp, ajustos, valor).map((op) => (
            <Xip key={op.id} opcio={op} triat={triats.has(op.id)} ambXines={camp.xines} disabled={!editable} onClick={() => onCanviar(tocarOpcio(dades, camp, op.id))} />
          ))}
        </div>
      </div>
    )
  }
  if (camp.tipus === 'graella') {
    return <Graella camp={camp} valor={valor} editable={editable} onCanviar={(v) => onCanviar(ambCamp(dades, camp.id, v))} />
  }
  if (camp.tipus === 'especial') {
    const E = especials?.[camp.component]
    return (
      <div className="camp-especial">
        <span className="nom-camp">{nom}</span>
        {E ? E({ seccio, camp, valor, editable, onCanviar: (v) => onCanviar(ambCamp(dades, camp.id, v)) }) : null}
      </div>
    )
  }
  const text = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : ''
  // Etiqueta amb htmlFor (no embolcallant el camp): si no, el nom accessible inclouria el valor
  return (
    <div className="camp">
      <label htmlFor={idCamp}>{nom}</label>
      {camp.ajuda && <span className="detall">{camp.ajuda}</span>}
      {camp.tipus === 'textLlarg' ? (
        <textarea id={idCamp} rows={3} value={text} disabled={!editable} onChange={(e) => onCanviar(ambCamp(dades, camp.id, e.target.value))} />
      ) : camp.tipus === 'nombre' ? (
        <span className="nombre-unitat">
          <input
            id={idCamp}
            type="number"
            inputMode="decimal"
            min={camp.min}
            max={camp.max}
            value={text}
            disabled={!editable}
            onChange={(e) => onCanviar(ambCamp(dades, camp.id, e.target.value === '' ? null : Number(e.target.value)))}
          />
          {camp.unitat && <span>{camp.unitat}</span>}
        </span>
      ) : (
        <input
          id={idCamp}
          type={camp.tipus === 'data' ? 'date' : 'text'}
          value={text}
          disabled={!editable}
          onChange={(e) => onCanviar(ambCamp(dades, camp.id, e.target.value))}
        />
      )}
    </div>
  )
}

export function Xip({ opcio, triat, ambXines, disabled, onClick }: { opcio: Opcio; triat: boolean; ambXines?: boolean; disabled?: boolean; onClick(): void }) {
  const x = xines(opcio)
  return (
    <button type="button" className="xip" aria-pressed={triat} disabled={disabled} title={x || undefined} onClick={onClick}>
      {opcio.ca}
      {ambXines && x && <span className="xines">{x}</span>}
    </button>
  )
}

/** Graella (files × columnes), cada casella amb opcions múltiples: es toca una casella i surten els xips */
function Graella({ camp, valor, editable, onCanviar }: { camp: CampGraella; valor: ValorCamp | undefined; editable: boolean; onCanviar(v: ValorCamp): void }) {
  const caselles = (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}) as Record<string, string[]>
  const [activa, setActiva] = useState<string | null>(null)
  const nom = (id: string) => camp.opcions.find((x) => x.id === id)?.ca ?? id
  const triats = activa ? new Set(caselles[activa] ?? []) : new Set<string>()
  const etiquetaCasella = (f: Opcio, col: Opcio) => `${f.ca} · ${col.ca}`
  return (
    <div className="camp-graella" role="group" aria-label={camp.ca}>
      <span className="nom-camp">{camp.ca}</span>
      <table className="graella">
        <thead>
          <tr>
            <th />
            {camp.columnes.map((col) => (
              <th key={col.id} scope="col" title={xines(col) || undefined}>
                {col.ca}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {camp.files.map((f) => (
            <tr key={f.id}>
              <th scope="row" title={xines(f) || undefined}>
                {f.ca}
              </th>
              {camp.columnes.map((col) => {
                const k = `${f.id}_${col.id}`
                const llista = caselles[k] ?? []
                return (
                  <td key={col.id}>
                    <button
                      type="button"
                      className="casella-graella"
                      aria-pressed={activa === k}
                      aria-label={etiquetaCasella(f, col)}
                      onClick={() => setActiva(activa === k ? null : k)}
                    >
                      {llista.length > 0 ? llista.map(nom).join(', ') : '—'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {activa && (
        <div className="xips" role="group" aria-label={(() => {
          const [fi, ci] = activa.split('_')
          const f = camp.files.find((x) => x.id === fi)!
          const col = camp.columnes.find((x) => x.id === ci)!
          return etiquetaCasella(f, col)
        })()}>
          {camp.opcions.map((op) => (
            <Xip
              key={op.id}
              opcio={op}
              triat={triats.has(op.id)}
              ambXines={camp.xines}
              disabled={!editable}
              onClick={() => {
                const actual = caselles[activa] ?? []
                const nova = actual.includes(op.id) ? actual.filter((x) => x !== op.id) : [...actual, op.id]
                const totes = { ...caselles, [activa]: nova }
                if (nova.length === 0) delete totes[activa]
                onCanviar(Object.keys(totes).length > 0 ? totes : null)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
