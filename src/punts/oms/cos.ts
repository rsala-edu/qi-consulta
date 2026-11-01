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

export class CosMesurable {
  readonly model: ModelCos
  private readonly articulacions: Readonly<Record<string, readonly [number, number, number]>>
  private readonly malla: Mesh
  private readonly raig = new Raycaster()

  constructor(model: ModelCos, articulacions: Readonly<Record<string, readonly [number, number, number]>>) {
    this.model = model
    this.articulacions = articulacions
    this.malla = new Mesh(model.geometria, new MeshBasicMaterial({ side: DoubleSide }))
    this.malla.updateMatrixWorld()
  }

  /** Centre d'una articulació de MakeHuman (p. ex. «knee» amb costat E → «l-knee»). */
  art(nom: string, costat?: Costat): Vector3 {
    const clau = costat ? `${costat === 'E' ? 'l' : 'r'}-${nom}` : nom
    const a = this.articulacions[clau]
    if (!a) throw new ErrorMesura(`Articulació desconeguda: ${clau}`)
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

  /** Vèrtexs de la malla dins d'una capsa, per buscar extrems (mugró…). */
  vertexsDins(min: Vector3, max: Vector3): Vector3[] {
    const pos = this.model.geometria.getAttribute('position')
    const r: Vector3[] = []
    const t = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      t.fromBufferAttribute(pos, i)
      if (t.x >= min.x && t.x <= max.x && t.y >= min.y && t.y <= max.y && t.z >= min.z && t.z <= max.z) r.push(t.clone())
    }
    return r
  }
}
