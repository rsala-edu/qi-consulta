// Franja «Hi ha una versió nova · Actualitzar» (actualitzacio.tsx)

import { t } from '../i18n/t'
import { useActualitzacio } from '../actualitzacio/actualitzacio'
import { Boto } from './Boto'

export function AvisVersioNova() {
  const { versioNova, actualitzar } = useActualitzacio()
  if (!versioNova) return null
  return (
    <p className="franja-avis" role="status">
      <span>{t.app.versioNova}</span>
      <Boto variant="discret" onClick={actualitzar}>
        {t.app.actualitzar}
      </Boto>
    </p>
  )
}
