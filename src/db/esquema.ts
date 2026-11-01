import Dexie, { type Table } from 'dexie'
import type { ClauEmbolcallada, DadesXifrades } from '../crypto'
import { cataleg, ordenarCategories } from '../punts/cataleg'
import type { CategoriaPrecaucio, CostatPosicio, Posicio3D } from '../punts/esquema'

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
  /** Cites: hora d'inici local («2026-11-02T10:15»), per cercar per dies */
  inici?: string
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

/**
 * Excepció de la doctora per a la precaució d'un punt concret (categories i
 * text propis). No és dada de pacient.
 */
export interface RegistrePrecaucio {
  codi: string
  categories: CategoriaPrecaucio[]
  nota: string
  confirmadaAt: string
}

/** Categoria de precaució confirmada per la doctora. No és dada de pacient. */
export interface RegistreCategoriaPrecaucio {
  categoria: CategoriaPrecaucio
  confirmadaAt: string
}

export type NomTaula = 'pacients' | 'fitxesCliniques' | 'esborranys' | 'cites'

export class QiDB extends Dexie {
  meta!: Table<RegistreMeta, RegistreMeta['clau']>
  pacients!: Table<RegistreXifrat, string>
  fitxesCliniques!: Table<RegistreXifrat, string>
  /** L'id és la clau del formulari */
  esborranys!: Table<RegistreXifrat, string>
  cites!: Table<RegistreXifrat, string>
  calibratge!: Table<RegistreCalibratge, string>
  /** Excepcions per punt */
  precaucions!: Table<RegistrePrecaucio, string>
  categoriesPrecaucio!: Table<RegistreCategoriaPrecaucio, string>

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
    this.version(4).stores({
      precaucions: 'codi',
    })
    // Les precaucions es revisen per categories. Les que la doctora havia
    // confirmat punt per punt (amb la marca d'embaràs) passen a ser
    // excepcions d'aquell punt, amb les categories del catàleg.
    this.version(5)
      .stores({
        categoriesPrecaucio: 'categoria',
      })
      .upgrade(async (tx) => {
        await tx
          .table('precaucions')
          .toCollection()
          .modify((r: RegistrePrecaucio & { embaras?: boolean }) => {
            if (r.categories) return
            const delCataleg = cataleg.punts.find((p) => p.codi === r.codi)?.precaucions.categories ?? []
            const senseEmbaras = delCataleg.filter((x) => x !== 'embaras')
            r.categories = ordenarCategories(r.embaras ? ['embaras', ...senseEmbaras] : senseEmbaras)
            if (r.categories.length === 0 && r.nota !== '') r.categories = ['profunditat']
            delete r.embaras
          })
      })
    this.version(6).stores({
      cites: 'id, inici, pacientId, modificatAt',
    })
  }
}
