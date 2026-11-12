import { useSyncExternalStore } from 'react'
import { canviarTema, llegirTema, sistemaEsFosc, subscriureSistema, subscriureTema, type Tema } from './tema'

export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(subscriureTema, llegirTema, () => 'sistema' as Tema)
  return [tema, canviarTema]
}

/** El sistema (navegador) demana el mode fosc */
export function useSistemaFosc(): boolean {
  return useSyncExternalStore(subscriureSistema, sistemaEsFosc, () => false)
}
