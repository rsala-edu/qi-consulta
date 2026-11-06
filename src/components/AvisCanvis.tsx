// Franja quan han arribat canvis d'un altre dispositiu però hi ha un
// formulari a mig fer: no es toca res fins que la doctora els vol veure.

import { t } from '../i18n/t'
import { useCanvisPerVeure } from '../sincronia/revisio'
import { Boto } from './Boto'

export function AvisCanvis() {
  const { canvisPerVeure, veure } = useCanvisPerVeure()
  if (!canvisPerVeure) return null
  return (
    <p className="franja-avis" role="status">
      <span>{t.app.canvisAltreDispositiu}</span>
      <Boto variant="discret" onClick={veure}>
        {t.app.veureCanvis}
      </Boto>
    </p>
  )
}
