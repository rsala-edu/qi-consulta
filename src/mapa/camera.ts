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

export type NivellEtiquetes = 'cap' | 'cos' | 'codi' | 'pinyin' | 'detall'

/**
 * Amb el cos sencer, etiquetes només si hi ha un meridià filtrat (si no,
 * s'amunteguen i tapen els punts). En ampliar, el codi; a prop (en anar a un
 * punt), també el pinyin; ampliant encara més, el detall (els nivells de
 * Jiaji, T1…L5, en lloc d'una sola etiqueta per al grup).
 */
export function nivellEtiquetes(distancia: number, meridiaFiltrat = false): NivellEtiquetes {
  if (distancia > 1.6) return meridiaFiltrat ? 'cos' : 'cap'
  if (distancia > 1.1) return 'codi'
  if (distancia > 0.55) return 'pinyin'
  return 'detall'
}

/**
 * Els punts del dors i de les puntes dels dits del peu (Bafeng, Qiduan, ST44)
 * són tan a prop els uns dels altres i del terra que, mirats a l'altura del
 * peu, es trepitgen: es miren des de més amunt i més a prop.
 */
export const VISTA_PEU = {
  /** Alçada màxima d'un punt del dors del peu (pell cap amunt) (m) */
  alcada: 0.08,
  /** Per sota d'aquesta alçada, les puntes dels dits encara que mirin endavant (m) */
  alcadaDits: 0.03,
  /** Angle polar de la càmera: 45° des de la vertical (a mig camí entre de cara i des de dalt) */
  polar: Math.PI / 4,
  distancia: 0.34,
} as const

/**
 * On posar la càmera per mirar un punt de cara: a la mateixa alçada (la
 * càmera és horitzontal) i en la direcció horitzontal de la normal. Si la
 * normal és gairebé vertical (cap, empenya), es manté l'azimut actual. Al
 * peu (llevat de la planta), la càmera mira des de dalt i més a prop.
 */
export function vistaCapAlPunt(
  punt: Vector3,
  normal: Vector3,
  azimutActual: number,
  distancia = 0.75,
): { camera: Vector3; objectiu: Vector3; polar: number } {
  const horitzontal = new Vector3(normal.x, 0, normal.z)
  if (horitzontal.lengthSq() < 0.04) {
    horitzontal.set(Math.sin(azimutActual), 0, Math.cos(azimutActual))
  }
  horitzontal.normalize()
  const peu =
    normal.y > -0.5 && // la planta no
    ((punt.y < VISTA_PEU.alcada && normal.y > 0.3) || punt.y < VISTA_PEU.alcadaDits)
  if (peu) {
    const d = VISTA_PEU.distancia
    return {
      camera: punt
        .clone()
        .addScaledVector(horitzontal, d * Math.sin(VISTA_PEU.polar))
        .add(new Vector3(0, d * Math.cos(VISTA_PEU.polar), 0)),
      objectiu: punt.clone(),
      polar: VISTA_PEU.polar,
    }
  }
  return {
    camera: punt.clone().addScaledVector(horitzontal, distancia),
    objectiu: punt.clone(),
    polar: CAMERA.polar,
  }
}
