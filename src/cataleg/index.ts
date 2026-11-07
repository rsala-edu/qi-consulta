// Tots els catàlegs clínics, per id de grup. Els textos són a cada fitxer
// (valoracio.ts, …) i les fonts a fonts.ts.

import type { Grup, Seccio } from './tipus'
import { ANAMNESI, CONSTITUCIO, MOTIU } from './valoracio'
import { EXPLORACIO } from './exploracio'

/** Els grups de la valoració inicial (una per episodi), en l'ordre de la pestanya */
export const GRUPS_VALORACIO: readonly Grup[] = [MOTIU, ANAMNESI, CONSTITUCIO]

/** L'exploració: a cada sessió (la primera i les de seguiment) */
export { EXPLORACIO }

export const GRUPS: readonly Grup[] = [...GRUPS_VALORACIO, EXPLORACIO]

export function grup(id: string): Grup | undefined {
  return GRUPS.find((g) => g.id === id)
}

/**
 * Nom llegible d'un camí de camp desat («seccions.anamnesi:son.valors.alteracions»
 * o «exploracio.seccions.exploracio:pols.altres»): «Son · Alteracions».
 */
export function etiquetaCami(cami: string): string | undefined {
  const parts = cami.split('.')
  const i = parts.findIndex((p) => seccio(p))
  if (i < 0) return undefined
  const s = seccio(parts[i]!)!
  const resta = parts.slice(i + 1)
  if (resta[0] === 'valors' && resta[1]) return `${s.ca} · ${s.camps.find((c) => c.id === resta[1])?.ca ?? resta[1]}`
  if (resta[0] === 'altres') return `${s.ca} · Altres / observacions`
  return s.ca
}

export function seccio(id: string): Seccio | undefined {
  for (const g of GRUPS) {
    const s = g.seccions.find((x) => x.id === id)
    if (s) return s
  }
  return undefined
}
