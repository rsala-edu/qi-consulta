// Una escala (THI, DHI, SNOT-22): o el total directament, o les respostes ítem
// per ítem (només números, sense el text dels ítems: llicències a
// docs/especificacions.md), i el grau de gravetat.

import { useId, useState } from 'react'
import { ESCALES, grauEscala, respostesQueFalten, totalEscala, type IdEscala, type ResultatEscala } from '../../domini/escales'
import { formatar, t } from '../../i18n/t'

const esResultat = (v: unknown): v is ResultatEscala => !!v && typeof v === 'object' && 'total' in (v as object)

export function Escala({ id: idEscala, valor, onCanviar, editable }: { id: IdEscala; valor: unknown; onCanviar(v: ResultatEscala | null): void; editable: boolean }) {
  const e = ESCALES[idEscala]
  const r = esResultat(valor) ? valor : { total: null }
  const respostes = r.respostes ?? {}
  const [perItem, setPerItem] = useState(Object.keys(respostes).length > 0)
  const id = useId()
  const a = t.escales
  const grau = grauEscala(e, r.total)
  const posarResposta = (item: number, v: number) => {
    const noves = { ...respostes }
    if (noves[String(item)] === v) delete noves[String(item)]
    else noves[String(item)] = v
    const total = totalEscala(e, noves)
    onCanviar(Object.keys(noves).length > 0 ? { respostes: noves, total } : null)
  }
  return (
    <div className="escala">
      <div className="fila-escala">
        <div className="camp">
          <label htmlFor={`${id}-total`}>{formatar(a.total, { max: String(e.maxim) })}</label>
          <input
            id={`${id}-total`}
            type="number"
            inputMode="numeric"
            min={0}
            max={e.maxim}
            value={r.total ?? ''}
            disabled={!editable || perItem}
            onChange={(ev) => {
              const n = ev.target.value === '' ? null : Math.max(0, Math.min(e.maxim, Math.round(Number(ev.target.value))))
              onCanviar(n === null ? null : { total: n })
            }}
          />
        </div>
        <p className="grau-escala" role="status">
          {grau ?? ''}
        </p>
      </div>
      {editable && (
        <label className="casella">
          <input type="checkbox" checked={perItem} onChange={(ev) => setPerItem(ev.target.checked)} />
          {a.perItem}
        </label>
      )}
      {perItem && (
        <>
          <p className="detall">{formatar(a.instruccions, { valors: e.respostes.join(', ') })}</p>
          <ol className="items-escala">
            {Array.from({ length: e.items }, (_, i) => i + 1).map((item) => (
              <li key={item}>
                <span className="num-item">{item}</span>
                <span className="segmentat" role="radiogroup" aria-label={formatar(a.item, { n: String(item) })}>
                  {e.respostes.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={respostes[String(item)] === v} disabled={!editable} onClick={() => posarResposta(item, v)}>
                      {v}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          {respostesQueFalten(e, respostes) > 0 && <p className="detall">{formatar(a.falten, { n: String(respostesQueFalten(e, respostes)) })}</p>}
        </>
      )}
      <p className="detall">{e.referencia}</p>
    </div>
  )
}
