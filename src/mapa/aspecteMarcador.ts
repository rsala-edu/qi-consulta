// Com es dibuixa cada punt al cos 3D. El punt seleccionat es marca amb un
// anell fosc al voltant, sense canviar-ne el color de dins: si ja té una
// tècnica (la moxa és taronja), s'hi continua veient.

/** Punts sense marcar: petits, en gris jade suau */
export const COLOR_NEUTRE = '#8aa096'
/** Vora blanca dels punts marcats i del seleccionat */
export const COLOR_VORA = '#ffffff'
/** Anell del punt seleccionat: tinta */
export const COLOR_ANELL = '#1f2421'

/** Radis (m) */
export const RADI_NEUTRE = 0.0055
export const RADI_MARCAT = 0.0095

export interface AspecteMarcador {
  /** Radi del disc de color */
  radi: number
  color: string
  /** Radi exterior de la vora blanca (o null si no en té) */
  vora: number | null
  /** Anell del seleccionat: radis interior i exterior (o null) */
  anell: [number, number] | null
}

export function aspecteMarcador(m: { color?: string; destacat?: boolean }): AspecteMarcador {
  const color = m.color ?? COLOR_NEUTRE
  // El seleccionat té la mida d'un punt marcat encara que no ho estigui
  const radi = m.destacat || m.color !== undefined ? RADI_MARCAT : RADI_NEUTRE
  const ambVora = m.destacat || m.color !== undefined
  return {
    radi,
    color,
    vora: ambVora ? radi * 1.25 : null,
    anell: m.destacat ? [radi * 1.45, radi * 1.95] : null,
  }
}
