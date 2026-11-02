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
import { aplicarContingut, desxifrarCopia, ErrorClauDiferent, ErrorCopiaDanyada, ErrorCopiaVersio, llegirFitxer, type FitxerCopia } from './copia'
import { ErrorAutoritzacio, ErrorDrive, type Drive } from './drive'
import { baseDe } from './fusioClinica'
import { ErrorGoogle } from './google'
import { FITXER_PRINCIPAL } from './sincronitzar'

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

/** Passos A i B: la còpia principal de Drive, si n'hi ha (només es llegeix) */
export async function copiaPerRecuperar(drive: Drive): Promise<FitxerCopia | null> {
  const principal = await pas('A', async () => (await drive.llistar()).find((f) => f.name === FITXER_PRINCIPAL))
  if (!principal) return null
  const text = await pas('A', () => drive.baixar(principal.id))
  return pas('B', () => llegirFitxer(text))
}

/** Pas C: la clau mestra, amb la contrasenya */
export function obrirClauMestra(fitxer: FitxerCopia, contrasenya: string): Promise<CryptoKey> {
  return pas('C', () => desbloquejarClauMestra(fitxer.embolcalls.contrasenya, contrasenya))
}

/** Passos D i E: escriure la còpia (ja oberta amb la clau mestra) en aquest dispositiu */
export async function restaurarCopia(db: QiDB, clau: CryptoKey, fitxer: FitxerCopia): Promise<void> {
  const contingut = await pas('D1', () => desxifrarCopia(clau, fitxer))
  await pas('D2', () => aplicarContingut(db, contingut))
  await pas('E', async () => {
    await guardarClauEmbolcallada(db, fitxer.embolcalls.contrasenya, fitxer.embolcalls.contrasenyaAt)
    await guardarSecrets(db, fitxer.embolcalls.secrets)
    // El que hi ha ara és el de Drive: el punt de partida per a la pròxima sincronia
    await db.meta.bulkPut([
      { clau: 'darreraSincronia', valor: new Date().toISOString() },
      { clau: 'baseSincronia', valor: baseDe(contingut) },
    ])
  })
}
