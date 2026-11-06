// Franja fixa si sembla una finestra privada (d'incògnit): en tancar-la, el
// navegador ho esborra tot, també el que encara no s'hagi pujat a Drive.

import { useEffect, useState } from 'react'
import { t } from '../i18n/t'
import { semblaFinestraPrivada } from '../sessio/persistencia'

export function AvisFinestraPrivada() {
  const [privada, setPrivada] = useState(false)
  useEffect(() => {
    let actiu = true
    void semblaFinestraPrivada().then((p) => actiu && setPrivada(p))
    return () => {
      actiu = false
    }
  }, [])
  if (!privada) return null
  return (
    <p className="franja-avis" role="status">
      {t.app.finestraPrivada}
    </p>
  )
}
