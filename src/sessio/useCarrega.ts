import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { comptadorEscriptures } from '../sincronia/escriptura'
import { useVistaDades } from '../sincronia/revisio'

export type Carrega<T> =
  | { estat: 'carregant' }
  | { estat: 'error'; error: unknown }
  | { estat: 'llest'; dades: T }

/**
 * Carrega dades asíncrones i les torna a carregar quan canvien les
 * dependències, i també quan arriben canvis d'un altre dispositiu (en aquest
 * cas, sense passar per «carregant»: es continua veient el que hi havia).
 *
 * Si mentre es llegia s'ha desat res en aquest dispositiu, es torna a llegir:
 * el que s'ha llegit pot ser d'abans del desat, i una pantalla que es desa
 * sola (la visita) el prendria per una versió nova i esborraria el que s'hi
 * acaba de fer.
 */
export function useCarrega<T>(
  carregar: () => Promise<T>,
  deps: DependencyList,
): [Carrega<T>, (dades: T) => void] {
  const [carrega, setCarrega] = useState<Carrega<T>>({ estat: 'carregant' })
  const vista = useVistaDades()
  const vistaAnterior = useRef(vista)

  // Les dependències les dona qui crida, com en un useEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let actiu = true
    const nomesVista = vistaAnterior.current !== vista
    vistaAnterior.current = vista
    if (!nomesVista) setCarrega({ estat: 'carregant' })
    const llegir = async (): Promise<T> => {
      for (let intent = 0; ; intent++) {
        const abans = comptadorEscriptures()
        const dades = await carregar()
        if (comptadorEscriptures() === abans || intent >= 4 || !actiu) return dades
      }
    }
    llegir().then(
      (dades) => actiu && setCarrega({ estat: 'llest', dades }),
      (error: unknown) => actiu && setCarrega({ estat: 'error', error }),
    )
    return () => {
      actiu = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vista])

  const substituir = useCallback((dades: T) => setCarrega({ estat: 'llest', dades }), [])
  return [carrega, substituir]
}
