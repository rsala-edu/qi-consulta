// Sincronia amb Google Drive: baixa la còpia, la fusiona amb les dades
// locals, desa el resultat i el torna a pujar xifrat. A més de la còpia
// actual, en guarda una de diària (30 dies) i una de mensual (12 mesos).

import { ErrorDrive } from './drive'
import { guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada, llegirClauMestraAt, llegirSecrets } from '../db/magatzem'
import type { QiDB } from '../db/esquema'
import {
  aplicarContingut,
  desxifrarCopia,
  fusionar,
  fusionarEmbolcalls,
  iguals,
  llegirContingut,
  llegirFitxer,
  xifrarCopia,
  type Contingut,
  type Embolcalls,
  type FitxerCopia,
} from './copia'
import { baseDe, fusionarClinics, recuperarFitxesDescartades } from './fusioClinica'
import type { Drive, FitxerDrive } from './drive'

export const FITXER_PRINCIPAL = 'qi-dades.json'
const DIARIA = /^qi-copia-(\d{4}-\d{2}-\d{2})\.json$/
const MENSUAL = /^qi-mensual-(\d{4}-\d{2})\.json$/
export const DIES_COPIES_DIARIES = 30
export const MESOS_COPIES_MENSUALS = 12

export interface ResultatSincronia {
  /** S'han rebut canvis d'un altre dispositiu */
  baixat: boolean
  /** S'ha pujat una versió nova */
  pujat: boolean
  /** Data de la còpia que hi ha ara a Drive */
  copiaAt: string
}

async function embolcallsLocals(db: QiDB): Promise<Embolcalls> {
  const contrasenya = await llegirClauEmbolcallada(db)
  if (!contrasenya) throw new Error('No hi ha contrasenya')
  return { contrasenya, contrasenyaAt: await llegirClauMestraAt(db), secrets: await llegirSecrets(db) }
}

/** La còpia principal que hi ha a Drive (sense desxifrar), si n'hi ha. */
export async function copiaDeDrive(drive: Drive): Promise<FitxerCopia | null> {
  const principal = (await drive.llistar()).find((f) => f.name === FITXER_PRINCIPAL)
  return principal ? llegirFitxer(await drive.baixar(principal.id)) : null
}

export async function sincronitzar(db: QiDB, clau: CryptoKey, drive: Drive, ara: Date = new Date()): Promise<ResultatSincronia> {
  const fitxers = await drive.llistar()
  const principal = fitxers.find((f) => f.name === FITXER_PRINCIPAL)
  // L'hora d'aquest dispositiu en començar: el que es modifiqui a partir d'ara
  // és posterior a aquesta sincronia
  const inici = new Date().toISOString()
  const darrera = await llegirDarreraSincronia(db)
  const local = await llegirContingut(db)
  let embolcalls = await embolcallsLocals(db)

  let fusionat = local
  let remot = null
  let embolcallsRemots: Embolcalls | null = null
  if (principal) {
    const fitxer = llegirFitxer(await drive.baixar(principal.id))
    embolcallsRemots = fitxer.embolcalls
    remot = await desxifrarCopia(clau, fitxer)
    // Les dades clíniques editades als dos dispositius es fusionen camp a camp
    const base = await db.meta.get('baseSincronia')
    const clinica = await fusionarClinics(clau, local, remot, darrera, inici, base?.clau === 'baseSincronia' ? base.valor : {})
    fusionat = fusionar(clinica.local, clinica.remot)
    const nous = fusionarEmbolcalls(embolcalls, fitxer.embolcalls)
    if (JSON.stringify(nous) !== JSON.stringify(embolcalls)) {
      await guardarClauEmbolcallada(db, nous.contrasenya, nous.contrasenyaAt)
      await guardarSecrets(db, nous.secrets)
      embolcalls = nous
    }
  }
  // Una sola vegada: les fitxes duplicades que una versió anterior podia haver descartat
  const recuperacio = await db.meta.get('fitxesRecuperades')
  let recuperades: number | null = null
  if (!recuperacio) {
    const r = await recuperarFitxesDescartades(clau, fusionat, await copiesAnteriors(drive, fitxers, clau), inici)
    fusionat = r.contingut
    recuperades = r.recuperades
  }

  const baixat = !iguals(fusionat, local)
  if (baixat) await aplicarContingut(db, fusionat)

  // Es puja si Drive no té tots els canvis o si hi té embolcalls més vells
  // (per exemple, després de canviar la contrasenya)
  let pujat = false
  let actual: FitxerDrive | undefined = principal
  const text = JSON.stringify(await xifrarCopia(clau, fusionat, embolcalls))
  if (!principal) {
    actual = await drive.crear(FITXER_PRINCIPAL, text)
    pujat = true
  } else if (!iguals(fusionat, remot!) || JSON.stringify(embolcallsRemots) !== JSON.stringify(embolcalls)) {
    actual = await drive.actualitzar(principal.id, text)
    pujat = true
  }

  await copiesPeriodiques(drive, fitxers, text, ara)
  await db.meta.bulkPut([
    { clau: 'darreraSincronia', valor: inici },
    { clau: 'baseSincronia', valor: baseDe(fusionat) },
  ])
  if (recuperades !== null) {
    await db.meta.put({ clau: 'fitxesRecuperades', valor: { at: inici, recuperades } })
    if (recuperades > 0) console.info(`[Qi] Sincronia: ${recuperades} fitxes clíniques recuperades de les còpies de Drive`)
  }
  return { baixat, pujat, copiaAt: actual!.modifiedTime }
}

