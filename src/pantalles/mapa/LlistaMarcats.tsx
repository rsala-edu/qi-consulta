// Punts marcats de la sessió (cos i orella), pensada per a 20–30 agulles:
// una línia per punt (color de la tècnica, codi, nom, costat i «×»), agrupada
// per mapa amb capçaleres plegables. La capçalera queda fixa i només la
// llista es desplaça, dins la columna. Tocar una fila porta al punt.

import { useState } from 'react'
import { COLOR_TECNICA, type Mapa, type PuntMarcat } from '../../domini/puntMarcat'
import { formatar, t } from '../../i18n/t'
import { PUNTS_ORELLA, puntOrella } from '../../orella/cataleg'
import { cataleg } from '../../punts/cataleg'
import { nomTecnica } from './tecniques'

type Ordre = 'meridia' | 'marcatge'

interface Props {
  marcats: readonly PuntMarcat[]
  onVeure(m: PuntMarcat): void
  onTreure(m: PuntMarcat): void
  onTreureTots(): void
}

/** Posició de cada punt al catàleg (els meridians en ordre, i dins de cada un, els punts) */
const ORDRE_COS = new Map(cataleg.punts.map((p, i) => [p.codi, i]))
const ORDRE_ORELLA = new Map(PUNTS_ORELLA.map((p, i) => [p.codi, i]))

const nomDe = (m: PuntMarcat) =>
  (m.mapa === 'orella' ? puntOrella(m.codi)?.nom : cataleg.punts.find((x) => x.codi === m.codi)?.pinyin) ?? ''

export function LlistaMarcats({ marcats, onVeure, onTreure, onTreureTots }: Props) {
  const [ordre, setOrdre] = useState<Ordre>('meridia')
  const [plegats, setPlegats] = useState<ReadonlySet<Mapa>>(new Set())
  const [confirmant, setConfirmant] = useState(false)
  const m = t.mapa

  const grups = (['cos', 'orella'] as const)
    .map((mapa) => {
      const punts = marcats.filter((p) => p.mapa === mapa)
      if (ordre === 'meridia') {
        const index = mapa === 'cos' ? ORDRE_COS : ORDRE_ORELLA
        punts.sort((a, b) => (index.get(a.codi) ?? 1e9) - (index.get(b.codi) ?? 1e9))
      }
      return { mapa, punts }
    })
    .filter((g) => g.punts.length > 0)

  return (
    <section className="llista-marcats-seccio" aria-label={m.marcats}>
      <div className="llista-marcats-capcalera">
        <h2>{formatar(m.marcatsAmbTotal, { n: String(marcats.length) })}</h2>
        {marcats.length > 0 && (
          <div className="llista-marcats-eines">
            <select aria-label={m.ordre} value={ordre} onChange={(e) => setOrdre(e.target.value as Ordre)}>
              {(['meridia', 'marcatge'] as const).map((o) => (
                <option key={o} value={o}>
                  {m.ordres[o]}
                </option>
              ))}
            </select>
            {!confirmant && (
              <button type="button" className="enllac-treure-tots" onClick={() => setConfirmant(true)}>
                {m.treureTots}
              </button>
            )}
          </div>
        )}
        {confirmant && (
          <div className="confirmar-treure" role="alertdialog" aria-label={m.treureTots}>
            <span>{formatar(m.confirmarTreureTots, { n: String(marcats.length) })}</span>
            <button
              type="button"
              className="boto boto-principal"
              onClick={() => {
                onTreureTots()
                setConfirmant(false)
              }}
            >
              {m.siTreure}
            </button>
            <button type="button" className="boto boto-discret" onClick={() => setConfirmant(false)}>
              {m.no}
            </button>
          </div>
        )}
      </div>

      {marcats.length === 0 && <p className="detall">{m.capMarcat}</p>}
      <div className="llista-marcats-desplacament">
        {grups.map(({ mapa, punts }) => {
          const plegat = plegats.has(mapa)
          const nomMapa = mapa === 'orella' ? t.orella.titol : m.pestanyaCos
          return (
            <div key={mapa} className="grup-marcats">
              <button
                type="button"
                className="grup-marcats-capcalera"
                aria-expanded={!plegat}
                onClick={() => {
                  const nous = new Set(plegats)
                  if (plegat) nous.delete(mapa)
                  else nous.add(mapa)
                  setPlegats(nous)
                }}
              >
                <span className="fletxa" aria-hidden="true">
                  {plegat ? '▸' : '▾'}
                </span>
                {formatar(m.grupMarcats, { mapa: nomMapa, n: String(punts.length) })}
              </button>
              {!plegat && (
                <ul className="llista-marcats" aria-label={nomMapa}>
                  {punts.map((p) => {
                    const nom = nomDe(p)
                    const tot = `${p.codi} · ${nom} · ${nomMapa} · ${m.costat[p.costat]} · ${nomTecnica(p)}`
                    return (
                      <li key={`${p.mapa}|${p.codi}`}>
                        <button type="button" className="fila-marcat" title={tot} onClick={() => onVeure(p)}>
                          <span className="punt-color" style={{ background: COLOR_TECNICA[p.tecnica] }} />
                          <span className="codi">{p.codi}</span>
                          <span className="nom">{nom}</span>
                          <span className="costat" aria-label={m.costat[p.costat]}>
                            {m.costatCurt[p.costat]}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="treure-marcat"
                          aria-label={formatar(m.treurePunt, { codi: p.codi })}
                          title={formatar(m.treurePunt, { codi: p.codi })}
                          onClick={() => onTreure(p)}
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
