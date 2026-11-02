// Missatge d'un error en recuperar les dades: un per a cada cas i, per a la
// resta, un codi curt (REC-D2) que es pot copiar per enviar-lo.

import { useState } from 'react'
import { Boto } from '../../components/Boto'
import { t } from '../../i18n/t'
import type { ErrorRecuperacio } from '../../sincronia/recuperacio'

export function MissatgeErrorRecuperacio({
  error,
  onTornarGoogle,
}: {
  error: ErrorRecuperacio
  onTornarGoogle?: () => void
}) {
  const [copiat, setCopiat] = useState(false)
  const d = t.desbloqueig
  if (error.tipus === 'contrasenya') return <p role="alert">{d.contrasenyaIncorrecta}</p>
  const ambCodi = error.tipus === 'inesperat' || error.tipus === 'danyada'
  return (
    <div className="error-recuperacio" role="alert">
      <p>{d.errorsRecuperacio[error.tipus]}</p>
      {ambCodi && (
        <p className="codi-error">
          <span>{d.codiError}: </span>
          <code>{error.codi}</code>
          <button
            type="button"
            className="enllac-secundari"
            onClick={() =>
              void navigator.clipboard?.writeText(error.codi).then(
                () => setCopiat(true),
                () => setCopiat(false),
              )
            }
          >
            {copiat ? d.codiCopiat : d.copiarCodi}
          </button>
        </p>
      )}
      {error.tipus === 'drive' && onTornarGoogle && <Boto onClick={onTornarGoogle}>{d.tornarGoogle}</Boto>}
    </div>
  )
}