export async function llegirDarreraSincronia(db: QiDB): Promise<string | null> {
  const r = await db.meta.get('darreraSincronia')
  return r?.clau === 'darreraSincronia' ? r.valor : null
}

/** Les còpies diàries i mensuals de Drive que es poden llegir (les que no, es deixen estar) */
async function copiesAnteriors(drive: Drive, fitxers: readonly FitxerDrive[], clau: CryptoKey): Promise<Contingut[]> {
  const copies: Contingut[] = []
  for (const f of fitxers) {
    if (!DIARIA.test(f.name) && !MENSUAL.test(f.name)) continue
    try {
      copies.push(await desxifrarCopia(clau, llegirFitxer(await drive.baixar(f.id))))
    } catch {
      // Una còpia antiga que no es pot llegir no atura la sincronia
    }
  }
  return copies
}

const diaUtc = (d: Date) => d.toISOString().slice(0, 10)

async function copiesPeriodiques(drive: Drive, fitxers: FitxerDrive[], text: string, ara: Date): Promise<void> {
  const avui = diaUtc(ara)
  const mes = avui.slice(0, 7)
  if (!fitxers.some((f) => f.name === `qi-copia-${avui}.json`)) await drive.crear(`qi-copia-${avui}.json`, text)
  if (!fitxers.some((f) => f.name === `qi-mensual-${mes}.json`)) await drive.crear(`qi-mensual-${mes}.json`, text)

  const limitDiari = diaUtc(new Date(ara.getTime() - DIES_COPIES_DIARIES * 86_400_000))
  const d = new Date(Date.UTC(ara.getUTCFullYear(), ara.getUTCMonth() - MESOS_COPIES_MENSUALS, 1))
  const limitMensual = d.toISOString().slice(0, 7)
  for (const f of fitxers) {
    const diari = DIARIA.exec(f.name)?.[1]
    const mensual = MENSUAL.exec(f.name)?.[1]
    if ((diari && diari < limitDiari) || (mensual && mensual < limitMensual)) {
      // Si l'altre dispositiu ja l'ha esborrada, no és cap error
      await drive.esborrar(f.id).catch((e: unknown) => {
        if (!(e instanceof ErrorDrive && e.estat === 404)) throw e
      })
    }
  }
}

// La recuperació en un dispositiu nou és a recuperacio.ts, pas a pas.
