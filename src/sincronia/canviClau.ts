// Quan aquest dispositiu i Google Drive tenen dades tancades amb claus
// diferents (DRV-K), i per als fitxers .qi:
//
// - exportarQi: totes les dades del dispositiu en un fitxer xifrat amb la clau
//   del dispositiu (s'obre amb la seva contrasenya o clau de recuperació).
// - recuperarDeDrive: les dades de Drive substitueixen les del dispositiu.
// - fusionarAmbDrive: les dades del dispositiu s'afegeixen a les de Drive i
//   el dispositiu adopta la clau de Drive.
// - importarQi: les dades d'un fitxer .qi s'afegeixen a les del dispositiu.
//
// Abans de canviar de clau, el dispositiu desa (i la pantalla descarrega) un
// .qi de les seves dades: no es perd mai res. Res d'això escriu a Drive: la
// pujada la fa la sincronia normal, després, ja amb la clau bona.

import {
  desbloquejarAmbSecret,
  desbloquejarClauMestra,
  idClau,
  llegirClauRecuperacio,
  type EmbolcallSecret,
} from '../crypto'
import type { QiDB, RegistreXifrat } from '../db/esquema'
import { guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada, llegirClauMestraAt, llegirSecrets } from '../db/magatzem'
import { ErrorClauRecuperacio } from '../sessio/claus'
import {
  aplicarContingut,
  desxifrarCopia,
  fusionar,
  llegirContingut,
  llegirFitxer,
  xifrarCopia,
  type Contingut,
  type Embolcalls,
  type FitxerCopia,
} from './copia'
import { fusionarClausDiferents, reXifrarRegistres } from './fusioClaus'
import { baseDe, fusionarClinics } from './fusioClinica'

export type Credencial = { tipus: 'contrasenya'; valor: string } | { tipus: 'recuperacio'; valor: string }

/** La clau mestra d'una còpia (de Drive o .qi), amb la seva contrasenya o la seva clau de recuperació */
export async function obrirClauCopia(fitxer: FitxerCopia, credencial: Credencial): Promise<CryptoKey> {
  if (credencial.tipus === 'contrasenya') return desbloquejarClauMestra(fitxer.embolcalls.contrasenya, credencial.valor)
  const secret = llegirClauRecuperacio(credencial.valor)
  const e = fitxer.embolcalls.secrets.find((s) => s.tipus === 'recuperacio')
  if (!secret || !e) throw new ErrorClauRecuperacio()
  try {
    return await desbloquejarAmbSecret(e, secret)
  } catch {
    throw new ErrorClauRecuperacio()
  }
}

async function embolcallsLocals(db: QiDB): Promise<Embolcalls> {
  const contrasenya = await llegirClauEmbolcallada(db)
  if (!contrasenya) throw new Error('No hi ha contrasenya')
  return { contrasenya, contrasenyaAt: await llegirClauMestraAt(db), secrets: await llegirSecrets(db) }
}

/** Totes les dades d'aquest dispositiu en un fitxer .qi (text), xifrat amb la clau del dispositiu */
export async function exportarQi(db: QiDB, clau: CryptoKey, ara = new Date()): Promise<string> {
  const fitxer = await xifrarCopia(clau, await llegirContingut(db), await embolcallsLocals(db))
  return JSON.stringify({ ...fitxer, creatAt: ara.toISOString() })
}

/** «qi-dispositiu-2026-11-02-1415.qi» */
export function nomFitxerQi(ara = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `qi-dispositiu-${ara.getFullYear()}-${p(ara.getMonth() + 1)}-${p(ara.getDate())}-${p(ara.getHours())}${p(ara.getMinutes())}.qi`
}

/** Llegeix un fitxer .qi (el mateix format que la còpia de Drive) */
export const llegirQi = llegirFitxer

/** Desa dins el dispositiu el .qi d'abans de canviar de clau i el torna (per descarregar-lo) */
export async function desarCopiaAbansCanviClau(db: QiDB, clau: CryptoKey, ara = new Date()): Promise<string> {
  const text = await exportarQi(db, clau, ara)
  await db.meta.put({ clau: 'copiaAbansCanviClau', valor: { at: ara.toISOString(), text } })
  return text
}

export async function llegirCopiaAbansCanviClau(db: QiDB): Promise<{ at: string; text: string } | null> {
  const r = await db.meta.get('copiaAbansCanviClau')
  return r?.clau === 'copiaAbansCanviClau' ? r.valor : null
}

/**
 * Escriu de cop el contingut i, si cal, les claus de Drive i els esborranys
 * tornats a xifrar: o es fa tot o no es fa res.
 */
