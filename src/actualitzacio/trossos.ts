// Trossos de l'app que es carreguen a part (el mapa, el calibratge…). Si
// l'app és oberta mentre es publica una versió nova, el tros de la versió
// vella pot no ser al servidor: l'app es torna a carregar sola, un cop, amb la
// versió nova (les dades són a IndexedDB i el que no s'ha pujat és a la cua:
// no es perd res). Si ja s'ha provat fa poc, no es torna a provar (sense
// bucles): el límit d'error mostra «Hi ha una versió nova · Actualitzar».

import { lazy, type ComponentType } from 'react'
import { actualitzarAra } from './actualitzacio'

const CLAU = 'qi:recarrega-per-tros'
/** Si s'ha recarregat fa menys d'això i torna a fallar, no es torna a recarregar sola */
const MARGE = 60_000

/** L'error és d'un tros de l'app que no s'ha pogut carregar */
export function esErrorDeTros(error: unknown): boolean {
  const missatge = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script/i.test(missatge)
}

/** Torna a carregar amb la versió nova, si no s'ha fet fa poc. Torna si ho fa */
export function recarregarPerTros(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(CLAU) ?? 0) < MARGE) return false
    sessionStorage.setItem(CLAU, String(Date.now()))
  } catch {
    return false
  }
  actualitzarAra()
  return true
}

/** Com `lazy`, però si el tros no hi és, l'app es torna a carregar amb la versió nova */
// oxlint-disable-next-line no-explicit-any -- la mateixa signatura que `lazy`
export function lazyAmbVersio<T extends ComponentType<any>>(carregar: () => Promise<{ default: T }>) {
  return lazy<T>(() =>
    carregar().catch((error: unknown) => {
      // Mentre es recarrega, es continua veient l'indicador de càrrega
      if (esErrorDeTros(error) && recarregarPerTros()) return new Promise<never>(() => {})
      throw error
    }),
  )
}

/** Vite avisa quan no pot precarregar un tros (JS o CSS) */
export function vigilarTrossos(): void {
  window.addEventListener('vite:preloadError', (e) => {
    if (recarregarPerTros()) e.preventDefault()
  })
}
