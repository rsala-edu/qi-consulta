// Franja quan un dispositiu amb una versió antiga de l'app (anterior al
// format 2) ha escrit a qi-dades.json: els seus canvis s'han importat, però
// cal actualitzar-lo.

import { t } from '../i18n/t'
import { useSincronia } from '../sincronia/ContextSincronia'
import { Boto } from './Boto'

export function AvisVersioAntiga() {
  const { versioAntiga, tancarAvisVersioAntiga } = useSincronia()
  if (!versioAntiga) return null
  return (
    <p className="franja-avis" role="alert">
      <span>{t.app.versioAntiga}</span>
      <Boto variant="discret" onClick={tancarAvisVersioAntiga}>
        {t.app.entesos}
      </Boto>
    </p>
  )
}
