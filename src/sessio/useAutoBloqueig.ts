import { useEffect } from 'react'

const ESDEVENIMENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Crida `bloquejar` després de `ms` mil·lisegons sense cap interacció.
 * `bloquejar` ha de ser estable (useCallback).
 */
export function useAutoBloqueig(actiu: boolean, bloquejar: () => void, ms: number): void {
  useEffect(() => {
    if (!actiu) return
    let temporitzador = window.setTimeout(bloquejar, ms)
    const reiniciar = () => {
      window.clearTimeout(temporitzador)
      temporitzador = window.setTimeout(bloquejar, ms)
    }
    for (const e of ESDEVENIMENTS) window.addEventListener(e, reiniciar, { passive: true })
    return () => {
      window.clearTimeout(temporitzador)
      for (const e of ESDEVENIMENTS) window.removeEventListener(e, reiniciar)
    }
  }, [actiu, bloquejar, ms])
}
