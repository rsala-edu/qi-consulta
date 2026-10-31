import Dexie, { type Table } from 'dexie'
import type { ClauEmbolcallada, DadesXifrades } from '../crypto'

/**
 * Registre tal com es guarda a IndexedDB. Només van en clar l'id (UUID),
 * les dates i, si escau, l'id del pacient al qual pertany. Tota la resta
 * (nom, telèfon, dades clíniques, si està arxivat…) va dins `xifrat`.
 */
export interface RegistreXifrat {
  id: string
  creatAt: string
  modificatAt: string
  pacientId?: string
  xifrat: DadesXifrades
}

export interface RegistreMeta {
  clau: 'clauMestra'
  valor: ClauEmbolcallada
}

export type NomTaula = 'pacients' | 'fitxesCliniques'

export class QiDB extends Dexie {
  meta!: Table<RegistreMeta, RegistreMeta['clau']>
  pacients!: Table<RegistreXifrat, string>
  fitxesCliniques!: Table<RegistreXifrat, string>

  constructor(nom = 'qi') {
    super(nom)
    this.version(1).stores({
      meta: 'clau',
      pacients: 'id, modificatAt',
      fitxesCliniques: 'id, &pacientId',
    })
  }
}
