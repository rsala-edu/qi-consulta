// Quant fa que no es pot fer cap còpia a Drive. Passades 24 hores seguides,
// la píndola ho diu clarament i la pantalla Avui en mostra un avís.

import { formatar, t } from '../i18n/t'

export const LIMIT_SENSE_COPIA = 24 * 3_600_000

/** Dies sencers sense còpia (mínim 1) si en fa més de 24 hores; si no, null */
export function diesSenseCopia(desDe: string | null, ara: number = Date.now()): number | null {
  if (!desDe) return null
  const ms = ara - new Date(desDe).getTime()
  if (!(ms > LIMIT_SENSE_COPIA)) return null
  return Math.max(1, Math.floor(ms / 86_400_000))
}

/** «Fa 2 dies que no es fa cap còpia» */
export function textSenseCopia(dies: number): string {
  return dies === 1 ? t.sincronia.unDiaSenseCopia : formatar(t.sincronia.diesSenseCopia, { n: String(dies) })
}
