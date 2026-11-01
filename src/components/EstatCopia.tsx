// Estat de la còpia a Google Drive: «Última còpia: fa 2 minuts», o un botó
// per connectar quan el permís de Google ha caducat.

import { useEffect, useState } from 'react'
import { faTemps, formatar, t } from '../i18n/t'
import { ATRIBUT_CONNECTAR, useSincronia } from '../sincronia/ContextSincronia'
import { Boto } from './Boto'

export function EstatCopia() {
  const { estat, ultimaCopia, connectar, sincronitzarAra } = useSincronia()
  const [error, setError] = useState(false)
  // Torna a dibuixar cada minut perquè «fa X minuts» es mantingui al dia
  const [ara, setAra] = useState(() => Date.now())
  useEffect(() => {
    const i = window.setInterval(() => setAra(Date.now()), 60_000)
    return () => window.clearInterval(i)
  }, [])
  const s = t.sincronia

  if (estat === 'sense-google') return <p className="estat-copia detall">{s.senseGoogle}</p>
  return (
    <div className={`estat-copia estat-${estat}`} role="status">
      <span>
        {estat === 'sincronitzant'
          ? s.sincronitzant
          : estat === 'cal-connectar'
            ? s.calConnectar
            : estat === 'error'
              ? s.error
              : ultimaCopia
                ? formatar(s.ultimaCopia, { quan: faTemps(ultimaCopia, ara) })
                : s.capCopia}
      </span>
      {estat === 'cal-connectar' && (
        <Boto
          variant="secundari"
          {...{ [ATRIBUT_CONNECTAR]: '' }}
          onClick={() => {
            setError(false)
            connectar().catch(() => setError(true))
          }}
        >
          {s.connectar}
        </Boto>
      )}
      {estat === 'error' && (
        <Boto variant="discret" onClick={() => void sincronitzarAra()}>
          {s.tornarAProvar}
        </Boto>
      )}
      {error && <span className="camp-error">{t.desbloqueig.errorsGoogle.cancellat}</span>}
    </div>
  )
}
