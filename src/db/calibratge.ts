// Calibratge de punts fet des de l'app (Ajustos). Es guarda al dispositiu
// fins que s'exporta el JSON i es copia a src/punts/cataleg.json.

import type { Posicio3D, CostatPosicio } from '../punts/esquema'
import { registrarEsborrats } from './esborrats'
import type { QiDB, RegistreCalibratge } from './esquema'

export type Calibracio = Pick<RegistreCalibratge, 'codi' | 'topologia' | 'costat' | 'index' | 'posicio'>

function id(topologia: string, codi: string, costat: CostatPosicio, index = 0): string {
  return index > 0 ? `${topologia}|${codi}|${costat}|${index}` : `${topologia}|${codi}|${costat}`
}

export async function llistarCalibratge(db: QiDB, topologia: string): Promise<Calibracio[]> {
  const registres = await db.calibratge.where('topologia').equals(topologia).toArray()
  return registres.map(({ codi, topologia: t, costat, index, posicio }) => ({
    codi,
    topologia: t,
    costat,
    ...(index ? { index } : {}),
    posicio,
  }))
}

/** Desa (o esborra, amb `null`) la posició d'un punt en un costat (i subpunt). */
export async function desarCalibracio(
  db: QiDB,
  topologia: string,
  codi: string,
  costat: CostatPosicio,
  posicio: Posicio3D | null,
  index = 0,
): Promise<void> {
  await db.calibratge.put({
    id: id(topologia, codi, costat, index),
    topologia,
    codi,
    costat,
    ...(index > 0 ? { index } : {}),
    posicio,
    modificatAt: new Date().toISOString(),
  })
}

/** Oblida el canvi local d'un punt i costat: torna a valer la posició del catàleg. */
export async function esborrarCalibracio(
  db: QiDB,
  topologia: string,
  codi: string,
  costat: CostatPosicio,
  index = 0,
): Promise<void> {
  await db.calibratge.delete(id(topologia, codi, costat, index))
  await registrarEsborrats(db, 'calibratge', [id(topologia, codi, costat, index)])
}

/** Oblida tots els canvis locals d'una topologia (torna al catàleg del projecte). */
export async function descartarCalibratge(db: QiDB, topologia: string): Promise<void> {
  const claus = (await db.calibratge.where('topologia').equals(topologia).primaryKeys()) as string[]
  await db.calibratge.bulkDelete(claus)
  await registrarEsborrats(db, 'calibratge', claus)
}
