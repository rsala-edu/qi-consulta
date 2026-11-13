// Un botó que genera un informe en PDF al dispositiu (etapa 4D) i, quan és a
// punt, el deixa descarregar o obrir per imprimir. Abans, avisa que el fitxer
// ja no està xifrat.

import { useState } from 'react'
import { Boto } from '../components/Boto'
import { descarregarPdf, urlPdf } from '../consentiment/document'
import { t } from '../i18n/t'

const i = t.informes

export function BotoInforme({ etiqueta, generar, className }: { etiqueta: string; generar(): Promise<{ pdf: string; nom: string }>; className?: string }) {
  const [estat, setEstat] = useState<'tancat' | 'generant' | 'error' | { pdf: string; nom: string }>('tancat')
  return (
    <>
      <Boto
        variant="secundari"
        className={className}
        onClick={() => {
          setEstat('generant')
          void generar()
            .then(setEstat)
            .catch((e: unknown) => {
              console.error(e)
              setEstat('error')
            })
        }}
      >
        {etiqueta}
      </Boto>
      {estat !== 'tancat' && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setEstat('tancat')}>
          <section className="dialeg dialeg-informe" role="dialog" aria-modal="true" aria-label={etiqueta}>
            <h2>{etiqueta}</h2>
            {estat === 'generant' ? (
              <p role="status">{i.generant}</p>
            ) : estat === 'error' ? (
              <>
                <p role="alert">{i.error}</p>
                <div className="accions accions-esquerra">
                  <Boto variant="discret" onClick={() => setEstat('tancat')}>
                    {i.tancar}
                  </Boto>
                </div>
              </>
            ) : (
              <>
                <p role="status">{i.llest}</p>
                <div className="accions accions-esquerra">
                  <Boto onClick={() => window.confirm(i.avis) && descarregarPdf(estat.pdf, estat.nom)}>{i.descarregar}</Boto>
                  <Boto
                    variant="secundari"
                    onClick={() => {
                      if (!window.confirm(i.avis)) return
                      const url = urlPdf(estat.pdf)
                      window.open(url, '_blank', 'noopener')
                      setTimeout(() => URL.revokeObjectURL(url), 60_000)
                    }}
                  >
                    {i.imprimir}
                  </Boto>
                  <Boto variant="discret" onClick={() => setEstat('tancat')}>
                    {i.tancar}
                  </Boto>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
