// Tots els catàlegs clínics, per id de grup. Els textos són a cada fitxer
// (valoracio.ts, …) i les fonts a fonts.ts.

import type { Grup, Seccio } from './tipus'
import { ANAMNESI, CONSTITUCIO, MOTIU } from './valoracio'

/** Els grups de la valoració inicial (una per episodi), en l'ordre de la pestanya */
export const GRUPS_VALORACIO: readonly Grup[] = [MOTIU, ANAMNESI, CONSTITUCIO]

export const GRUPS: readonly Grup[] = [...GRUPS_VALORACIO]

export function grup(id: string): Grup | undefined {
  return GRUPS.find((g) => g.id === id)
}

export function seccio(id: string): Seccio | undefined {
  for (const g of GRUPS) {
    const s = g.seccions.find((x) => x.id === id)
    if (s) return s
  }
  return undefined
}
