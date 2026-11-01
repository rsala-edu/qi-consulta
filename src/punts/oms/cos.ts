// Eines per mesurar sobre el cos: articulacions de MakeHuman, raigs que
// surten de dins del cos fins a la pell i punt de la pell més proper.
// Coordenades glTF: metres, Y amunt, el cos mira cap a +Z, esquerra = +X.

import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { posicioMesPropera, puntDesDePosicio, type PosicioMalla } from '../../mapa/geometria/baricentriques'
import type { ModelCos } from '../../mapa/model'

export type Costat = 'E' | 'D'

/** +1 per a l'esquerre del pacient (+X), −1 per al dret. */
export function signe(costat: Costat): 1 | -1 {
  return costat === 'E' ? 1 : -1
}

export const AMUNT = new Vector3(0, 1, 0)
export const DAVANT = new Vector3(0, 0, 1)
export const DARRERE = new Vector3(0, 0, -1)

export function v(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z)
}

export function dir(...components: Array<[Vector3, number]>): Vector3 {
  const r = new Vector3()
  for (const [vec, pes] of components) r.addScaledVector(vec, pes)
  return r.normalize()
}

export class ErrorMesura extends Error {}

type Punt3 = readonly [number, number, number]

/** Dades que acompanyen el GLB (src/punts/articulacions.json) */
export interface DadesMakeHuman {
  articulacions: Readonly<Record<string, Punt3>>
  /** Punts de la pell trets de les deformacions de MakeHuman (mugró, melic, tragus) */
  referencies: Readonly<Record<string, Punt3>>
}

export class CosMesurable {
  readonly model: ModelCos
  private readonly dades: DadesMakeHuman
  private readonly malla: Mesh
  private readonly raig = new Raycaster()

  constructor(model: ModelCos, dades: DadesMakeHuman) {
    this.model = model
    this.dades = dades
    this.malla = new Mesh(model.geometria, new MeshBasicMaterial({ side: DoubleSide }))
    this.malla.updateMatrixWorld()
  }

  /** Centre d'una articulació de MakeHuman (p. ex. «knee» amb costat E → «l-knee»). */
  art(nom: string, costat?: Costat): Vector3 {
    return this.punt(this.dades.articulacions, nom, costat)
  }

  /** Referència de la pell de MakeHuman (p. ex. «mugro» amb costat E), projectada a la pell. */
  ref(nom: string, costat?: Costat): Vector3 {
    return this.puntDe(this.aLaPell(this.punt(this.dades.referencies, nom, costat)))
  }

  private punt(taula: Readonly<Record<string, Punt3>>, nom: string, costat?: Costat): Vector3 {
    const clau = costat ? `${costat === 'E' ? 'l' : 'r'}-${nom}` : nom
    const a = taula[clau]
    if (!a) throw new ErrorMesura(`Referència desconeguda: ${clau}`)
    return new Vector3(a[0], a[1], a[2])
  }

  /** Primer punt de la pell en sortir de `origen` (dins el cos) en la direcció `direccio`. */
  pell(origen: Vector3, direccio: Vector3, maxim = 0.4): Vector3 {
    this.raig.set(origen, direccio.clone().normalize())
    this.raig.far = maxim
    const hit = this.raig.intersectObject(this.malla, false).find((h) => h.distance > 1e-5)
    if (!hit) throw new ErrorMesura(`El raig no troba la pell des de ${origen.toArray().map((x) => x.toFixed(3))}`)
    return hit.point.clone()
  }

  /**
   * Primer punt de la pell venint de fora: des de `punt + direccio · distancia`
   * cap al cos. Per a la cara, on els raigs des de dins toparien amb les
   * cavitats internes de la malla (boca, òrbites).
   */
  pellDesDeFora(punt: Vector3, direccio: Vector3, distancia = 0.4): Vector3 {
    const d = direccio.clone().normalize()
    return this.pell(punt.clone().addScaledVector(d, distancia), d.negate(), distancia * 2)
  }

  /**
   * Punt de màxima curvatura convexa de la pell a prop d'un punt: el centre
   * dels `n` vèrtexs on les normals dels veïns se separen més. Serveix per
   * trobar relleus petits i marcats, com el mugró.
   */
  curvaturaMaxima(prop: Vector3, radi: number, n = 4): Vector3 {
    const geo = this.model.geometria
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    const idx = geo.getIndex()!
    const P = (i: number) => new Vector3().fromBufferAttribute(pos, i)
    const N = (i: number) => new Vector3().fromBufferAttribute(nor, i)
    const dins = new Set<number>()
    for (let i = 0; i < pos.count; i++) if (P(i).distanceTo(prop) <= radi) dins.add(i)
    const veins = new Map<number, Set<number>>()
    const afegir = (a: number, b: number) => {
      if (!dins.has(a)) return
      if (!veins.has(a)) veins.set(a, new Set())
      veins.get(a)!.add(b)
    }
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)]
      for (const [u, w] of [[a, b], [b, a], [b, c], [c, b], [c, a], [a, c]] as const) afegir(u, w)
    }
    const curvatures = [...veins.entries()].map(([i, vs]) => {
      const p = P(i)
      const ni = N(i)
      let k = 0
      for (const j of vs) {
        const d = P(j).sub(p)
        k += N(j).sub(ni).dot(d) / d.lengthSq()
      }
      return { i, k: k / vs.size }
    })
    curvatures.sort((a, b) => b.k - a.k)
    const millors = curvatures.slice(0, n).map((c) => P(c.i))
    const centre = millors.reduce((s, p) => s.add(p), new Vector3()).divideScalar(millors.length)
    return this.puntDe(this.aLaPell(centre))
  }

  /** Com `pell`, però retorna null si no hi ha pell en aquesta direcció. */
  pellOpcional(origen: Vector3, direccio: Vector3, maxim = 0.4): Vector3 | null {
    try {
      return this.pell(origen, direccio, maxim)
    } catch {
      return null
    }
  }

  /** El punt de la pell més proper, com a posició de la malla. */
  aLaPell(p: Vector3): PosicioMalla {
    return posicioMesPropera(this.model.geometria, p)
  }

  puntDe(p: PosicioMalla): Vector3 {
    return puntDesDePosicio(this.model.geometria, p)
  }
}
