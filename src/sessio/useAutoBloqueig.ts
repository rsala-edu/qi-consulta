import { useEffect } from 'react'

const ESDEVENIMENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Crida `bloquejar` després de `ms` mil·lisegons sense cap interacció.
 * A la tauleta, mentre l'app és en segon pla (s'ha anat a una altra app o
 * s'ha apagat la pantalla) el navegador pot aturar els temporitzadors: en
 * tornar, es compta el temps real des de l'última interacció i, si ja s'ha
 * passat, es bloqueja de seguida.
 * `bloquejar` ha de ser estable (useCallback).
 */
export function useAutoBloqueig(actiu: boolean, bloquejar: () => void, ms: number): void {
  useEffect(() => {
    if (!actiu) return
    let ultima = Date.now()
    let temporitzador = window.setTimeout(bloquejar, ms)
    const programar = (espera: number) => {
      window.clearTimeout(temporitzador)
      temporitzador = window.setTimeout(bloquejar, espera)
    }
    const reiniciar = () => {
      ultima = Date.now()
      programar(ms)
    }
    const enTornar = () => {
      if (document.visibilityState !== 'visible') return
      const passat = Date.now() - ultima
      if (passat >= ms) {
        window.clearTimeout(temporitzador)
        bloquejar()
      } else programar(ms - passat)
    }
    for (const e of ESDEVENIMENTS) window.addEventListener(e, reiniciar, { passive: true })
    document.addEventListener('visibilitychange', enTornar)
    return () => {
      window.clearTimeout(temporitzador)
      for (const e of ESDEVENIMENTS) window.removeEventListener(e, reiniciar)
      document.removeEventListener('visibilitychange', enTornar)
    }
  }, [actiu, bloquejar, ms])
}
