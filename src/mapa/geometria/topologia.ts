// Empremta de la topologia d'una malla: depèn només de quins vèrtexs formen
// cada triangle (l'índex), no de les posicions. Dos cossos generats amb
// MakeHuman i exportats igual tenen la mateixa empremta encara que siguin
// d'alçada o complexió diferents; per això els punts calibrats els serveixen.

import type { BufferGeometry } from 'three'

/** FNV-1a de 32 bits sobre els índexs. Prou per detectar malles diferents. */
function fnv1a(valors: ArrayLike<number>): string {
  let h = 0x811c9dc5
  for (let i = 0; i < valors.length; i++) {
    let v = valors[i]!
    for (let k = 0; k < 4; k++) {
      h ^= v & 0xff
      h = Math.imul(h, 0x01000193)
      v >>>= 8
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function empremtaTopologia(prefix: string, geom: BufferGeometry): string {
  const idx = geom.getIndex()
  if (!idx) throw new Error('La geometria del cos ha de ser indexada')
  const vertexs = geom.getAttribute('position').count
  return `${prefix}-${vertexs}v-${idx.count / 3}t-${fnv1a(idx.array)}`
}
