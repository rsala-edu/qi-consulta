// Noms de les tècniques per mostrar-les (cada mapa té els seus).

import type { PuntMarcat } from '../../domini/puntMarcat'
import { t } from '../../i18n/t'

export function nomTecnica(m: Pick<PuntMarcat, 'mapa' | 'tecnica'>): string {
  return m.mapa === 'orella' ? t.orella.tecnica[m.tecnica as keyof typeof t.orella.tecnica] : t.mapa.tecnica[m.tecnica]
}

/** Els noms llargs de tècnica ocupen tota la fila de la graella (així no es tallen mai) */
export function nomAmple(nom: string): string | undefined {
  return nom.length > 16 ? 'ample' : undefined
}
