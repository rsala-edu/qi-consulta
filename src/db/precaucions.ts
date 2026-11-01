// Revisió de les precaucions per la doctora (Ajustos → Precaucions per
// revisar): categories confirmades i excepcions per a punts concrets.

import type { RevisioPrecaucions } from '../punts/cataleg'
import { ordenarCategories } from '../punts/cataleg'
import type { CategoriaPrecaucio } from '../punts/esquema'
import { registrarEsborrats } from './esborrats'
import type { QiDB, RegistreCategoriaPrecaucio, RegistrePrecaucio } from './esquema'

export interface RevisioDesada extends RevisioPrecaucions {
  categories: CategoriaPrecaucio[]
  excepcions: RegistrePrecaucio[]
  confirmacions: RegistreCategoriaPrecaucio[]
}

export async function llegirRevisioPrecaucions(db: QiDB): Promise<RevisioDesada> {
  const [confirmacions, excepcions] = await Promise.all([db.categoriesPrecaucio.toArray(), db.precaucions.toArray()])
  return { categories: confirmacions.map((c) => c.categoria), excepcions, confirmacions }
}

/** La doctora confirma una categoria sencera. */
export async function confirmarCategoria(db: QiDB, categoria: CategoriaPrecaucio): Promise<void> {
  await db.categoriesPrecaucio.put({ categoria, confirmadaAt: new Date().toISOString() })
}

/** La categoria torna a quedar pendent. */
export async function desconfirmarCategoria(db: QiDB, categoria: CategoriaPrecaucio): Promise<void> {
  await db.categoriesPrecaucio.delete(categoria)
  await registrarEsborrats(db, 'categoriesPrecaucio', [categoria])
}

/** Excepció per a un punt: categories i text propis (queda confirmat). */
export async function desarExcepcio(
  db: QiDB,
  codi: string,
  precaucio: { categories: readonly CategoriaPrecaucio[]; nota: string },
): Promise<RegistrePrecaucio> {
  const registre: RegistrePrecaucio = {
    codi,
    categories: ordenarCategories(precaucio.categories),
    nota: precaucio.nota.trim(),
    confirmadaAt: new Date().toISOString(),
  }
  await db.precaucions.put(registre)
  return registre
}

export async function treureExcepcio(db: QiDB, codi: string): Promise<void> {
  await db.precaucions.delete(codi)
  await registrarEsborrats(db, 'precaucions', [codi])
}
