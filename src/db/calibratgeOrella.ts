// Posicions dels punts de l'orella corregides per la doctora. Es guarden al
// dispositiu i viatgen a la còpia de Drive (no són dades de pacient).

import { desarSencer, esborrarRegistres } from '../sincronia/escriptura'
import type { QiDB } from './esquema'

export async function llegirCorreccionsOrella(db: QiDB): Promise<Map<string, { x: number; y: number }>> {
  const registres = await db.calibratgeOrella.toArray()
  return new Map(registres.map((r) => [r.codi, { x: r.x, y: r.y }]))
}

export async function desarCorreccioOrella(db: QiDB, codi: string, x: number, y: number): Promise<void> {
  await desarSencer(
    db,
    'calibratgeOrella',
    { codi, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, modificatAt: new Date().toISOString() },
    codi,
  )
}

/** Torna el punt a la posició de l'estàndard */
export async function treureCorreccioOrella(db: QiDB, codi: string): Promise<void> {
  await esborrarRegistres(db, 'calibratgeOrella', [codi])
}
