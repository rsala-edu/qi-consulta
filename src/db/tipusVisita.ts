// Aplica el tipus de visita automàtic (src/domini/tipusVisita.ts) a les cites
// desades: després de crear, moure, anul·lar o esborrar una cita, i una sola
// vegada a les cites que ja hi havia (migració).

import type { Cita, TipusCita } from '../domini/cita'
import { canvisDeTipus } from '../domini/tipusVisita'
import type { QiDB } from './esquema'
import type { Magatzem } from './magatzem'

export interface CanviTipus {
  id: string
  inici: string
  tipus: TipusCita
}

async function aplicar(magatzem: Magatzem, cites: readonly Cita[]): Promise<CanviTipus[]> {
  const canvis = canvisDeTipus(cites)
  for (const { cita, tipus } of canvis) await magatzem.actualitzarCita(cita.id, { ...cita, tipus })
  return canvis.map(({ cita, tipus }) => ({ id: cita.id, inici: cita.inici, tipus }))
}

/** Recalcula les cites dels pacients indicats; torna les que han canviat */
export async function recalcularTipusVisita(magatzem: Magatzem, pacientIds: Iterable<string>): Promise<CanviTipus[]> {
  const ids = new Set(pacientIds)
  const cites = (await magatzem.llistarCites('0000', '9999')).filter((c) => ids.has(c.pacientId))
  return aplicar(magatzem, cites)
}

/** Una sola vegada per dispositiu: aplica la regla a totes les cites programades que ja hi ha */
export async function migrarTipusVisita(db: QiDB, magatzem: Magatzem): Promise<number> {
  if (await db.meta.get('tipusVisitaAutomatic')) return 0
  const canvis = await aplicar(magatzem, await magatzem.llistarCites('0000', '9999'))
  await db.meta.put({ clau: 'tipusVisitaAutomatic', valor: new Date().toISOString() })
  return canvis.length
}
