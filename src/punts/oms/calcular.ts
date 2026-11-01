// Calcula les posicions de tots els punts amb regla sobre el cos definitiu.

import type { Vector3 } from 'three'
import type { ModelCos } from '../../mapa/model'
import type { Posicio3D } from '../esquema'
import { CosMesurable, type Costat } from './cos'
import { calcularReferencies, type Referencies } from './referencies'
import { REGLES } from './regles'

export interface PuntCalculat {
  codi: string
  costat: Costat
  punt: Vector3
  posicio: Posicio3D
}

export interface ResultatCalcul {
  referencies: Referencies
  punts: PuntCalculat[]
  /** Accés ràpid: `${codi}|${costat}` → punt sobre la pell */
  perId: Map<string, PuntCalculat>
}

export function calcularPunts(
  model: ModelCos,
  articulacions: Readonly<Record<string, readonly [number, number, number]>>,
): ResultatCalcul {
  const c = new CosMesurable(model, articulacions)
  const referencies = calcularReferencies(c)
  const punts: PuntCalculat[] = []
  for (const def of REGLES) {
    for (const costat of ['E', 'D'] as const) {
      const brut = def.calcular(c, referencies, costat)
      const malla = c.aLaPell(brut)
      punts.push({
        codi: def.codi,
        costat,
        punt: c.puntDe(malla),
        posicio: { topologia: model.topologia, costat, triangle: malla.triangle, b: malla.b, origen: 'oms' },
      })
    }
  }
  return { referencies, punts, perId: new Map(punts.map((p) => [`${p.codi}|${p.costat}`, p])) }
}
