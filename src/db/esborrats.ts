// Registre d'esborrats per a la sincronia: si s'esborra una cita en un
// dispositiu, l'altre també l'ha d'esborrar (i no tornar-la a pujar).

import type { QiDB, TaulaSincronitzada } from './esquema'

export async function registrarEsborrats(db: QiDB, taula: TaulaSincronitzada, claus: readonly string[]): Promise<void> {
  const esborratAt = new Date().toISOString()
  await db.esborrats.bulkPut(claus.map((clau) => ({ id: `${taula}:${clau}`, taula, clau, esborratAt })))
}
