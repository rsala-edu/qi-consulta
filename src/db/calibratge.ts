// Calibratge de punts fet des de l'app (Ajustos). Es guarda al dispositiu
// fins que s'exporta el JSON i es copia a src/punts/cataleg.json.

import type { Posicio3D, CostatPosicio } from '../punts/esquema'
import type { QiDB, RegistreCalibratge } from './esquema'

export type Calibracio = Pick<RegistreCalibratge, 'codi' | 'topologia' | 'costat' | 'posicio'>

function id(topologia: string, codi: string, costat: CostatPosicio): string {
  return `${topologia}|${codi}|${costat}`
}

export async function llistarCalibratge(db: QiDB, topologia: string): Promise<Calibracio[]> {
  const registres = await db.calibratge.where('topologia').equals(topologia).toArray()
  return registres.map(({ codi, topologia: t, costat, posicio }) => ({ codi, topologia: t, costat, posicio }))
}

/** Desa (o esborra, amb `null`) la posició d'un punt en un costat. */
export async function desarCalibracio(
  db: QiDB,
  topologia: string,
  codi: string,
  costat: CostatPosicio,
  posicio: Posicio3D | null,
): Promise<void> {
  await db.calibratge.put({
    id: id(topologia, codi, costat),
    topologia,
    codi,
    costat,
    posicio,
    modificatAt: new Date().toISOString(),
  })
}

/** Oblida tots els canvis locals d'una topologia (torna al catàleg del projecte). */
export async function descartarCalibratge(db: QiDB, topologia: string): Promise<void> {
  await db.calibratge.where('topologia').equals(topologia).delete()
}
