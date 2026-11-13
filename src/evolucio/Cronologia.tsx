// Cronologia de l'episodi (etapa 3C): una targeta compacta per sessió (data,
// número, escala amb la fletxa respecte de l'anterior, punts, retenció i una
// icona si hi ha incidències o addendes). Cada targeta obre la sessió.

import { Link } from 'react-router'
import { serieEvolucio, tendencies, type SessioEvolucio } from '../domini/evolucio'
import { diaCurtMes, formatar, t } from '../i18n/t'

const e = t.evolucio
const FLETXA = { puja: '↑', baixa: '↓', igual: '=' } as const

function Icona({ tipus, titol }: { tipus: 'incidencia' | 'addenda'; titol: string }) {
  return (
    <span className={`icona-cronologia ${tipus}`} title={titol} role="img" aria-label={titol}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        {tipus === 'incidencia' ? (
          <>
            <path d="M10 2.5 18 17H2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M10 8v4M10 14.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M5 2.5h7l3 3V17.5H5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M7.5 9.5h5M7.5 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  )
}

export function Cronologia({
  sessions,
  addendes,
  enCurs,
}: {
  sessions: readonly SessioEvolucio[]
  /** Sessions amb addendes */
  addendes: ReadonlySet<string>
  /** Sessions que encara són en curs */
  enCurs: ReadonlySet<string>
}) {
  const serie = serieEvolucio(sessions)
  const tend = tendencies(serie)
  return (
    <ol className="cronologia">
      {serie.map((p, i) => {
        const tn = tend[i]
        return (
          <li key={p.sessioId}>
            <Link
              to={`/visita/${p.sessioId}`}
              className="targeta-sessio"
              aria-label={[
                formatar(e.sessioDia, { n: String(p.numero), dia: diaCurtMes(p.dia) }),
                formatar(e.escalaTargeta, { n: p.principal === null ? '—' : String(p.principal) }) + (tn ? ` (${e.tendencies[tn]})` : ''),
                formatar(e.puntsN, { n: String(p.punts) }),
                p.retencio === null ? e.senseRetencio : formatar(e.retencioN, { n: String(p.retencio) }),
                p.incidencies ? e.ambIncidencies : '',
                addendes.has(p.sessioId) ? e.ambAddendes : '',
                enCurs.has(p.sessioId) ? t.tractaments.enCurs : '',
              ]
                .filter(Boolean)
                .join(', ')}
            >
              <span className="num-sessio">{formatar(e.sessioCurta, { n: String(p.numero) })}</span>
              <span className="dia-sessio">{diaCurtMes(p.dia)}</span>
              <span className="escala-sessio">
                {p.principal ?? '—'}
                {tn && (
                  <span className={`fletxa ${tn}`} role="img" aria-label={e.tendencies[tn]} title={e.tendencies[tn]}>
                    {FLETXA[tn]}
                  </span>
                )}
              </span>
              <span className="detall">{formatar(e.puntsN, { n: String(p.punts) })}</span>
              <span className="detall">{p.retencio === null ? e.senseRetencio : formatar(e.minuts, { n: String(p.retencio) })}</span>
              <span className="icones-sessio">
                {enCurs.has(p.sessioId) && <span className="etiqueta">{t.tractaments.enCurs}</span>}
                {p.incidencies && <Icona tipus="incidencia" titol={e.ambIncidencies} />}
                {addendes.has(p.sessioId) && <Icona tipus="addenda" titol={e.ambAddendes} />}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
