import Dexie, { type Table } from 'dexie'
import type { ClauEmbolcallada, DadesXifrades, EmbolcallSecret } from '../crypto'
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

export type RegistreMeta =
  | { clau: 'clauMestra'; valor: ClauEmbolcallada }
  /** Quan es va crear o canviar la contrasenya (per triar l'embolcall més nou en sincronitzar) */
  | { clau: 'clauMestraAt'; valor: string }
  /** Altres maneres d'obrir la clau mestra: empremta i clau de recuperació */
  | { clau: 'secrets'; valor: EmbolcallSecret[] }
  /** Aquest dispositiu s'ha connectat amb el compte de Google de la doctora */
  | { clau: 'google'; valor: { connectatAt: string; ultimaCopia: string | null; sub?: string } }
  /** Minuts sense activitat abans de bloquejar l'app en aquest dispositiu */
  | { clau: 'minutsBloqueig'; valor: number }
  /** S'ha aplicat el tipus de visita automàtic a les cites que ja hi havia (data) */
  | { clau: 'tipusVisitaAutomatic'; valor: string }

/** Taules que se sincronitzen amb Google Drive */
export type TaulaSincronitzada =
  | 'pacients'
  | 'fitxesCliniques'
  | 'cites'
  | 'calibratge'
  | 'calibratgeOrella'
  | 'precaucions'
  | 'categoriesPrecaucio'
  | 'configuracio'
  | 'diesTancats'

/** Registre esborrat: perquè l'esborrat també arribi als altres dispositius. */
export interface RegistreEsborrat {
  /** «taula:clau» */
  id: string
  taula: TaulaSincronitzada
  clau: string
  esborratAt: string
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
  /** Subpunt (Jiaji, Baxie…); sense = 0 */
  index?: number
  posicio: Posicio3D | null
  modificatAt: string
}

/**
 * Posició d'un punt de l'orella corregida per la doctora, sobre el dibuix de
 * l'orella esquerra (la dreta n'és el mirall). No és dada de pacient.
 */
export interface RegistreCalibratgeOrella {
  codi: string
  x: number
  y: number
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

/**
 * Configuració de la consulta compartida entre dispositius (l'horari de
 * l'agenda). No és dada de pacient.
 */
export interface RegistreConfiguracio {
  clau: 'horari'
  valor: unknown
  modificatAt: string
}

/** Dia de consulta tancat (festiu, vacances). No és dada de pacient. */
export interface RegistreDiaTancat {
  dia: string
  modificatAt: string
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
  calibratgeOrella!: Table<RegistreCalibratgeOrella, string>
  esborrats!: Table<RegistreEsborrat, string>
  /** Excepcions per punt */
  precaucions!: Table<RegistrePrecaucio, string>
  categoriesPrecaucio!: Table<RegistreCategoriaPrecaucio, string>
  configuracio!: Table<RegistreConfiguracio, string>
  diesTancats!: Table<RegistreDiaTancat, string>

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
    this.version(7).stores({
      esborrats: 'id',
    })
    this.version(8).stores({
      calibratgeOrella: 'codi',
    })
    this.version(9).stores({
      configuracio: 'clau',
      diesTancats: 'dia',
    })
  }
}
