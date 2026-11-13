// Textos de l'evolució que fan servir diversos components

import type { ResumEscala } from '../domini/evolucio'
import { formatar, t } from '../i18n/t'

/** Un valor d'escala en català (4,5) */
export const nombre = (n: number) => n.toLocaleString('ca', { maximumFractionDigits: 2 })

/** «−57 %», «+20 %» */
export function textPercentatge(p: number): string {
  return formatar(t.evolucio.percentatge, { signe: p > 0 ? '+' : p < 0 ? '−' : '', n: String(Math.abs(p)) })
}

/** «De 7 a 3 en 6 sessions (−57 %)» */
export function textResum(r: ResumEscala): string {
  const valors = { inicial: nombre(r.inicial), final: nombre(r.final), n: String(r.sessions) }
  if (r.percentatge === null) return formatar(t.evolucio.resumSensePercentatge, valors)
  return formatar(t.evolucio.resum, { ...valors, percentatge: textPercentatge(r.percentatge) })
}
