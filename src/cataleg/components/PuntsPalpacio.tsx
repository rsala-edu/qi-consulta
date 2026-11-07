// Punts dolorosos a la palpació: es marquen sobre el mapa del cos amb un color
// propi («Dolor a la palpació»), separats dels punts del tractament. Es desen
// a l'exploració de la sessió com «codi → costat».

import { lazy, Suspense, useState, type Dispatch, type SetStateAction } from 'react'
import { Indicador } from '../../components/Indicador'
import { COLOR_TECNICA, nouPuntMarcat, type CostatMarcat, type PuntMarcat } from '../../domini/puntMarcat'
import { formatar, t } from '../../i18n/t'

const MapaTractament = lazy(() => import('../../pantalles/mapa/PantallaProvaMapa').then((m) => ({ default: m.MapaTractament })))

type Valor = Record<string, { costat: CostatMarcat }>

export const puntsDe = (v: unknown): PuntMarcat[] =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.entries(v as Valor).map(([codi, p]) => nouPuntMarcat(codi, p.costat, 'palpacio'))
    : []

export function PuntsPalpacio({ valor, onCanviar, editable }: { valor: unknown; onCanviar(v: Valor | null): void; editable: boolean }) {
  const [obert, setObert] = useState(false)
  const punts = puntsDe(valor)
  const c = t.cataleg
  const setMarcats: Dispatch<SetStateAction<PuntMarcat[]>> = (u) => {
    const nous = typeof u === 'function' ? u(punts) : u
    const v: Valor = Object.fromEntries(nous.filter((p) => p.mapa === 'cos').map((p) => [p.codi, { costat: p.costat }]))
    onCanviar(Object.keys(v).length > 0 ? v : null)
  }
  return (
    <div className="punts-palpacio">
      {punts.length > 0 && (
        <ul className="xips llista-palpacio" aria-label={c.puntsDolorosos}>
          {punts.map((p) => (
            <li key={p.codi} className="xip xip-palpacio">
              <span className="punt-color" style={{ background: COLOR_TECNICA.palpacio }} />
              {p.codi} · {t.mapa.costatCurt[p.costat]}
              {editable && (
                <button
                  type="button"
                  className="boto boto-discret"
                  aria-label={formatar(t.mapa.treurePunt, { codi: p.codi })}
                  onClick={() => setMarcats(punts.filter((x) => x.codi !== p.codi))}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <button type="button" className="boto boto-secundari" aria-expanded={obert} onClick={() => setObert((x) => !x)}>
          {obert ? c.tancarMapa : c.marcarAlMapa}
        </button>
      )}
      {obert && (
        <div className="pantalla-mapa mapa-visita mapa-palpacio">
          <Suspense fallback={<Indicador text={t.mapa.carregantModel} />}>
            <MapaTractament marcats={punts} setMarcats={setMarcats} tecniques={['palpacio']} nomesCos />
          </Suspense>
        </div>
      )}
    </div>
  )
}
