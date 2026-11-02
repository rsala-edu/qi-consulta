// Columna dreta del mapa (cos i orella), amb dues pestanyes: «Punt» (cercador
// i fitxa del punt) i «Marcats (25)» (la llista de punts marcats, amb tota
// l'alçada de la columna). En marcar un punt el comptador canvia amb una
// petita animació, però no es canvia de pestanya; tocar una fila de la
// llista porta al punt i torna a «Punt».

import type { ReactNode } from 'react'
import { t } from '../../i18n/t'

export type PestanyaPanell = 'punt' | 'marcats'

interface Props {
  /** Per als id (cos o orella) */
  mapa: 'cos' | 'orella'
  pestanya: PestanyaPanell
  onPestanya(p: PestanyaPanell): void
  total: number
  punt: ReactNode
  marcats: ReactNode
}

export function PanellLateral({ mapa, pestanya, onPestanya, total, punt, marcats }: Props) {
  const id = (p: PestanyaPanell) => `panell-${mapa}-${p}`
  return (
    <aside className="panell-mapa amb-pestanyes">
      <div className="segmentat pestanyes-panell" role="tablist" aria-label={t.mapa.panell}>
        {(['punt', 'marcats'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`${id(p)}-pestanya`}
            aria-controls={id(p)}
            aria-selected={pestanya === p}
            onClick={() => onPestanya(p)}
          >
            {p === 'punt' ? (
              t.mapa.pestanyaPunt
            ) : (
              <>
                {t.mapa.pestanyaMarcats}{' '}
                <span className="comptador" key={total}>
                  ({total})
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <div
        id={id('punt')}
        role="tabpanel"
        aria-labelledby={`${id('punt')}-pestanya`}
        className="panell-lateral panell-lateral-punt"
        hidden={pestanya !== 'punt'}
      >
        {punt}
      </div>
      <div
        id={id('marcats')}
        role="tabpanel"
        aria-labelledby={`${id('marcats')}-pestanya`}
        className="panell-lateral panell-lateral-marcats"
        hidden={pestanya !== 'marcats'}
      >
        {marcats}
      </div>
    </aside>
  )
}
