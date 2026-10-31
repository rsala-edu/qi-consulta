import Dexie, { type Table } from 'dexie'
import type { ClauEmbolcallada, DadesXifrades } from '../crypto'
import type { CostatPosicio, Posicio3D } from '../punts/esquema'

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

/**
 * Posició d'un punt calibrada a l'app i encara no exportada al catàleg.
 * NO és dada de pacient: es guarda en clar. `posicio: null` = esborrada.
 */
export interface RegistreCalibratge {
  id: string
  topologia: string
  codi: string
  costat: CostatPosicio
  posicio: Posicio3D | null
  modificatAt: string
}

export type NomTaula = 'pacients' | 'fitxesCliniques' | 'esborranys'

export class QiDB extends Dexie {
  meta!: Table<RegistreMeta, RegistreMeta['clau']>
  pacients!: Table<RegistreXifrat, string>
  fitxesCliniques!: Table<RegistreXifrat, string>
  /** L'id és la clau del formulari */
  esborranys!: Table<RegistreXifrat, string>
  calibratge!: Table<RegistreCalibratge, string>

  constructor(nom = 'qi') {
    super(nom)
    this.version(1).stores({
      meta: 'clau',
      pacients: 'id, modificatAt',
      fitxesCliniques: 'id, &pacientId',
    })
    this.version(2).stores({
      esborranys: 'id, modificatAt',
    })
    this.version(3).stores({
      calibratge: 'id, topologia',
    })
  }
}
