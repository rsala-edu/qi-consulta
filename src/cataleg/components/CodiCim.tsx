// Cercador de codis CIM-11 (diagnòstic occidental). La llista oficial (uns
// 17.000 codis, capítols 1–25) es carrega a part només quan es fa servir. Els
// títols són els oficials en anglès (llicència CC BY-ND de l'OMS: no es poden
// traduir), però es pot cercar per codi o per paraules en anglès.

import { useEffect, useState } from 'react'
import { formatar, t } from '../../i18n/t'

export interface CodiTriat {
  codi: string
  titol: string
}

type Llista = readonly (readonly [string, string])[]
let memoria: Promise<Llista> | null = null
export function carregarCim11(): Promise<Llista> {
  memoria ??= import('../dades/cim11-mms.json').then((m) => m.default as unknown as Llista)
  return memoria
}

/** Primer els codis que comencen per la consulta; després, els títols que contenen totes les paraules */
export function cercarCodis(llista: Llista, consulta: string, max = 12): CodiTriat[] {
  const q = consulta.trim().toLowerCase()
  if (q.length < 2) return []
  const paraules = q.split(/\s+/)
  const perCodi: CodiTriat[] = []
  const perTitol: CodiTriat[] = []
  for (const [codi, titol] of llista) {
    if (codi.toLowerCase().startsWith(q)) perCodi.push({ codi, titol })
    else {
      const tl = titol.toLowerCase()
      if (paraules.every((p) => tl.includes(p))) perTitol.push({ codi, titol })
    }
    if (perCodi.length >= max) break
  }
  return [...perCodi, ...perTitol.sort((a, b) => a.titol.length - b.titol.length)].slice(0, max)
}

const esCodi = (v: unknown): v is CodiTriat => !!v && typeof v === 'object' && typeof (v as CodiTriat).codi === 'string'

export function CodiCim({ valor, onCanviar, editable, etiqueta }: { valor: unknown; onCanviar(v: CodiTriat | null): void; editable: boolean; etiqueta: string }) {
  const [consulta, setConsulta] = useState('')
  const [llista, setLlista] = useState<Llista | null>(null)
  useEffect(() => {
    if (consulta.trim().length >= 2 && !llista) void carregarCim11().then(setLlista)
  }, [consulta, llista])
  const c = t.cataleg
  if (esCodi(valor)) {
    return (
      <p className="codi-triat">
        <span className="xip" aria-pressed="true">
          <strong>{valor.codi}</strong> {valor.titol}
        </span>
        {editable && (
          <button type="button" className="boto boto-discret" aria-label={formatar(c.treureCodi, { codi: valor.codi })} onClick={() => onCanviar(null)}>
            ✕
          </button>
        )}
      </p>
    )
  }
  if (!editable) return null
  const resultats = llista ? cercarCodis(llista, consulta) : []
  return (
    <div className="cercador-codi">
      <input type="search" aria-label={etiqueta} placeholder={c.cercarCodi} value={consulta} onChange={(e) => setConsulta(e.target.value)} />
      {consulta.trim().length >= 2 && (
        <ul className="llista-codis" aria-label={etiqueta}>
          {!llista && <li className="detall">{t.app.carregant}</li>}
          {llista && resultats.length === 0 && <li className="detall">{c.capCodi}</li>}
          {resultats.map((r) => (
            <li key={r.codi}>
              <button
                type="button"
                onClick={() => {
                  onCanviar(r)
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
