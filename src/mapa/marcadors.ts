// Del catàleg als punts concrets sobre el model carregat.

import { Vector3 } from 'three'
import type { Cataleg, CostatPosicio, PuntCatalog } from '../punts/esquema'
import { normalTriangle, nombreTriangles, puntDesDePosicio } from './geometria/baricentriques'
import type { ModelCos } from './model'

export interface PuntSobreModel {
  /** `${codi}|${costat}` (o `${codi}|${costat}|${index}` per als subpunts) */
  id: string
  punt: PuntCatalog
  costat: CostatPosicio
  /** Subpunt (0 si el codi només en té un) */
  index: number
  posicio: Vector3
  normal: Vector3
}

export function idMarcador(codi: string, costat: CostatPosicio, index = 0): string {
  return index > 0 ? `${codi}|${costat}|${index}` : `${codi}|${costat}`
}

export function llegirIdMarcador(id: string): { codi: string; costat: CostatPosicio; index: number } {
  const [codi, costat, index] = id.split('|') as [string, CostatPosicio, string | undefined]
  return { codi, costat, index: index ? Number(index) : 0 }
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
        id: idMarcador(punt.codi, q.costat, q.index),
        punt,
        costat: q.costat,
        index: q.index ?? 0,
        posicio: puntDesDePosicio(model.geometria, q),
        normal: normalTriangle(model.geometria, q.triangle),
      })
    }
  }
  return resultat
}

/**
 * Recorregut d'un meridià per a cada costat, en ordre de numeració. Els
 * punts de branca (p. ex. ST40) no entren a la línia principal: es dibuixen
 * com un segment curt des del punt d'on surten.
 */
export function recorregutsMeridia(
  punts: readonly PuntSobreModel[],
  meridia: string,
  recorregut: readonly (readonly string[])[] | null = null,
): Vector3[][] {
  const perCostat = new Map<CostatPosicio, PuntSobreModel[]>()
  for (const p of punts) {
    if (p.punt.meridia !== meridia) continue
    perCostat.set(p.costat, [...(perCostat.get(p.costat) ?? []), p])
  }
  const linies: Vector3[][] = []
  // Recorregut explícit (p. ex. BL, amb dues línies a l'esquena)
  if (recorregut) {
    for (const llista of perCostat.values()) {
      const perCodi = new Map(llista.map((p) => [p.punt.codi, p.posicio]))
      for (const cadena of recorregut) {
        const linia = cadena.map((codi) => perCodi.get(codi)).filter((v): v is Vector3 => v !== undefined)
        if (linia.length > 1) linies.push(linia)
      }
    }
    return linies
  }
  for (const llista of perCostat.values()) {
    const ordenats = [...llista].sort((a, b) => a.punt.numero - b.punt.numero)
    linies.push(ordenats.filter((p) => !p.punt.brancaDe).map((p) => p.posicio))
    for (const branca of ordenats.filter((p) => p.punt.brancaDe)) {
      const origen = ordenats.find((p) => p.punt.codi === branca.punt.brancaDe)
      if (origen) linies.push([origen.posicio, branca.posicio])
    }
  }
  return linies
}
