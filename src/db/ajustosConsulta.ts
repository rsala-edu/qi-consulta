// Ajustos > Consulta (etapa 4D): les dades de la consulta per a la capçalera
// dels informes (nom, doctora, número de col·legiada, adreça i telèfon). No són
// dades de pacient: van com la resta d'ajustos i se sincronitzen.

import { z } from 'zod'
import { desarSencer } from '../sincronia/escriptura'
import type { QiDB } from './esquema'

export const esquemaAjustosConsulta = z.object({
  nom: z.string().trim(),
  doctora: z.string().trim(),
  collegiada: z.string().trim(),
  adreca: z.string().trim(),
  telefon: z.string().trim(),
})
export type AjustosConsulta = z.infer<typeof esquemaAjustosConsulta>

export const CONSULTA_BUIDA: AjustosConsulta = { nom: '', doctora: '', collegiada: '', adreca: '', telefon: '' }

export async function llegirAjustosConsulta(db: QiDB): Promise<AjustosConsulta> {
  const a = esquemaAjustosConsulta.safeParse((await db.configuracio.get('consulta'))?.valor)
  return a.success ? a.data : CONSULTA_BUIDA
}

export async function desarAjustosConsulta(db: QiDB, a: AjustosConsulta): Promise<void> {
  await desarSencer(db, 'configuracio', { clau: 'consulta', valor: esquemaAjustosConsulta.parse(a), modificatAt: new Date().toISOString() }, 'consulta')
}
