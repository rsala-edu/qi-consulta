// Posicions sobre la pell expressades com a triangle + coordenades baricèntriques.
// Funciona amb qualsevol BufferGeometry indexada en l'espai del model.

import { BufferGeometry, Triangle, Vector3 } from 'three'
import type { CostatPosicio, Posicio3D } from '../../punts/esquema'

export interface PosicioMalla {
  triangle: number
  b: [number, number, number]
}

function index(geom: BufferGeometry) {
  const idx = geom.getIndex()
  if (!idx) throw new Error('La geometria del cos ha de ser indexada')
  return idx
}

export function nombreTriangles(geom: BufferGeometry): number {
  return index(geom).count / 3
}

/** Els tres vèrtexs d'un triangle. */
export function verticesTriangle(geom: BufferGeometry, triangle: number): [Vector3, Vector3, Vector3] {
  const idx = index(geom)
  if (triangle < 0 || triangle >= idx.count / 3) throw new RangeError(`Triangle fora de la malla: ${triangle}`)
  const pos = geom.getAttribute('position')
  const v = (k: number) => new Vector3().fromBufferAttribute(pos, idx.getX(triangle * 3 + k))
  return [v(0), v(1), v(2)]
}

/** Punt de la pell a partir del triangle i les baricèntriques. */
export function puntDesDePosicio(geom: BufferGeometry, p: PosicioMalla, desti = new Vector3()): Vector3 {
  const [a, b, c] = verticesTriangle(geom, p.triangle)
  return desti
    .set(0, 0, 0)
    .addScaledVector(a, p.b[0])
    .addScaledVector(b, p.b[1])
    .addScaledVector(c, p.b[2])
}

/** Normal (cap a fora) del triangle, segons l'ordre dels vèrtexs. */
export function normalTriangle(geom: BufferGeometry, triangle: number, desti = new Vector3()): Vector3 {
  const [a, b, c] = verticesTriangle(geom, triangle)
  return new Triangle(a, b, c).getNormal(desti)
}

/**
 * Baricèntriques d'un punt (proper al triangle) dins el triangle. Es fixen
 * dins el triangle (0..1) i es normalitzen perquè sumin exactament 1.
 */
export function posicioDesDePunt(geom: BufferGeometry, triangle: number, punt: Vector3): PosicioMalla {
  const [a, b, c] = verticesTriangle(geom, triangle)
  const t = new Triangle(a, b, c)
  const dins = t.closestPointToPoint(punt, new Vector3())
  const bar = t.getBarycoord(dins, new Vector3())
  if (!bar) throw new Error('Triangle degenerat')
  const [x, y, z] = [bar.x, bar.y, bar.z].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number]
  const suma = x + y + z
  const b0 = arrodonir(x / suma)
  const b1 = arrodonir(y / suma)
  const b2 = Math.max(0, arrodonir(1 - b0 - b1))
  return { triangle, b: [b0, b1, b2] }
}

/** 6 decimals: precisió de micres a escala d'un cos; JSON més net. */
function arrodonir(x: number): number {
  return Math.round(x * 1e6) / 1e6
}

/** El punt de la malla més proper a un punt de l'espai (cerca exhaustiva). */
export function posicioMesPropera(geom: BufferGeometry, punt: Vector3): PosicioMalla {
  const n = nombreTriangles(geom)
  const t = new Triangle()
  const proper = new Vector3()
  let millor = -1
  let millorDist = Infinity
  for (let i = 0; i < n; i++) {
    const [a, b, c] = verticesTriangle(geom, i)
    t.set(a, b, c)
    t.closestPointToPoint(punt, proper)
    const d = proper.distanceToSquared(punt)
    if (d < millorDist) {
      millorDist = d
      millor = i
    }
  }
  return posicioDesDePunt(geom, millor, punt)
}

/**
 * Posició simètrica a l'altre costat del cos (reflex sobre el pla X = 0).
 * Serveix per calibrar un costat i copiar-lo a l'altre.
 */
export function posicioMirall(geom: BufferGeometry, p: PosicioMalla): PosicioMalla {
  const punt = puntDesDePosicio(geom, p)
  punt.x = -punt.x
  return posicioMesPropera(geom, punt)
}

export const COSTAT_OPOSAT: Record<CostatPosicio, CostatPosicio> = { E: 'D', D: 'E', C: 'C' }

/** Construeix una Posicio3D del catàleg. */
export function posicio3D(topologia: string, costat: CostatPosicio, p: PosicioMalla): Posicio3D {
  return { topologia, costat, triangle: p.triangle, b: p.b }
}
