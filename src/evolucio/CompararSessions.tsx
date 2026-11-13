// Comparar dues sessions de l'episodi (etapa 3C), en dues columnes: punts
// (afegits, trets i mantinguts, amb els canvis de tècnica o de costat), escales
// amb la diferència, llengua i pols (només el que ha canviat), retenció i
// incidències. Cada estat porta un signe i un text, no només el color.

import { useState } from 'react'
import { diaDe } from '../domini/cita'
import { canvisExploracio, compararSessions, ordenades, type DiferenciaValor, type SessioEvolucio } from '../domini/evolucio'
import type { PuntMarcat } from '../domini/puntMarcat'
import { diaCurtMes, formatar, t } from '../i18n/t'
import { nomPunt } from './nomPunt'

const e = t.evolucio

function nomSessio(s: SessioEvolucio): string {
  return formatar(e.sessioDia, { n: String(s.numero), dia: diaCurtMes(diaDe(new Date(s.iniciAt))) })
}

const ambSigne = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

function TextPunt({ p, extra }: { p: PuntMarcat; extra?: string }) {
  return (
    <>
      <strong>{p.codi}</strong> <span className="detall">{nomPunt(p.mapa, p.codi)}</span> · {t.mapa.tecnica[p.tecnica]} · {e.costats[p.costat]}
      {extra && <span className="canvi-punt"> ({extra})</span>}
    </>
  )
}

export function CompararSessions({ sessions }: { sessions: readonly SessioEvolucio[] }) {
  const llista = ordenades(sessions)
  const [idA, setIdA] = useState(llista[0]?.id ?? '')
  const [idB, setIdB] = useState(llista.at(-1)?.id ?? '')
  const a = llista.find((s) => s.id === idA) ?? llista[0]
  const b = llista.find((s) => s.id === idB) ?? llista.at(-1)
  if (!a || !b) return null
  // Sempre de la més antiga a la més recent
  const [abans, despres] = a.numero <= b.numero ? [a, b] : [b, a]
  const c = compararSessions(abans, despres)
  const exploracio = canvisExploracio(abans.exploracio.seccions, despres.exploracio.seccions, e.normal, e.observacions)

  const triar = (valor: string, onCanviar: (id: string) => void, etiqueta: string) => (
    <label className="camp tria-sessio">
      <span className="etiqueta-camp">{etiqueta}</span>
      <select value={valor} onChange={(ev) => onCanviar(ev.target.value)}>
        {llista.map((s) => (
          <option key={s.id} value={s.id}>
            {nomSessio(s)}
          </option>
        ))}
      </select>
    </label>
  )

  // Verd i cinabri només a les escales (baixar és millorar); la retenció, en neutre
  const fila = (nom: string, d: DiferenciaValor, unitat = (n: number) => String(n), neutre = false) => (
    <div className="fila-comparar" key={nom}>
      <span className="nom-fila">{nom}</span>
      <span>{d.abans === null ? '—' : unitat(d.abans)}</span>
      <span>
        {d.despres === null ? '—' : unitat(d.despres)}
        {d.diferencia !== null && d.diferencia !== 0 && (
          <span className={`dif ${neutre ? 'neutre' : d.diferencia < 0 ? 'baixa' : 'puja'}`}>
            {' '}
            {formatar(e.diferencia, {
              signe: '',
              // Retenció: «(+8 min)»; escales: «(−5)»
              n: neutre ? `${d.diferencia > 0 ? '+' : '−'}${unitat(Math.abs(d.diferencia))}` : ambSigne(d.diferencia),
            })}
          </span>
        )}
      </span>
    </div>
  )

  return (
    <section className="comparar-sessions" aria-label={e.compararTitol}>
      <div className="tria-sessions">
        {triar(idA, setIdA, e.sessioA)}
        {triar(idB, setIdB, e.sessioB)}
      </div>

      <div className="fila-comparar capcalera-comparar">
        <span />
        <strong>{nomSessio(abans)}</strong>
        <strong>{nomSessio(despres)}</strong>
      </div>

      <h5>{e.seccions.punts}</h5>
      <div className="columnes-comparar">
        <ul className="punts-comparar" aria-label={nomSessio(abans)}>
          {c.trets.map((p) => (
            <li key={`t-${p.mapa}-${p.codi}`} className="tret">
              <span className="signe" aria-hidden="true">−</span>
              <TextPunt p={p} /> <span className="estat-punt">{e.tret}</span>
            </li>
          ))}
          {c.mantinguts.map((m) => (
            <li key={`m-${m.abans.mapa}-${m.abans.codi}`} className="mantingut">
              <span className="signe" aria-hidden="true">=</span>
              <TextPunt p={m.abans} />
            </li>
          ))}
          {c.trets.length + c.mantinguts.length === 0 && <li className="detall">{e.capPuntComparar}</li>}
        </ul>
        <ul className="punts-comparar" aria-label={nomSessio(despres)}>
          {c.afegits.map((p) => (
            <li key={`a-${p.mapa}-${p.codi}`} className="afegit">
              <span className="signe" aria-hidden="true">+</span>
              <TextPunt p={p} /> <span className="estat-punt">{e.afegit}</span>
            </li>
          ))}
          {c.mantinguts.map((m) => {
            const canvis = [
              m.canviTecnica && formatar(e.abansEra, { que: t.mapa.tecnica[m.abans.tecnica].toLowerCase() }),
              m.canviCostat && formatar(e.abansEra, { que: e.costats[m.abans.costat] }),
            ].filter(Boolean)
            return (
              <li key={`m-${m.despres.mapa}-${m.despres.codi}`} className={`mantingut${canvis.length ? ' amb-canvi' : ''}`}>
                <span className="signe" aria-hidden="true">{canvis.length ? '≠' : '='}</span>
                <TextPunt p={m.despres} extra={canvis.join(', ') || undefined} />
              </li>
            )
          })}
          {c.afegits.length + c.mantinguts.length === 0 && <li className="detall">{e.capPuntComparar}</li>}
        </ul>
      </div>

      <h5>{e.seccions.escales}</h5>
      {fila(e.principal, c.principal)}
      {c.secundari1.nom && fila(c.secundari1.nom, c.secundari1)}
      {c.secundari2.nom && fila(c.secundari2.nom, c.secundari2)}

      <h5>{e.seccions.exploracio}</h5>
      {exploracio.length === 0 ? (
        <p className="detall">{e.capCanviExploracio}</p>
      ) : (
        exploracio.map((x) => (
          <div className="fila-comparar" key={`${x.seccio}-${x.camp}`}>
            <span className="nom-fila">
              {x.seccio} · {x.camp}
            </span>
            <span>{x.abans || '—'}</span>
            <span>{x.despres || '—'}</span>
          </div>
        ))
      )}

      <h5>{e.seccions.retencio}</h5>
      {fila(e.retencio, c.retencio, (n) => formatar(e.minuts, { n: String(n) }), true)}
      <div className="fila-comparar">
        <span className="nom-fila">{e.incidencies}</span>
        <span>{c.incidencies.abans || e.capIncidencia}</span>
        <span>{c.incidencies.despres || e.capIncidencia}</span>
      </div>
    </section>
  )
}
