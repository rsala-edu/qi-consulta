// Vistes ràpides del cos (Davant, Esquerra, Darrere, Dreta, Tot el cos),
// fora de la zona del dibuix perquè no tapin el cos.

import type { RefObject } from 'react'
import { t } from '../../i18n/t'
import { VISTES, type Vista } from '../camera'
import type { ControlVisor } from './Visor3D'

export function BarraVistes({ visor }: { visor: RefObject<ControlVisor | null> }) {
  return (
    <div className="visor3d-vistes" role="toolbar" aria-label={t.mapa.vistes}>
      {(Object.keys(VISTES) as Vista[]).map((v) => (
        <button key={v} type="button" className="boto boto-secundari" onClick={() => visor.current?.vista(v)}>
          {t.mapa.vista[v]}
        </button>
      ))}
      <button type="button" className="boto boto-secundari" onClick={() => visor.current?.restablir()}>
        {t.mapa.totElCos}
      </button>
    </div>
  )
}
