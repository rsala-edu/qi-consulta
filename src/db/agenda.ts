// Horari de consulta i dies tancats. No són dades de pacient: van sense
// xifrar, com el calibratge, i se sincronitzen amb els altres dispositius.

import { esquemaHorari, HORARI_PER_DEFECTE, type Horari } from '../domini/agenda'
import { desarSencer, esborrarRegistres } from '../sincronia/escriptura'
import type { QiDB } from './esquema'

export async function llegirHorari(db: QiDB): Promise<Horari> {
  const r = await db.configuracio.get('horari')
  const h = esquemaHorari.safeParse(r?.valor)
  return h.success ? h.data : HORARI_PER_DEFECTE
}

export async function desarHorari(db: QiDB, horari: Horari): Promise<void> {
  const valor = esquemaHorari.parse({ ...horari, dies: [...new Set(horari.dies)].sort() })
  await desarSencer(db, 'configuracio', { clau: 'horari', valor, modificatAt: new Date().toISOString() }, 'horari')
}

export async function llegirDiesTancats(db: QiDB): Promise<Set<string>> {
  return new Set((await db.diesTancats.toArray()).map((r) => r.dia))
}

export async function canviarDiaTancat(db: QiDB, dia: string, tancat: boolean): Promise<void> {
  if (tancat) await desarSencer(db, 'diesTancats', { dia, modificatAt: new Date().toISOString() }, dia)
  else await esborrarRegistres(db, 'diesTancats', [dia])
}
