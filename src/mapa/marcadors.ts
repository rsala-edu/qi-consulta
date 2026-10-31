// Del catàleg als punts concrets sobre el model carregat.

import { Vector3 } from 'three'
import type { Cataleg, CostatPosicio, PuntCatalog } from '../punts/esquema'
import { normalTriangle, nombreTriangles, puntDesDePosicio } from './geometria/baricentriques'
import type { ModelCos } from './model'

export interface PuntSobreModel {
  /** `${codi}|${costat}` */
  id: string
  punt: PuntCatalog
  costat: CostatPosicio
  posicio: Vector3
  normal: Vector3
}

export function idMarcador(codi: string, costat: CostatPosicio): string {
  return `${codi}|${costat}`
}

export function llegirIdMarcador(id: string): { codi: string; costat: CostatPosicio } {
  const [codi, costat] = id.split('|') as [string, CostatPosicio]
  return { codi, costat }
}

/**
 * Totes les posicions del catàleg que corresponen a la topologia del model.
 * Les d'una altra malla (o amb un triangle que no existeix) s'ignoren.
 */
export function puntsSobreModel(c: Cataleg, model: ModelCos, meridia?: string): PuntSobreModel[] {
  const triangles = nombreTriangles(model.geometria)
  const resultat: PuntSobreModel[] = []
  for (const punt of c.punts) {
    if (meridia && punt.meridia !== meridia) continue
    for (const q of punt.posicions) {
      if (q.topologia !== model.topologia || q.triangle >= triangles) continue
      resultat.push({
        id: idMarcador(punt.codi, q.costat),
        punt,
        costat: q.costat,
        posicio: puntDesDePosicio(model.geometria, q),
        normal: normalTriangle(model.geometria, q.triangle),
      })
    }
  }
  return resultat
}

/** Recorregut d'un meridià per a cada costat, en ordre de numeració. */
export function recorregutsMeridia(punts: readonly PuntSobreModel[], meridia: string): Vector3[][] {
  const perCostat = new Map<CostatPosicio, PuntSobreModel[]>()
  for (const p of punts) {
    if (p.punt.meridia !== meridia) continue
    perCostat.set(p.costat, [...(perCostat.get(p.costat) ?? []), p])
  }
  return [...perCostat.values()].map((l) => l.sort((a, b) => a.punt.numero - b.punt.numero).map((p) => p.posicio))
}
