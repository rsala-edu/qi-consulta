// Precaucions dels punts revisades per la doctora (Ajustos → Precaucions per revisar).

import type { QiDB, RegistrePrecaucio } from './esquema'

export type RevisioPrecaucio = RegistrePrecaucio

export async function llistarPrecaucions(db: QiDB): Promise<RevisioPrecaucio[]> {
  return db.precaucions.toArray()
}

/** La doctora confirma la precaució d'un punt, tal com és o amb un text nou. */
export async function confirmarPrecaucio(
  db: QiDB,
  codi: string,
  precaucio: { embaras: boolean; nota: string },
): Promise<RevisioPrecaucio> {
  const registre = { codi, embaras: precaucio.embaras, nota: precaucio.nota.trim(), confirmadaAt: new Date().toISOString() }
  await db.precaucions.put(registre)
  return registre
}
