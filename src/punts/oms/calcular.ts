// Calcula les posicions de tots els punts amb regla sobre el cos definitiu.

import type { Vector3 } from 'three'
import type { ModelCos } from '../../mapa/model'
import type { Posicio3D } from '../esquema'
import { CosMesurable, type Costat, type DadesMakeHuman } from './cos'
import { calcularReferencies, type Referencies } from './referencies'
import { REGLES } from './regles'

export interface PuntCalculat {
  codi: string
  costat: Costat | 'C'
  /** Subpunt (0 si el punt només en té un) */
  index: number
  punt: Vector3
  posicio: Posicio3D
}

export interface ResultatCalcul {
  referencies: Referencies
  punts: PuntCalculat[]
  /** Accés ràpid: `${codi}|${costat}` (o `${codi}|${costat}|${index}` per als subpunts) → punt sobre la pell */
  perId: Map<string, PuntCalculat>
}

export function calcularPunts(model: ModelCos, dades: DadesMakeHuman): ResultatCalcul {
  const c = new CosMesurable(model, dades)
  const referencies = calcularReferencies(c)
  const punts: PuntCalculat[] = []
  const perId = new Map<string, PuntCalculat>()
  for (const def of REGLES) {
    for (const costat of def.mitja ? (['C'] as const) : (['E', 'D'] as const)) {
      const delMateixCostat = costat === 'C' ? 'E' : costat
      const punt = (codi: string, quin: Costat | 'C' = costat) => {
        const p = perId.get(`${codi}|${quin}`) ?? perId.get(`${codi}|C`)
        if (!p) throw new Error(`${def.codi} necessita ${codi}, que encara no s'ha calculat`)
        return p.punt.clone()
      }
      const n = def.subpunts?.length ?? 1
      for (let index = 0; index < n; index++) {
        const brut = def.calcular(c, referencies, delMateixCostat, punt, index)
        const malla = c.aLaPell(brut)
        const calculat: PuntCalculat = {
          codi: def.codi,
          costat,
          index,
          punt: c.puntDe(malla),
          posicio: {
            topologia: model.topologia,
            costat,
            ...(index > 0 ? { index } : {}),
            triangle: malla.triangle,
            b: malla.b,
            origen: 'oms',
          },
        }
        punts.push(calculat)
        perId.set(clauCalcul(def.codi, costat, index), calculat)
      }
    }
  }
  return { referencies, punts, perId }
}

export function clauCalcul(codi: string, costat: Costat | 'C', index = 0): string {
  return index > 0 ? `${codi}|${costat}|${index}` : `${codi}|${costat}`
}
