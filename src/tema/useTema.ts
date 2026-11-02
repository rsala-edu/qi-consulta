import { useSyncExternalStore } from 'react'
import { canviarTema, llegirTema, subscriureTema, type Tema } from './tema'

export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(subscriureTema, llegirTema, () => 'sistema' as Tema)
  return [tema, canviarTema]
}
