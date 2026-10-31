import { useId, type ReactElement, cloneElement } from 'react'

interface Props {
  etiqueta: string
  error?: string
  /** Un sol control (input, textarea o select). Rep l'id i l'aria automàticament. */
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
  ample?: boolean
}

export function Camp({ etiqueta, error, children, ample = false }: Props) {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className={`camp${ample ? ' camp-ample' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? idError : undefined,
      })}
      {error && (
        <p className="camp-error" id={idError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
