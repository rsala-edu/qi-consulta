// Nom curt d'un punt per a les llistes: el pinyin dels del cos i el nom dels de l'orella

import type { Mapa } from '../domini/puntMarcat'
import { puntOrella } from '../orella/cataleg'
import { cataleg } from '../punts/cataleg'

export function nomPunt(mapa: Mapa, codi: string): string {
  return (mapa === 'orella' ? puntOrella(codi)?.nom : cataleg.punts.find((x) => x.codi === codi)?.pinyin) ?? ''
}
