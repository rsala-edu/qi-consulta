// Indicador petit de la barra superior: estat de la còpia a Google Drive.
// Si cal tornar a connectar, un toc obre la finestra de Google.

import { t } from '../i18n/t'
import { ATRIBUT_CONNECTAR, useSincronia } from '../sincronia/ContextSincronia'

export function IndicadorCopia() {
  const { estat, pendent, connectar, sincronitzarAra } = useSincronia()
  if (estat === 'sense-google') return null
  return (
    <button
      type="button"
      className={`indicador-copia estat-${estat}`}
      {...{ [ATRIBUT_CONNECTAR]: estat === 'cal-connectar' ? '' : undefined }}
      title={estat === 'cal-connectar' ? t.sincronia.calConnectar : undefined}
      onClick={() => {
        if (estat === 'cal-connectar') void connectar().catch(() => {})
        else if (estat !== 'sincronitzant') void sincronitzarAra()
      }}
    >
      {estat === 'al-dia' && pendent ? t.sincronia.curt.pendent : t.sincronia.curt[estat]}
    </button>
  )
}
