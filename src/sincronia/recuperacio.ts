// Recuperar les dades en un dispositiu nou a partir de la còpia de Drive, pas
// a pas. Si un pas falla, l'error diu quin pas és i de quin tipus, perquè la
// pantalla doni un missatge clar (contrasenya, Drive, versió, còpia danyada)
// i, per a la resta, un codi curt (REC-D2) que la doctora pugui enviar.
//
// A la consola només hi va el pas i el nom de l'error: mai cap dada clínica,
// cap clau ni cap contrasenya. La recuperació no escriu mai res a Drive.

import { desbloquejarClauMestra, ErrorContrasenya } from '../crypto'
import type { QiDB } from '../db/esquema'
import { guardarClauEmbolcallada, guardarSecrets } from '../db/magatzem'
import { aplicarContingut, desxifrarCopia, ErrorClauDiferent, ErrorCopiaDanyada, ErrorCopiaVersio } from './copia'
import { RE_DIARI, RE_FOTO } from './format2'
import { ErrorAutoritzacio, ErrorDrive, type Drive } from './drive'
import { baseDe } from './fusioClinica'
import { ErrorGoogle } from './google'
import { copiaDeDrive, FITXER_PRINCIPAL, sincronitzar, type CopiaDrive } from './sincronitzar'

export const PASSOS = {
  A: 'llegir la còpia de Google Drive',
  B: 'llegir el format de la còpia',
  C: 'obrir la clau mestra amb la contrasenya',
  D1: 'desxifrar els registres',
  D2: 'importar els registres a la base de dades',
  E: 'desar les claus en aquest dispositiu',
} as const
export type PasRecuperacio = keyof typeof PASSOS

export type TipusErrorRecuperacio = 'contrasenya' | 'drive' | 'versio' | 'danyada' | 'inesperat'

export class ErrorRecuperacio extends Error {
  readonly tipus: TipusErrorRecuperacio
  readonly pas: PasRecuperacio
  /** Nom de l'error original (mai el missatge, que podria portar dades) */
  readonly causa: string
  constructor(tipus: TipusErrorRecuperacio, pas: PasRecuperacio, causa: string) {
    super(`Recuperació: ${PASSOS[pas]} (${causa})`)
    this.name = 'ErrorRecuperacio'
    this.tipus = tipus
    this.pas = pas
    this.causa = causa
  }

  /** Codi curt per enviar: REC-D2 */
  get codi(): string {
    return `REC-${this.pas}`
  }
}

export function classificar(pas: PasRecuperacio, e: unknown): ErrorRecuperacio {
  if (e instanceof ErrorRecuperacio) return e
  const nom = e instanceof Error ? e.name : typeof e
  const tipus: TipusErrorRecuperacio =
    e instanceof ErrorContrasenya
      ? 'contrasenya'
      : e instanceof ErrorAutoritzacio || e instanceof ErrorDrive || (e instanceof ErrorGoogle && e.motiu === 'xarxa')
        ? 'drive'
        : e instanceof ErrorCopiaVersio
          ? 'versio'
          : // La clau s'ha obert amb l'embolcall de la mateixa còpia: si no hi quadra, la còpia és danyada
            e instanceof ErrorCopiaDanyada || e instanceof ErrorClauDiferent
            ? 'danyada'
            : // Sense connexió, fetch falla amb TypeError: només és de Drive al pas A
              pas === 'A' && e instanceof TypeError
              ? 'drive'
              : 'inesperat'
  const error = new ErrorRecuperacio(tipus, pas, nom)
  // La contrasenya incorrecta no és cap error de l'app
  if (tipus !== 'contrasenya') console.error(`[Qi] Recuperació: ha fallat el pas ${pas} (${PASSOS[pas]}): ${nom}`)
  return error
}

async function pas<T>(p: PasRecuperacio, f: () => Promise<T> | T): Promise<T> {
  try {
    return await f()
  } catch (e) {
    throw classificar(p, e)
  }
}

/** Passos A i B: la còpia de Drive, si n'hi ha (només es llegeix) */
export async function copiaPerRecuperar(drive: Drive): Promise<CopiaDrive | null> {
  const fitxers = await pas('A', () => drive.llistar())
  if (!fitxers.some((f) => f.name === FITXER_PRINCIPAL || RE_FOTO.test(f.name) || RE_DIARI.test(f.name))) return null
  return pas('B', async () => {
    try {
      return await copiaDeDrive(drive)
    } catch (e) {
      // No s'ha pogut baixar (xarxa, permís): és del pas A
      if (e instanceof ErrorAutoritzacio || e instanceof ErrorDrive || e instanceof TypeError) throw classificar('A', e)
      throw e
    }
  })
}

/** Pas C: la clau mestra, amb la contrasenya */
export function obrirClauMestra(fitxer: Pick<CopiaDrive, 'embolcalls'>, contrasenya: string): Promise<CryptoKey> {
  return pas('C', () => desbloquejarClauMestra(fitxer.embolcalls.contrasenya, contrasenya))
}

/**
 * Passos D i E: escriure la còpia (ja oberta amb la clau mestra) en aquest
 * dispositiu. Format 2: es llegeix tot de Drive (sense escriure-hi res).
 * Format 1: s'importa qi-dades.json (la primera sincronia el migrarà).
 */
export async function restaurarCopia(db: QiDB, clau: CryptoKey, copia: CopiaDrive, drive: Drive): Promise<void> {
  await pas('E', async () => {
    await guardarClauEmbolcallada(db, copia.embolcalls.contrasenya, copia.embolcalls.contrasenyaAt)
    await guardarSecrets(db, copia.embolcalls.secrets)
    // Res d'aquest dispositiu nou s'ha de pujar: tot ve de Drive
    await db.meta.put({ clau: 'versionsLocals', valor: new Date().toISOString() })
  })
  if (copia.format === 1) {
    const contingut = await pas('D1', () => desxifrarCopia(clau, copia.v1!))
    await pas('D2', () => aplicarContingut(db, contingut))
    await pas('E', () =>
      db.meta.bulkPut([
        { clau: 'darreraSincronia', valor: new Date().toISOString() },
        { clau: 'baseSincronia', valor: baseDe(contingut) },
      ]),
    )
    await db.meta.delete('versionsLocals')
    return
  }
  try {
    await sincronitzar(db, clau, drive, { nomesLlegir: true })
  } catch (e) {
    const p: PasRecuperacio =
      e instanceof ErrorCopiaDanyada || e instanceof ErrorClauDiferent || e instanceof ErrorCopiaVersio
        ? 'D1'
        : e instanceof ErrorAutoritzacio || e instanceof ErrorDrive || e instanceof TypeError
          ? 'A'
          : 'D2'
    throw classificar(p, e)
  }
}
