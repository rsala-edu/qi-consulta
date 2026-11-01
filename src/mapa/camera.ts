// Configuració de la càmera i vistes ràpides. La càmera gira al voltant de
// l'eix vertical (angle polar fix a 90°): és com si la persona fes una volta.

import { Vector3 } from 'three'

export const VISTES = {
  davant: 0,
  /** Costat esquerre del pacient (+X): la càmera hi és a +X */
  esquerra: Math.PI / 2,
  darrere: Math.PI,
  dreta: -Math.PI / 2,
} as const

export type Vista = keyof typeof VISTES

export const CAMERA = {
  fov: 35,
  /** Alçada a la qual mira la càmera al principi (centre del cos) */
  alcadaInicial: 0.92,
  distanciaInicial: 4.4,
  distanciaMinima: 0.22,
  distanciaMaxima: 7,
  /** Angle polar fix: la càmera sempre mira horitzontal */
  polar: Math.PI / 2,
  /** On pot anar el punt de mira en desplaçar (metres) */
  limits: { min: [-0.7, -0.05, -0.4], max: [0.7, 1.85, 0.4] },
} as const

/**
 * Angle d'azimut equivalent a `objectiu` més proper a `actual`. L'azimut de
 * camera-controls és acumulatiu (cada volta suma 2π); així el gir cap a una
 * vista sempre va pel camí curt.
 */
export function azimutMesProper(actual: number, objectiu: number): number {
  const volta = Math.PI * 2
  let delta = (objectiu - actual) % volta
  if (delta > Math.PI) delta -= volta
  if (delta < -Math.PI) delta += volta
  return actual + delta
}

export type NivellEtiquetes = 'cap' | 'codi' | 'pinyin'

/**
 * Amb el cos sencer, etiquetes només si hi ha un meridià filtrat (si no,
 * s'amunteguen i tapen els punts). En ampliar, el codi; molt a prop, també
 * el pinyin.
 */
export function nivellEtiquetes(distancia: number, meridiaFiltrat = false): NivellEtiquetes {
  if (distancia > 1.6) return meridiaFiltrat ? 'codi' : 'cap'
  if (distancia > 1.1) return 'codi'
  return 'pinyin'
}

/**
 * On posar la càmera per mirar un punt de cara: a la mateixa alçada (la
 * càmera és horitzontal) i en la direcció horitzontal de la normal. Si la
 * normal és gairebé vertical (cap, empenya), es manté l'azimut actual.
 */
export function vistaCapAlPunt(
  punt: Vector3,
  normal: Vector3,
  azimutActual: number,
  distancia = 0.75,
): { camera: Vector3; objectiu: Vector3 } {
  const horitzontal = new Vector3(normal.x, 0, normal.z)
  if (horitzontal.lengthSq() < 0.04) {
    horitzontal.set(Math.sin(azimutActual), 0, Math.cos(azimutActual))
  }
  horitzontal.normalize()
  return {
    camera: punt.clone().addScaledVector(horitzontal, distancia),
    objectiu: punt.clone(),
  }
}