async function escriure(
  db: QiDB,
  contingut: Contingut,
  opcions: { embolcalls?: Embolcalls; esborranys?: RegistreXifrat[]; base?: Contingut; ara: string },
): Promise<void> {
  await db.transaction('rw', [db.meta, db.esborranys, db.esborrats, ...TAULES_DB(db)], async () => {
    await aplicarContingut(db, contingut)
    if (opcions.esborranys) {
      await db.esborranys.clear()
      await db.esborranys.bulkPut(opcions.esborranys)
    }
    if (opcions.embolcalls) {
      await guardarClauEmbolcallada(db, opcions.embolcalls.contrasenya, opcions.embolcalls.contrasenyaAt)
      await guardarSecrets(db, opcions.embolcalls.secrets as EmbolcallSecret[])
    }
    if (opcions.base) {
      // La còpia de Drive és el punt de partida de la pròxima sincronia
      await db.meta.bulkPut([
        { clau: 'darreraSincronia', valor: opcions.ara },
        { clau: 'baseSincronia', valor: baseDe(opcions.base) },
      ])
    }
  })
}

const TAULES_DB = (db: QiDB) =>
  [db.pacients, db.fitxesCliniques, db.cites, db.calibratge, db.calibratgeOrella, db.precaucions, db.categoriesPrecaucio, db.configuracio, db.diesTancats, db.conflictes]

async function esborranysAmb(db: QiDB, de: CryptoKey, a: CryptoKey): Promise<RegistreXifrat[]> {
  return reXifrarRegistres(await db.esborranys.toArray(), 'esborranys', de, a)
}

/**
 * «Recuperar les dades de Drive en aquest dispositiu»: el que hi ha a Drive
 * substitueix les dades del dispositiu, que abans s'han desat en un .qi.
 * Els formularis a mig fer es conserven (tornats a xifrar).
 */
export async function recuperarDeDrive(db: QiDB, clauLocal: CryptoKey, fitxer: FitxerCopia, clauDrive: CryptoKey): Promise<void> {
  const remot = await desxifrarCopia(clauDrive, fitxer)
  const ara = new Date().toISOString()
  await escriure(db, remot, {
    embolcalls: fitxer.embolcalls,
    esborranys: await esborranysAmb(db, clauLocal, clauDrive),
    base: remot,
    ara,
  })
}

/**
 * «Fusionar les dades d'aquest dispositiu amb les de Drive»: el resultat va
 * xifrat amb la clau de Drive, que el dispositiu adopta (amb la contrasenya,
 * l'empremta i la clau de recuperació de Drive).
 */
export async function fusionarAmbDrive(
  db: QiDB,
  clauLocal: CryptoKey,
  fitxer: FitxerCopia,
  clauDrive: CryptoKey,
): Promise<{ possiblesDuplicats: number; conflictes: number }> {
  const remot = await desxifrarCopia(clauDrive, fitxer)
  const local = await llegirContingut(db)
  const ara = new Date().toISOString()
  const r = await fusionarClausDiferents({ clau: clauDrive, contingut: remot }, { clau: clauLocal, contingut: local }, ara)
  await escriure(db, r.contingut, {
    embolcalls: fitxer.embolcalls,
    esborranys: await esborranysAmb(db, clauLocal, clauDrive),
    base: remot,
    ara,
  })
  return { possiblesDuplicats: r.possiblesDuplicats, conflictes: r.conflictes }
}

/**
 * «Importar una còpia»: les dades del .qi s'afegeixen a les del dispositiu,
 * que conserva la seva clau. Si el .qi és de la mateixa clau, és una fusió
 * normal; si no, es tornen a xifrar.
 */
export async function importarQi(
  db: QiDB,
  clauLocal: CryptoKey,
  fitxer: FitxerCopia,
  clauQi: CryptoKey,
): Promise<{ possiblesDuplicats: number; conflictes: number }> {
  const copia = await desxifrarCopia(clauQi, fitxer)
  const local = await llegirContingut(db)
  const ara = new Date().toISOString()
  if ((await idClau(clauQi)) === (await idClau(clauLocal))) {
    const c = await fusionarClinics(clauLocal, local, copia, '0000', ara)
    await escriure(db, fusionar(c.local, c.remot), { ara })
    return { possiblesDuplicats: 0, conflictes: c.conflictes }
  }
  const r = await fusionarClausDiferents({ clau: clauLocal, contingut: local }, { clau: clauQi, contingut: copia }, ara)
  await escriure(db, r.contingut, { ara })
  return { possiblesDuplicats: r.possiblesDuplicats, conflictes: r.conflictes }
}
