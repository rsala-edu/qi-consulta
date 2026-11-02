// Per què ha fallat la sincronia amb Drive, en paraules senzilles i amb un
// codi curt. A la consola només hi va el motiu i el nom de l'error: mai el
// missatge (podria portar identificadors o dades), cap clau ni cap contrasenya.

import { ErrorClauDiferent, ErrorCopiaDanyada, ErrorCopiaVersio } from './copia'
import { ErrorAutoritzacio, ErrorDrive } from './drive'

export type MotiuSincronia =
  | 'permis'
  | 'xarxa'
  | 'drive'
  /** a) La còpia de Drive és d'un format més nou: cal actualitzar l'app */
  | 'versio'
  /** b) Dues fitxes del mateix pacient aturades per la base de dades (índex únic) */
  | 'duplicades'
  /** c) La còpia de Drive va tancada amb una altra clau (un altre dispositiu va començar de zero) */
  | 'clau'
  /** d) El fitxer de Drive és a mig escriure o danyat */
  | 'danyada'
  | 'local'
  | 'desconegut'

export interface ErrorSincronia {
  motiu: MotiuSincronia
  /** Codi curt per enviar: DRV-503, DRV-L… */
  codi: string
}

/** Errors de la base de dades del dispositiu (IndexedDB / Dexie) */
const ERRORS_LOCALS = new Set([
  'BulkError',
  'ConstraintError',
  'QuotaExceededError',
  'DatabaseClosedError',
  'InvalidStateError',
  'TransactionInactiveError',
  'AbortError',
  'DataError',
  'VersionError',
  'OpenFailedError',
])

/** L'índex únic (una fitxa clínica per pacient) ha aturat l'escriptura, sol o dins un BulkError de Dexie */
function esDuplicada(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e.name === 'ConstraintError') return true
  const fallades = (e as { failures?: unknown[] }).failures
  const interna = (e as { inner?: unknown }).inner
  return (
    (Array.isArray(fallades) && fallades.some((f) => f instanceof Error && f.name === 'ConstraintError')) ||
    (interna instanceof Error && interna.name === 'ConstraintError')
  )
}

export function classificarErrorSincronia(e: unknown, enLinia = navigator.onLine): ErrorSincronia {
  const nom = e instanceof Error ? e.name : ''
  let r: ErrorSincronia
  if (e instanceof ErrorAutoritzacio) r = { motiu: 'permis', codi: 'DRV-P' }
  else if (!enLinia || (e instanceof TypeError && /fetch|network|Load failed/i.test(e.message))) r = { motiu: 'xarxa', codi: 'DRV-N' }
  else if (e instanceof ErrorDrive) r = { motiu: 'drive', codi: `DRV-${e.estat}` }
  else if (e instanceof ErrorCopiaVersio) r = { motiu: 'versio', codi: 'DRV-V' }
  else if (e instanceof ErrorClauDiferent) r = { motiu: 'clau', codi: 'DRV-K' }
  else if (e instanceof ErrorCopiaDanyada) r = { motiu: 'danyada', codi: 'DRV-C' }
  else if (esDuplicada(e)) r = { motiu: 'duplicades', codi: 'DRV-D' }
  else if (ERRORS_LOCALS.has(nom)) r = { motiu: 'local', codi: 'DRV-L' }
  else r = { motiu: 'desconegut', codi: 'DRV-X' }
  if (r.motiu !== 'permis') console.error(`[Qi] Sincronia: ${r.motiu} (${r.codi}, ${nom || typeof e})`)
  return r
}
