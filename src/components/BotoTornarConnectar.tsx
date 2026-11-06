// «Tornar a connectar amb Google»: renova el permís sense tocar cap dada.
// Si s'hi entra amb un altre compte, no es fa servir (comprovació de compte,
// google.ts) i el panell de la píndola ho explica.

import { useState } from 'react'
import { t } from '../i18n/t'
import { ATRIBUT_CONNECTAR, useSincronia } from '../sincronia/ContextSincronia'
import { Boto } from './Boto'

export function BotoTornarConnectar({ enFet }: { enFet?(): void }) {
  const { connectar } = useSincronia()
  const [estat, setEstat] = useState<'res' | 'connectant' | 'fet' | 'error'>('res')
  return (
    <>
      <Boto
        variant="discret"
        {...{ [ATRIBUT_CONNECTAR]: '' }}
        disabled={estat === 'connectant'}
        onClick={() => {
          setEstat('connectant')
          // La finestra de Google s'obre dins el mateix toc
          connectar().then(
            () => {
              setEstat('fet')
              enFet?.()
            },
            () => setEstat('error'),
          )
        }}
      >
        {t.sincronia.tornarConnectar}
      </Boto>
      {estat === 'fet' && <span role="status">{t.sincronia.connectat}</span>}
      {estat === 'error' && <span role="alert">{t.sincronia.noConnectat}</span>}
    </>
  )
}
