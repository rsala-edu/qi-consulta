// Calibratge de punts fet des de l'app (Ajustos). Es guarda al dispositiu
// fins que s'exporta el JSON i es copia a src/punts/cataleg.json.

import type { Posicio3D, CostatPosicio } from '../punts/esquema'
import { desarSencer, esborrarRegistres } from '../sincronia/escriptura'
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
  const clau = id(topologia, codi, costat, index)
  await desarSencer(db, 'calibratge', {
    id: clau,
    topologia,
    codi,
    costat,
    ...(index > 0 ? { index } : {}),
    posicio,
    modificatAt: new Date().toISOString(),
  }, clau)
}

/** Oblida el canvi local d'un punt i costat: torna a valer la posició del catàleg. */
export async function esborrarCalibracio(
  db: QiDB,
  topologia: string,
  codi: string,
  costat: CostatPosicio,
  index = 0,
): Promise<void> {
  await esborrarRegistres(db, 'calibratge', [id(topologia, codi, costat, index)])
}

/** Oblida tots els canvis locals d'una topologia (torna al catàleg del projecte). */
export async function descartarCalibratge(db: QiDB, topologia: string): Promise<void> {
  const claus = (await db.calibratge.where('topologia').equals(topologia).primaryKeys()) as string[]
  await esborrarRegistres(db, 'calibratge', claus)
}
