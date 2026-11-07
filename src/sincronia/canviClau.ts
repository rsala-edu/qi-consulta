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
import { esquemaPacientGuardat, type PacientGuardat } from '../domini/pacient'
import { desxifrarJson } from '../crypto'
import { context } from '../db/magatzem'
import { aplicarRemots, clauDe, type EntradaRemota } from './aplicar'
import type { Drive } from './drive'
import { desarPerCamp } from './escriptura'
import { hlcDeData } from './hlc'
import { esPerCamp, obrirRegistre, tancarRegistre, type Registre, type Versions } from './registres'
import { sincronitzar, type CopiaDrive } from './sincronitzar'
import { guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada, llegirClauMestraAt, llegirSecrets } from '../db/magatzem'
import { ErrorClauRecuperacio } from '../sessio/claus'
import { desxifrarCopia, llegirContingut, llegirFitxer, TAULES, xifrarCopia, type Embolcalls, type FitxerCopia } from './copia'
import { clauPersona, reXifrarRegistres } from './fusioClaus'

export type Credencial = { tipus: 'contrasenya'; valor: string } | { tipus: 'recuperacio'; valor: string }

/** La clau mestra d'una còpia (de Drive o .qi), amb la seva contrasenya o la seva clau de recuperació */
export async function obrirClauCopia(fitxer: Pick<FitxerCopia, 'embolcalls'>, credencial: Credencial): Promise<CryptoKey> {
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

/** Taules sincronitzades amb registres xifrats amb la clau mestra */
const TAULES_XIFRADES = ['pacients', 'fitxesCliniques', 'cites', 'conflictes', 'episodis', 'sessions', 'addendes'] as const

const SINCRONITZADES = (db: QiDB) => TAULES.map((t) => db.table(t.nom))

/** Torna a xifrar totes les dades del dispositiu (i els esborranys) amb una altra clau */
async function reXifrarDispositiu(db: QiDB, de: CryptoKey, a: CryptoKey) {
  const taules = new Map<string, RegistreXifrat[]>()
  for (const nom of TAULES_XIFRADES) taules.set(nom, await reXifrarRegistres(await db.table(nom).toArray(), nom, de, a))
  return { taules, esborranys: await reXifrarRegistres(await db.esborranys.toArray(), 'esborranys', de, a) }
}

async function adoptarClausDeDrive(db: QiDB, embolcalls: Embolcalls) {
  await guardarClauEmbolcallada(db, embolcalls.contrasenya, embolcalls.contrasenyaAt)
  await guardarSecrets(db, embolcalls.secrets as EmbolcallSecret[])
}

/**
 * «Recuperar les dades de Drive en aquest dispositiu»: el que hi ha a Drive
 * substitueix les dades del dispositiu, que abans s'han desat en un .qi.
 * Els formularis a mig fer es conserven (tornats a xifrar).
 */
export async function recuperarDeDrive(db: QiDB, clauLocal: CryptoKey, copia: CopiaDrive, clauDrive: CryptoKey, drive: Drive): Promise<void> {
  const esborranys = await reXifrarRegistres(await db.esborranys.toArray(), 'esborranys', clauLocal, clauDrive)
  await db.transaction('rw', [db.meta, db.esborranys, db.esborrats, db.canvisPropis, db.desconegudes, ...SINCRONITZADES(db)], async () => {
    for (const t of SINCRONITZADES(db)) await t.clear()
    await db.esborrats.clear()
    await db.desconegudes.clear()
    await db.canvisPropis.clear()
    await db.esborranys.clear()
    await db.esborranys.bulkPut(esborranys)
    await adoptarClausDeDrive(db, copia.embolcalls)
    // Res d'aquest dispositiu queda per pujar: tot vindrà de Drive
    await db.meta.bulkPut([
      { clau: 'estatDrive', valor: { aplicats: {}, vistos: {} } },
      { clau: 'versionsLocals', valor: new Date().toISOString() },
      { clau: 'darreraSincronia', valor: new Date().toISOString() },
    ])
    await db.meta.delete('baseSincronia')
  })
  await sincronitzar(db, clauDrive, drive, { nomesLlegir: true })
}

/**
 * «Fusionar les dades d'aquest dispositiu amb les de Drive»: les dades del
 * dispositiu es tornen a xifrar amb la clau de Drive (que el dispositiu
 * adopta, amb la contrasenya, l'empremta i la clau de recuperació de Drive),
 * s'apunten totes a la cua i es fusionen amb les de Drive camp a camp. Els
 * pacients amb el mateix nom i data a totes dues bandes queden per revisar.
 */
export async function fusionarAmbDrive(
  db: QiDB,
  clauLocal: CryptoKey,
  copia: CopiaDrive,
  clauDrive: CryptoKey,
  drive: Drive,
): Promise<{ possiblesDuplicats: number; conflictes: number }> {
  const propis = new Set((await db.pacients.toArray()).map((p) => p.id))
  const { taules, esborranys } = await reXifrarDispositiu(db, clauLocal, clauDrive)
  await db.transaction('rw', [db.meta, db.esborranys, ...SINCRONITZADES(db)], async () => {
    for (const [nom, registres] of taules) await db.table(nom).bulkPut(registres)
    await db.esborranys.clear()
    await db.esborranys.bulkPut(esborranys)
    await adoptarClausDeDrive(db, copia.embolcalls)
    // Tot el que té el dispositiu es tornarà a apuntar a la cua i es pujarà
    await db.meta.bulkPut([{ clau: 'estatDrive', valor: { aplicats: {}, vistos: {} } }])
    await db.meta.delete('versionsLocals')
    await db.meta.delete('darreraSincronia')
    await db.meta.delete('baseSincronia')
  })
  const conflictesAbans = await db.conflictes.count()
  await sincronitzar(db, clauDrive, drive)
  const possiblesDuplicats = await marcarDuplicats(db, clauDrive, propis)
  return { possiblesDuplicats, conflictes: (await db.conflictes.count()) - conflictesAbans }
}

/** Registres del format 1 sense versions: tots els camps amb la versió de l'últim canvi */
async function ambVersions(clau: CryptoKey, taula: string, r: Registre): Promise<Registre> {
  if (!esPerCamp(taula) || r.versions) return r
  const obert = await obrirRegistre(clau, taula, r)
  const h = hlcDeData(r.modificatAt as string)
  const versions: Versions = Object.fromEntries(Object.keys(obert.camps).map((c) => [c, [h, null]]))
  return tancarRegistre(clau, taula, r, { camps: obert.camps, versions })
}

/**
 * «Importar una còpia»: les dades del .qi s'afegeixen a les del dispositiu,
 * que conserva la seva clau (si el .qi és d'una altra, es tornen a xifrar).
 * Es fusionen camp a camp i s'apunten a la cua per pujar-les.
 */
export async function importarQi(
  db: QiDB,
  clauLocal: CryptoKey,
  fitxer: FitxerCopia,
  clauQi: CryptoKey,
): Promise<{ possiblesDuplicats: number; conflictes: number }> {
  let copia = await desxifrarCopia(clauQi, fitxer)
  const mateixaClau = (await idClau(clauQi)) === (await idClau(clauLocal))
  if (!mateixaClau) {
    const taules = { ...copia.taules }
    for (const nom of TAULES_XIFRADES)
      taules[nom] = (await reXifrarRegistres(copia.taules[nom] as unknown as RegistreXifrat[], nom, clauQi, clauLocal)) as never
    copia = { ...copia, taules }
  }
  const propis = new Set((await db.pacients.toArray()).map((p) => p.id))
  const entrades: EntradaRemota[] = []
  for (const [taula, registres] of Object.entries(copia.taules)) {
    for (const r of registres as Registre[]) entrades.push({ taula, clau: clauDe(taula, r), registre: await ambVersions(clauLocal, taula, r) })
  }
  for (const e of copia.esborrats) entrades.push({ taula: e.taula, clau: e.clau, esborrat: e })
  const r = await aplicarRemots(db, clauLocal, entrades, { encuar: true })
  const possiblesDuplicats = mateixaClau ? 0 : await marcarDuplicats(db, clauLocal, propis)
  return { possiblesDuplicats, conflictes: r.conflictes }
}

async function llegirPacient(clau: CryptoKey, r: RegistreXifrat): Promise<PacientGuardat> {
  return esquemaPacientGuardat.parse(await desxifrarJson(clau, r.xifrat, context('pacients', r.id)))
}

/**
 * Els pacients que eren al dispositiu (`propis`) i que coincideixen (mateix
 * nom i data de naixement) amb un altre que no ho era queden marcats per
 * revisar, tots dos: no s'ajunten sols. Torna quantes parelles hi ha.
 */
async function marcarDuplicats(db: QiDB, clau: CryptoKey, propis: ReadonlySet<string>): Promise<number> {
  const perPersona = new Map<string, { r: RegistreXifrat; p: PacientGuardat }[]>()
  for (const r of await db.pacients.toArray()) {
    const p = await llegirPacient(clau, r)
    const k = clauPersona(p)
    perPersona.set(k, [...(perPersona.get(k) ?? []), { r, p }])
  }
  let parelles = 0
  for (const grup of perPersona.values()) {
    const meus = grup.filter((x) => propis.has(x.r.id))
    const altres = grup.filter((x) => !propis.has(x.r.id))
    if (meus.length === 0 || altres.length === 0) continue
    parelles += meus.length * altres.length
    for (const x of grup) {
      const contraris = (propis.has(x.r.id) ? altres : meus).map((y) => y.r.id)
      const revisarDuplicat = [...new Set([...(x.p.revisarDuplicat ?? []), ...contraris])].sort()
      await desarPerCamp(
        db,
        clau,
        'pacients',
        { id: x.r.id, creatAt: x.r.creatAt, modificatAt: new Date().toISOString() },
        { ...x.p, revisarDuplicat },
        Object.keys(esquemaPacientGuardat.shape),
      )
    }
  }
  return parelles
}
