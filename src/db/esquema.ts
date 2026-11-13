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
  /** Sessions: la cita i l'episodi (ids, en clar per trobar-les) */
  citaId?: string
  episodiId?: string
  /** Addendes: la sessió */
  sessioId?: string
  xifrat: DadesXifrades
  /** Sincronia: la versió (HLC) més alta del registre (sincronia/hlc.ts) */
  hlc?: string
  /** Sincronia: la versió de cada camp, xifrada (sincronia/registres.ts) */
  versions?: DadesXifrades
}

/** Entrada de la cua de canvis pendents de pujar (una per registre: l'últim canvi) */
export interface CanviPropi {
  /** «taula:clau» */
  id: string
  taula: string
  clau: string
  /** Número de seqüència del canvi (creixent en aquest dispositiu) */
  seq: number
}

/** Registre d'una taula que aquesta versió de l'app no coneix: es guarda tal qual per no perdre'l */
export interface RegistreDesconegut {
  /** «taula:clau» */
  id: string
  taula: string
  clau: string
  registre: Record<string, unknown>
}

/** Què se sap de la còpia de Drive en format 2 (per no baixar el que no ha canviat) */
export interface EstatDrive {
  /** Per a cada fitxer: la versió (o la data) que ja s'ha aplicat */
  aplicats: Record<string, string>
  /** Identificador del fitxer de diari propi a Drive */
  diariPropi?: string
  /** Fins a quin seq del diari de cada dispositiu s'ha llegit (o el cobreix una foto aplicada) */
  vistos: Record<string, number>
  /** El que diu el diari de cada altre dispositiu: fins on ha vist els dels altres, i quan va escriure */
  diaris?: Record<string, { vistos: Record<string, number>; modificat: string }>
  /** Últim canvi a Drive (qualsevol dispositiu): la data de modificació més nova */
  ultimCanvi?: string
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
  /** Hora (d'aquest dispositiu) de l'última sincronia correcta: per saber què s'ha editat als dos llocs */
  | { clau: 'darreraSincronia'; valor: string }
  /** Registres clínics (xifrats) tal com van quedar a l'última sincronia: la referència per fusionar */
  | { clau: 'baseSincronia'; valor: Partial<Record<string, RegistreXifrat[]>> }
  /** S'han buscat a les còpies de Drive les fitxes clíniques duplicades descartades abans (data i quantes) */
  | { clau: 'fitxesRecuperades'; valor: { at: string; recuperades: number } }
  /** Des de quan falla la sincronia sense cap còpia correcta entremig (per avisar passades 24 hores) */
  | { clau: 'errorSincroniaDesDe'; valor: string }
  /**
   * Les dades d'aquest dispositiu tal com eren just abans de canviar de clau
   * (recuperar les de Drive o fusionar-s'hi): un fitxer .qi complet, xifrat amb
   * la clau d'abans, per si la descàrrega automàtica no s'ha pogut fer.
   */
  | { clau: 'copiaAbansCanviClau'; valor: { at: string; text: string } }
  /** Si el navegador ha concedit l'emmagatzematge persistent (i quan es va demanar) */
  /** Identificador d'aquest dispositiu per a la sincronia (aleatori, per compte) */
  | { clau: 'dispositiu'; valor: string }
  /** Últim número de seqüència de la cua de canvis */
  | { clau: 'seq'; valor: number }
  /** Fins a quin número de seqüència s'ha pujat a Drive */
  | { clau: 'pujatFins'; valor: number }
  /** Últim HLC generat o vist (perquè no torni enrere en tornar a obrir) */
  | { clau: 'hlc'; valor: string }
  | { clau: 'estatDrive'; valor: EstatDrive }
  /** Les dades del dispositiu just abans de migrar al format 2 (fitxer .qi) */
  | { clau: 'copiaAbansMigracio'; valor: { at: string; text: string } }
  /** Desfasament del rellotge d'aquest dispositiu respecte de Google (ms; positiu: avançat) */
  | { clau: 'desfasRellotge'; valor: { ms: number; at: string } }
  /** Els registres d'abans del format 2 ja tenen versions (data) */
  | { clau: 'versionsLocals'; valor: string }
  /** Quan s'ha vist que un dispositiu amb una versió antiga escrivia a qi-dades.json (fins que la doctora ho tanca) */
  | { clau: 'versioAntigaAt'; valor: string }
  /** S'han creat els episodis de les cites d'abans de l'etapa 3A (data) */
  | { clau: 'episodisMigrats'; valor: string }
  /**
   * Retenció de les agulles en marxa (sense cap dada del pacient: només l'hora,
   * els minuts i l'id de la sessió), perquè es vegi i soni també amb l'app bloquejada
   */
  | { clau: 'retencio'; valor: { iniciAt: string; minuts: number; sessioId: string; avisat: boolean; vista: boolean } }
  | { clau: 'persistencia'; valor: { estat: 'concedida' | 'no-concedida' | 'no-disponible'; at: string } }

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
  | 'conflictes'
  | 'episodis'
  | 'sessions'
  | 'addendes'
  | 'valoracions'
  | 'plantillesConsentiment'
  | 'consentiments'

/** Registre esborrat: perquè l'esborrat també arribi als altres dispositius. */
export interface RegistreEsborrat {
  /** «taula:clau» */
  id: string
  taula: TaulaSincronitzada
  clau: string
  esborratAt: string
  /** Versió (HLC) de l'esborrat; les marques d'abans no en tenen (es fa servir esborratAt) */
  hlc?: string
  /** Dispositiu que l'ha fet i el seu número de seqüència: per saber quan tots l'han vist i es pot netejar */
  origen?: string
  seq?: number
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
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
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
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
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
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
}

/** Categoria de precaució confirmada per la doctora. No és dada de pacient. */
export interface RegistreCategoriaPrecaucio {
  categoria: CategoriaPrecaucio
  confirmadaAt: string
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
}

/**
 * Configuració de la consulta compartida entre dispositius (l'horari de
 * l'agenda). No és dada de pacient.
 */
export interface RegistreConfiguracio {
  clau: 'horari' | 'visita' | 'catalegs'
  valor: unknown
  modificatAt: string
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
}

/** Conflicte d'un registre clínic: les versions dels camps que no han guanyat (xifrades) */
export interface RegistreConflicte extends RegistreXifrat {
  /** Taula del registre (fitxesCliniques, pacients, cites) */
  taula: NomTaula
  registreId: string
}

/** Dia de consulta tancat (festiu, vacances). No és dada de pacient. */
export interface RegistreDiaTancat {
  dia: string
  modificatAt: string
  /** Sincronia: versió (HLC) del registre */
  hlc?: string
}

export type NomTaula =
  | 'pacients'
  | 'fitxesCliniques'
  | 'esborranys'
  | 'cites'
  | 'conflictes'
  | 'episodis'
  | 'sessions'
  | 'addendes'
  | 'valoracions'
  | 'plantillesConsentiment'
  | 'consentiments'

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
  /**
   * Versions anteriors de camps clínics que s'han editat en dos dispositius
   * alhora (xifrades): la doctora les revisa. `pacientId` en clar per trobar-les.
   */
  conflictes!: Table<RegistreConflicte, string>
  /** Episodis (problemes de salut) de cada pacient (etapa 3A) */
  episodis!: Table<RegistreXifrat, string>
  /** Sessions (visites): una per cita feta */
  sessions!: Table<RegistreXifrat, string>
  /** Valoració inicial de cada episodi, amb una versió per revisió (etapa 3B) */
  valoracions!: Table<RegistreXifrat, string>
  /** Addendes de les sessions tancades: només s'afegeixen */
  addendes!: Table<RegistreXifrat, string>
  /** Plantilles de consentiment, una fila per versió (etapa 4A) */
  plantillesConsentiment!: Table<RegistreXifrat, string>
  /** Consentiments signats: no es modifiquen mai, només es revoquen */
  consentiments!: Table<RegistreXifrat, string>
  /** Cua de canvis pendents de pujar a Drive (i diari propi fins que una foto el cobreix) */
  canvisPropis!: Table<CanviPropi, string>
  /** Registres de taules que aquesta versió no coneix (d'una versió més nova) */
  desconegudes!: Table<RegistreDesconegut, string>

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
    this.version(10).stores({
      conflictes: 'id, registreId',
    })
    this.version(11).stores({
      canvisPropis: 'id, seq',
      desconegudes: 'id',
    })
    this.version(12).stores({
      episodis: 'id, pacientId',
      sessions: 'id, pacientId, citaId, episodiId',
      addendes: 'id, sessioId, pacientId',
    })
    this.version(13).stores({
      valoracions: 'id, pacientId, episodiId',
    })
    this.version(14).stores({
      plantillesConsentiment: 'id',
      consentiments: 'id, pacientId',
    })
  }
}
