// Contrasenya o clau de recuperació d'una còpia (la de Drive o un fitxer .qi),
// per obrir-ne la clau. Els errors, en paraules senzilles.

import { useState } from 'react'
import { ErrorContrasenya } from '../crypto'
import { t } from '../i18n/t'
import { ErrorClauRecuperacio } from '../sessio/claus'
import type { Credencial } from '../sincronia/canviClau'
import { ErrorAutoritzacio, ErrorDrive } from '../sincronia/drive'
import { Boto } from './Boto'
import { Camp } from './Camp'
import { Indicador } from './Indicador'

export function missatgeError(e: unknown): string {
  if (e instanceof ErrorContrasenya) return t.desbloqueig.contrasenyaIncorrecta
  if (e instanceof ErrorClauRecuperacio) return t.drive.clauIncorrecta
  if (e instanceof Error && e.name === 'ErrorSenseCopia') return t.drive.senseCopia
  if (e instanceof ErrorAutoritzacio || e instanceof ErrorDrive || e instanceof TypeError) return t.drive.errorDrive
  return t.app.errorInesperat
}

export function FormulariCredencial({
  etiquetaContrasenya,
  etiquetaClau,
  textBoto,
  textFent,
  onCredencial,
  onCancellar,
}: {
  etiquetaContrasenya: string
  etiquetaClau: string
  textBoto: string
  textFent: string
  onCredencial(c: Credencial): Promise<void>
  onCancellar?(): void
}) {
  const [tipus, setTipus] = useState<Credencial['tipus']>('contrasenya')
  const [valor, setValor] = useState('')
  const [ocupat, setOcupat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="formulari"
      onSubmit={(e) => {
        e.preventDefault()
        setOcupat(true)
        setError(null)
        onCredencial({ tipus, valor }).then(
          () => setOcupat(false),
          (err: unknown) => {
            setError(missatgeError(err))
            setValor('')
            setOcupat(false)
          },
        )
      }}
    >
      {tipus === 'contrasenya' ? (
        <Camp etiqueta={etiquetaContrasenya} error={error ?? undefined}>
          <input
            type="password"
            autoComplete="off"
            autoFocus
            disabled={ocupat}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Camp>
      ) : (
        <Camp etiqueta={etiquetaClau} error={error ?? undefined}>
          <input type="text" autoComplete="off" autoFocus disabled={ocupat} value={valor} onChange={(e) => setValor(e.target.value)} />
        </Camp>
      )}
      <button
        type="button"
        className="enllac-secundari"
        disabled={ocupat}
        onClick={() => {
          setTipus((x) => (x === 'contrasenya' ? 'recuperacio' : 'contrasenya'))
          setValor('')
          setError(null)
        }}
      >
        {tipus === 'contrasenya' ? t.drive.ambClau : t.drive.ambContrasenya}
      </button>
      <div className="accions accions-esquerra">
        {ocupat ? (
          <Indicador text={textFent} />
        ) : (
          <>
            <Boto type="submit" disabled={valor === ''}>
              {textBoto}
            </Boto>
            {onCancellar && (
              <Boto variant="discret" onClick={onCancellar}>
                {t.app.cancellar}
              </Boto>
            )}
          </>
        )}
      </div>
    </form>
  )
}
