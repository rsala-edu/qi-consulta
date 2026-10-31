import { useCallback, useEffect, useState, type DependencyList } from 'react'

export type Carrega<T> =
  | { estat: 'carregant' }
  | { estat: 'error'; error: unknown }
  | { estat: 'llest'; dades: T }

/** Carrega dades asíncrones i les torna a carregar quan canvien les dependències. */
export function useCarrega<T>(
  carregar: () => Promise<T>,
  deps: DependencyList,
): [Carrega<T>, (dades: T) => void] {
  const [carrega, setCarrega] = useState<Carrega<T>>({ estat: 'carregant' })

  // Les dependències les dona qui crida, com en un useEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let actiu = true
    setCarrega({ estat: 'carregant' })
    carregar().then(
      (dades) => actiu && setCarrega({ estat: 'llest', dades }),
      (error: unknown) => actiu && setCarrega({ estat: 'error', error }),
    )
    return () => {
      actiu = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const substituir = useCallback((dades: T) => setCarrega({ estat: 'llest', dades }), [])
  return [carrega, substituir]
}
