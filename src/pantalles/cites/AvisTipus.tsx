// Avís discret quan el recàlcul del tipus de visita canvia una altra cita:
// «La cita del dc. 4/11 ha passat a seguiment». Desapareix sol.

import { useEffect, useState } from 'react'
import { aData } from '../../domini/cita'
import { formatar, t } from '../../i18n/t'
import type { CanviTipus } from '../../db/tipusVisita'

export function textCanviTipus(c: CanviTipus): string {
  const d = aData(c.inici)
  const dia = `${t.dates.diesCurts[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
  return formatar(t.cites.canviTipus, { dia, tipus: t.cites.tipusMinuscula[c.tipus] })
}

const DURADA = 8_000

export function useAvisTipus(): [React.ReactNode, (canvis: CanviTipus[]) => void] {
  const [canvis, setCanvis] = useState<CanviTipus[]>([])
  useEffect(() => {
    if (canvis.length === 0) return
    const t = window.setTimeout(() => setCanvis([]), DURADA)
    return () => window.clearTimeout(t)
  }, [canvis])
  const avis =
    canvis.length > 0 ? (
      <div className="avis-tipus-visita" aria-live="polite">
        {canvis.map((c) => (
          <p key={c.id}>{textCanviTipus(c)}</p>
        ))}
      </div>
    ) : null
  return [avis, setCanvis]
}
