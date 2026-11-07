// Audiometria tonal: freqüències, vies i PTA (sense React, per al resum i les proves).

export const FREQUENCIES = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const
export const VIES = [
  { id: 'D_aeria', orella: 'D', via: 'aeria' },
  { id: 'D_ossia', orella: 'D', via: 'ossia' },
  { id: 'E_aeria', orella: 'E', via: 'aeria' },
  { id: 'E_ossia', orella: 'E', via: 'ossia' },
] as const

/** Clau d'un llindar: «D_aeria_1000» (sense punts: es fusiona camp a camp) */
export const clauLlindar = (via: string, f: number) => `${via}_${f}`

/** PTA (mitjana de 500, 1.000, 2.000 i 4.000 Hz) d'una via; null si en falta algun */
export function pta(llindars: Readonly<Record<string, number>>, via: string): number | null {
  const v = [500, 1000, 2000, 4000].map((f) => llindars[clauLlindar(via, f)])
  if (v.some((x) => x === undefined)) return null
  return Math.round(((v as number[]).reduce((a, b) => a + b, 0) / 4) * 10) / 10
}
