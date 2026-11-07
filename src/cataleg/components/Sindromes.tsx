// Síndromes (patrons) de la CIM-11, capítol 26 (Traditional Medicine Module 1):
// cercador amb autocompletat i el codi. Els títols són els oficials en anglès
// (la llicència CC BY-ND no en permet la traducció), però es pot cercar en
// català: les paraules es passen per un glossari («melsa qi» → «spleen qi»).

import { useState } from 'react'
import { formatar, t } from '../../i18n/t'
import dades from '../dades/cim11-tm1.json'

export interface Patro {
  codi: string
  titol: string
  tipus: 'patro' | 'trastorn'
  grup: string
  bloc: string
  residual: boolean
}

export const PATRONS: readonly Patro[] = (dades as Patro[]).filter((p) => p.tipus === 'patro' && !p.residual)

/** Català → anglès de la CIM-11 (per cercar; no es mostra) */
const GLOSSARI: Record<string, string> = {
  melsa: 'spleen',
  fetge: 'liver',
  ronyo: 'kidney',
  ronyons: 'kidney',
  cor: 'heart',
  pulmo: 'lung',
  pulmons: 'lung',
  estomac: 'stomach',
  vesicula: 'gallbladder',
  bufeta: 'bladder',
  intesti: 'intestine',
  gros: 'large',
  prim: 'small',
  pericardi: 'pericardium',
  escalfador: 'energizer',
  sang: 'blood',
  humitat: 'dampness',
  humida: 'dampness',
  calor: 'heat',
  fred: 'cold',
  vent: 'wind',
  sequedat: 'dryness',
  flegma: 'phlegm',
  estasi: 'stasis',
  estancament: 'stagnation',
  deficiencia: 'deficiency',
  buit: 'deficiency',
  exces: 'excess',
  ple: 'excess',
  foc: 'fire',
  liquids: 'fluid',
  essencia: 'essence',
  meridia: 'meridian',
  ascens: 'rising',
  hiperactivitat: 'hyperactivity',
  enfonsament: 'sinking',
  desharmonia: 'disharmony',
  orella: 'ear',
  orelles: 'ear',
  acufens: 'tinnitus',
  mareig: 'dizziness',
  vertigen: 'vertigo',
}

const normalitzar = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** Codis que comencen per la consulta, i títols que contenen totes les paraules (traduïdes si cal) */
export function cercarPatrons(consulta: string, max = 10): Patro[] {
  const q = normalitzar(consulta.trim())
  if (q.length < 2) return []
  const paraules = q.split(/\s+/).map((p) => GLOSSARI[p] ?? p)
  return PATRONS.filter((p) => {
    if (p.codi.toLowerCase().startsWith(q)) return true
    const titol = normalitzar(p.titol)
    return paraules.every((x) => titol.includes(x))
  })
    .sort((a, b) => a.titol.length - b.titol.length)
    .slice(0, max)
}

type Triat = { codi: string; titol: string }
const esTriat = (v: unknown): v is Triat => !!v && typeof v === 'object' && typeof (v as Triat).codi === 'string'

function Cercador({ etiqueta, onTriar }: { etiqueta: string; onTriar(p: Triat): void }) {
  const [consulta, setConsulta] = useState('')
  const resultats = cercarPatrons(consulta)
  const c = t.cataleg
  return (
    <div className="cercador-codi">
      <input type="search" aria-label={etiqueta} placeholder={c.cercarSindrome} value={consulta} onChange={(e) => setConsulta(e.target.value)} />
      {consulta.trim().length >= 2 && (
        <ul className="llista-codis" aria-label={etiqueta}>
          {resultats.length === 0 && <li className="detall">{c.capSindrome}</li>}
          {resultats.map((r) => (
            <li key={r.codi}>
              <button
                type="button"
                onClick={() => {
                  onTriar({ codi: r.codi, titol: r.titol })
                  setConsulta('')
                }}
              >
                <strong>{r.codi}</strong> {r.titol}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Triada({ p, editable, onTreure }: { p: Triat; editable: boolean; onTreure(): void }) {
  return (
    <li className="codi-triat">
      <span className="xip" aria-pressed="true">
        <strong>{p.codi}</strong> {p.titol}
      </span>
      {editable && (
        <button type="button" className="boto boto-discret" aria-label={formatar(t.cataleg.treureCodi, { codi: p.codi })} onClick={onTreure}>
          ✕
        </button>
      )}
    </li>
  )
}

/** «principal»: una sola síndrome; «secundaries»: diverses (codi → títol) */
export function Sindromes({
  mode,
  etiqueta,
  valor,
  onCanviar,
  editable,
}: {
  mode: 'principal' | 'secundaries'
  etiqueta: string
  valor: unknown
  onCanviar(v: Triat | Record<string, string> | null): void
  editable: boolean
}) {
  if (mode === 'principal') {
    return (
      <div className="sindromes">
        {esTriat(valor) ? (
          <ul className="llista-sindromes">
            <Triada p={valor} editable={editable} onTreure={() => onCanviar(null)} />
          </ul>
        ) : (
          editable && <Cercador etiqueta={etiqueta} onTriar={(p) => onCanviar(p)} />
        )}
      </div>
    )
  }
  const totes = valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, string>) : {}
  return (
    <div className="sindromes">
      {Object.keys(totes).length > 0 && (
        <ul className="llista-sindromes">
          {Object.entries(totes).map(([codi, titol]) => (
            <Triada
              key={codi}
              p={{ codi, titol }}
              editable={editable}
              onTreure={() => {
                const r = { ...totes }
                delete r[codi]
                onCanviar(Object.keys(r).length > 0 ? r : null)
              }}
            />
          ))}
        </ul>
      )}
      {editable && <Cercador etiqueta={etiqueta} onTriar={(p) => onCanviar({ ...totes, [p.codi]: p.titol })} />}
    </div>
  )
}
