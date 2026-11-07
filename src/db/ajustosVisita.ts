// Ajustos > Visita: el temps de retenció de les agulles per defecte, el so en
// acabar i el control d'agulles. No són dades de pacient: van sense xifrar i
// se sincronitzen amb els altres dispositius (com l'horari).

import { z } from 'zod'
import { MINUTS_RETENCIO } from '../domini/sessio'
import { desarSencer } from '../sincronia/escriptura'
import type { QiDB } from './esquema'

export const esquemaAjustosVisita = z.object({
  minutsRetencio: z.number().int().min(1).max(120),
  so: z.boolean(),
  controlAgulles: z.boolean(),
})
export type AjustosVisita = z.infer<typeof esquemaAjustosVisita>

export const AJUSTOS_VISITA_PER_DEFECTE: AjustosVisita = { minutsRetencio: MINUTS_RETENCIO, so: true, controlAgulles: true }

export async function llegirAjustosVisita(db: QiDB): Promise<AjustosVisita> {
  const r = await db.configuracio.get('visita')
  const a = esquemaAjustosVisita.safeParse(r?.valor)
  return a.success ? a.data : AJUSTOS_VISITA_PER_DEFECTE
}

export async function desarAjustosVisita(db: QiDB, a: AjustosVisita): Promise<void> {
  await desarSencer(db, 'configuracio', { clau: 'visita', valor: esquemaAjustosVisita.parse(a), modificatAt: new Date().toISOString() }, 'visita')
}
