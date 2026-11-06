// Sincronia amb Google Drive, format 2 (docs/sincronia.md, 8.3).
//
// Una sincronia: (1) llegir la llista de fitxers i baixar només els que han
// canviat; (2) aplicar les fotos de la generació més nova i els diaris dels
// altres dispositius, registre a registre (aplicar.ts: mai se substitueix cap
// taula); (3) pujar el diari propi amb tot el que hi ha a la cua; (4) de tant
// en tant, fer una foto nova; (5) escurçar el diari propi i fer neteja.
//
// Cada fitxer modificable té un sol autor (el diari de cada dispositiu); les
// fotos i les còpies diàries i mensuals no es modifiquen mai. Per això dos
// dispositius que sincronitzen alhora no es poden trepitjar.
//
// Si a Drive encara hi ha el format 1 (qi-dades.json), el primer dispositiu
// amb aquesta versió el migra: el fusiona, en desa còpies (un .qi al
// dispositiu i qi-v1-<data>.json a Drive), fa la primera foto i deixa a
// qi-dades.json un avís perquè les versions antigues no hi escriguin.

import { guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada, llegirClauMestraAt, llegirSecrets } from '../db/magatzem'
import type { EstatDrive, QiDB, RegistreEsborrat } from '../db/esquema'
import { aplicarRemots, clauDe, type EntradaRemota } from './aplicar'
import {
  desxifrarCopia,
  fusionarEmbolcalls,
  llegirContingut,
  llegirFitxer,
  TAULES,
  xifrarCopia,
  type Contingut,
  type Embolcalls,
  type FitxerCopia,
} from './copia'
import { ErrorDrive, type Drive, type FitxerDrive } from './drive'
import { encuar, rellotgeDe } from './escriptura'
import {
  AVIS_V1,
  esAvisV1,
  esFormat2,
  llegirFitxer2,
  MINIMA_PER_ESCRIURE,
  NIVELL_APP,
  NOM_V1,
  nomDiari,
  nomFoto,
  obrirDiari,
  obrirFoto,
  RE_DANYADA,
  RE_DIARI,
  RE_DIARIA,
  RE_FOTO,
  RE_MENSUAL,
  xifrarDiari,
  xifrarFoto,
  type ContingutFoto,
  type EntradaDiari,
  type FitxerFoto,
} from './format2'
import { hlcDeData } from './hlc'
import { esPerCamp, obrirRegistre, tancarRegistre, type Registre, type VersioCamp, type Versions } from './registres'

export const FITXER_PRINCIPAL = NOM_V1
export const DIES_COPIES_DIARIES = 30
export const MESOS_COPIES_MENSUALS = 12
/** Les còpies danyades apartades s'esborren passats aquests dies */
export const DIES_COPIES_DANYADES = 30
/** Es fa una foto nova si la més nova té més d'un dia i hi ha canvis als diaris, o si els diaris són grans */
const COMPACTAR_CADA = 24 * 3_600_000
const DIARIS_GRANS = 500
/** El diari propi només s'escurça quan les fotos que el cobreixen fa aquest temps que existeixen */
const MARGE_ESCURCAR = 10 * 60_000

export interface ResultatSincronia {
  /** S'han rebut canvis d'un altre dispositiu */
  baixat: boolean
  /** S'ha pujat alguna cosa */
  pujat: boolean
  /** Últim canvi a Drive (qualsevol dispositiu) */
  copiaAt: string
  /** Drive demana una versió més nova de l'app per escriure: no s'ha pujat res */
  nomesLectura: boolean
}

/** Què se sap de la còpia de Drive, per als detalls tècnics (sense cap dada) */
export interface InfoDrive {
  /** Versió del format del fitxer de Drive (null: no n'hi ha o no es pot llegir) */
  versio: number | null
  /** Identificador de la clau amb què va xifrada (null: no en porta) */
  clauId: string | null
}

export interface OpcionsSincronia {
  ara?: Date
  /** S'avisa del que s'ha llegit de Drive, també si després falla */
  informar?(info: InfoDrive): void
  /**
   * La foto més nova és danyada: es fan servir les anteriors o les còpies
   * diàries i mensuals, i la danyada es conserva a part a Drive.
   */
  copiaAnterior?: boolean
  /** Només llegir (dispositiu nou que recupera les dades): no s'escriu res a Drive */
  nomesLlegir?: boolean
}

export function infoDeText(text: string | null): InfoDrive {
  if (text === null) return { versio: null, clauId: null }
  try {
    const j = JSON.parse(text) as { versio?: unknown; clauId?: unknown }
    return { versio: typeof j.versio === 'number' ? j.versio : null, clauId: typeof j.clauId === 'string' ? j.clauId : null }
  } catch {
    return { versio: null, clauId: null }
  }
}

/** La còpia de Drive no es pot obrir i no n'hi ha cap d'anterior que es pugui fer servir */
export class ErrorSenseCopiaAnterior extends Error {
  constructor() {
    super('Cap còpia anterior es pot obrir')
    this.name = 'ErrorSenseCopiaAnterior'
  }
}

/** La còpia de Drive per recuperar-la o per canviar de clau: les claus i, si és del format 1, el fitxer */
export interface CopiaDrive {
  format: 1 | 2
  embolcalls: Embolcalls
  clauId: string | null
  /** Format 1: el fitxer qi-dades.json */
  v1?: FitxerCopia
}

const versioDe = (f: FitxerDrive) => f.version ?? f.modifiedTime

/** Les fotos d'una generació, de la més nova a la més antiga */
function fotosDe(fitxers: readonly FitxerDrive[]) {
  return fitxers
    .map((f) => ({ f, m: RE_FOTO.exec(f.name) }))
    .filter((x): x is { f: FitxerDrive; m: RegExpExecArray } => x.m !== null)
    .map(({ f, m }) => ({ f, generacio: Number(m[1]), dispositiu: m[2]! }))
}

/** La còpia de Drive (sense desxifrar-la), si n'hi ha: per a un dispositiu nou o per canviar de clau */
export async function copiaDeDrive(drive: Drive): Promise<CopiaDrive | null> {
  const fitxers = await drive.llistar()
  const fotos = fotosDe(fitxers).sort((a, b) => b.generacio - a.generacio)
  const diaris = fitxers.filter((f) => RE_DIARI.test(f.name))
  const candidats = [...fotos.map((x) => x.f), ...diaris]
  if (candidats.length > 0) {
    let embolcalls: Embolcalls | null = null
    let clauId: string | null = null
    let darrerError: unknown = null
    for (const f of candidats) {
      try {
        const c = llegirFitxer2(await drive.baixar(f.id))
        embolcalls = embolcalls ? fusionarEmbolcalls(embolcalls, c.embolcalls) : c.embolcalls
        clauId ??= c.clauId
      } catch (e) {
        darrerError = e
      }
    }
    if (!embolcalls) throw darrerError
    return { format: 2, embolcalls, clauId }
  }
  const v1 = fitxers.find((f) => f.name === NOM_V1)
  if (!v1) return null
  const fitxer = llegirFitxer(await drive.baixar(v1.id))
  return { format: 1, embolcalls: fitxer.embolcalls, clauId: fitxer.clauId ?? null, v1: fitxer }
}

async function embolcallsLocals(db: QiDB): Promise<Embolcalls> {
  const contrasenya = await llegirClauEmbolcallada(db)
  if (!contrasenya) throw new Error('No hi ha contrasenya')
  return { contrasenya, contrasenyaAt: await llegirClauMestraAt(db), secrets: await llegirSecrets(db) }
}

export async function llegirEstatDrive(db: QiDB): Promise<EstatDrive & { embolcallsPujats?: string; cobertures?: Record<string, Record<string, number>>; minima?: number }> {
  const r = await db.meta.get('estatDrive')
  return r?.clau === 'estatDrive' ? (r.valor as never) : { aplicats: {}, vistos: {} }
}

export async function llegirDarreraSincronia(db: QiDB): Promise<string | null> {
  const r = await db.meta.get('darreraSincronia')
  return r?.clau === 'darreraSincronia' ? r.valor : null
}

/** Les entrades d'una foto o d'un contingut del format 1 */
function entradesDe(c: ContingutFoto | Contingut): EntradaRemota[] {
  const entrades: EntradaRemota[] = []
  for (const [taula, registres] of Object.entries(c.taules)) {
    for (const registre of registres as Registre[]) entrades.push({ taula, clau: clauDe(taula, registre), registre })
  }
  for (const e of c.esborrats) entrades.push({ taula: e.taula, clau: e.clau, esborrat: e })
  return entrades
}

/** Totes les dades sincronitzades del dispositiu, per a una foto (també les taules desconegudes) */
export async function fotoLocal(db: QiDB): Promise<ContingutFoto> {
  const c = await llegirContingut(db)
  const taules: Record<string, Registre[]> = { ...(c.taules as unknown as Record<string, Registre[]>) }
  for (const d of await db.desconegudes.toArray()) (taules[d.taula] ??= []).push(d.registre as Registre)
  return { taules, esborrats: c.esborrats }
}

const diaUtc = (d: Date) => d.toISOString().slice(0, 10)

export async function sincronitzar(db: QiDB, clau: CryptoKey, drive: Drive, opcions: OpcionsSincronia | Date = {}): Promise<ResultatSincronia> {
  const o = opcions instanceof Date ? { ara: opcions } : opcions
  const fer = () => sincronitzarAra(db, clau, drive, o)
  // Dues pestanyes del mateix navegador són el mateix dispositiu: mai sincronitzen alhora
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request(`qi-sinc-${db.name}`, fer) : fer()
}

async function sincronitzarAra(
  db: QiDB,
  clau: CryptoKey,
  drive: Drive,
  opcions: OpcionsSincronia,
  tornada = false,
): Promise<ResultatSincronia> {
  const { ara = new Date(), informar, copiaAnterior = false, nomesLlegir = false } = opcions
  const inici = new Date().toISOString()
  const { dispositiu, rellotge } = await rellotgeDe(db)
  const fitxers = await drive.llistar()
  const estat = await llegirEstatDrive(db)
  estat.cobertures ??= {}
  let canviats = 0
  let migrant = false

  // Els registres d'abans de la versió 2 reben versions (i el que no s'havia pujat, a la cua)
  await versionsLocals(db, clau)

  const v1 = fitxers.find((f) => f.name === NOM_V1)
  const te2 = fitxers.some((f) => RE_FOTO.test(f.name) || RE_DIARI.test(f.name))
  if (v1 && estat.aplicats[v1.id] !== versioDe(v1)) {
    const text = await drive.baixar(v1.id)
    if (!esAvisV1(text)) {
      if (!te2) informar?.(infoDeText(text))
      // Format 1: es migra. Si ja hi ha format 2, una versió antiga hi ha escrit
      // després de migrar: els seus canvis s'apliquen (i es pugen) i torna l'avís
      let textV1 = text
      if (copiaAnterior && !te2) {
        try {
          llegirFitxer(text)
        } catch (e) {
          if (!(e instanceof Error && e.name === 'ErrorCopiaDanyada')) throw e
          // El qi-dades.json és danyat: es migra a partir de la còpia diària o mensual més nova
          textV1 = await textV1Anterior(clau, drive, fitxers)
          await apartarDanyat(drive, v1, false)
        }
      }
      canviats += await aplicarV1(db, clau, drive, fitxers, textV1, { absorbir: te2, ara })
      migrant = true
    } else estat.aplicats[v1.id] = versioDe(v1)
  }
  if (!v1 && !te2) {
    informar?.({ versio: null, clauId: null })
    // Primera escriptura: es torna a mirar que cap altre dispositiu no hi hagi
    // posat dades mentrestant. Si n'hi ha, es torna a començar amb les seves.
    if (!tornada && !nomesLlegir && (await drive.llistar()).some((f) => f.name === NOM_V1 || RE_FOTO.test(f.name) || RE_DIARI.test(f.name)))
      return sincronitzarAra(db, clau, drive, opcions, true)
  }

  // --- Lectura ---
  const fotos = fotosDe(fitxers)
  const genMax = fotos.reduce((m, x) => Math.max(m, x.generacio), 0)
  let minima = estat.minima ?? MINIMA_PER_ESCRIURE
  const embolcallsRemots: Embolcalls[] = []

  const llegir = async (f: FitxerDrive) => {
    const text = await drive.baixar(f.id)
    const info = infoDeText(text)
    informar?.(info)
    const c = llegirFitxer2(text)
    minima = Math.max(minima, c.minimaPerEscriure)
    embolcallsRemots.push(c.embolcalls)
    return { text, c }
  }

  for (const { f } of fotos.filter((x) => x.generacio === genMax)) {
    if (estat.aplicats[f.id] === versioDe(f)) continue
    try {
      const { c } = await llegir(f)
      const foto = c as FitxerFoto
      estat.cobertures[f.id] = foto.cobertura
      canviats += (await aplicarRemots(db, clau, entradesDe(await obrirFoto(clau, foto)))).canviats
      estat.aplicats[f.id] = versioDe(f)
    } catch (e) {
      if (!copiaAnterior || !(e instanceof Error && e.name === 'ErrorCopiaDanyada')) throw e
      canviats += await recuperarDeCopiesAnteriors(db, clau, drive, fitxers, f, genMax)
      estat.aplicats[f.id] = versioDe(f)
    }
  }
  for (const f of fitxers) {
    const m = RE_DIARI.exec(f.name)
    if (!m || m[1] === dispositiu || estat.aplicats[f.id] === versioDe(f)) continue
    try {
      const { c } = await llegir(f)
      const entrades = await obrirDiari(clau, c as never)
      canviats += (await aplicarRemots(db, clau, entrades as EntradaRemota[])).canviats
      estat.vistos[m[1]!] = Math.max(estat.vistos[m[1]!] ?? 0, entrades.reduce((x, e) => Math.max(x, e.seq), 0))
      estat.aplicats[f.id] = versioDe(f)
    } catch (e) {
      if (!copiaAnterior || !(e instanceof Error && e.name === 'ErrorCopiaDanyada')) throw e
      // El diari d'un altre dispositiu és danyat: es guarda a part i el seu autor el tornarà a escriure
      await apartarDanyat(drive, f)
    }
  }
  const diariPropi = fitxers.find((f) => f.name === nomDiari(dispositiu))
  if (diariPropi) estat.diariPropi = diariPropi.id

  // Les claus: la contrasenya més nova i la unió de les altres maneres d'obrir
  let embolcalls = await embolcallsLocals(db)
  for (const e of embolcallsRemots) embolcalls = fusionarEmbolcalls(embolcalls, e)
  if (JSON.stringify(embolcalls) !== JSON.stringify(await embolcallsLocals(db))) {
    await guardarClauEmbolcallada(db, embolcalls.contrasenya, embolcalls.contrasenyaAt)
    await guardarSecrets(db, embolcalls.secrets)
  }
  estat.minima = minima
  const nomesLectura = minima > NIVELL_APP
  let ultimCanvi = fitxers.reduce((m, f) => (f.modifiedTime > m ? f.modifiedTime : m), estat.ultimCanvi ?? '')

  const acabar = async (pujat: boolean): Promise<ResultatSincronia> => {
    estat.ultimCanvi = ultimCanvi || undefined
    await db.meta.bulkPut([
      { clau: 'estatDrive', valor: estat },
      { clau: 'darreraSincronia', valor: inici },
      { clau: 'hlc', valor: rellotge.actual },
    ])
    return { baixat: canviats > 0, pujat, copiaAt: ultimCanvi || inici, nomesLectura }
  }
  if (nomesLlegir || nomesLectura) return acabar(false)

  // --- Escriptura: el diari propi ---
  let pujat = false
  const N = ((await db.meta.get('seq'))?.valor as number | undefined) ?? 0
  const pujatFins = ((await db.meta.get('pujatFins'))?.valor as number | undefined) ?? 0
  const propis = await db.canvisPropis.toArray()
  const textEmbolcalls = JSON.stringify(embolcalls)
  const calDiari = propis.some((p) => p.seq > pujatFins) || !estat.diariPropi || estat.embolcallsPujats !== textEmbolcalls || migrant
  const anotarHora = async (f: FitxerDrive) => {
    if (f.modifiedTime > ultimCanvi) ultimCanvi = f.modifiedTime
    // L'hora de Drive del fitxer que s'acaba d'escriure: per saber si el rellotge d'aquí va desfasat
    const ms = Date.now() - Date.parse(f.modifiedTime)
    if (Number.isFinite(ms)) await db.meta.put({ clau: 'desfasRellotge', valor: { ms, at: new Date().toISOString() } })
  }
  if (calDiari) {
    const entrades: EntradaDiari[] = []
    for (const p of propis) {
      const registre = TAULES.some((t) => t.nom === p.taula)
        ? ((await db.table(p.taula).get(p.clau)) as Registre | undefined)
        : ((await db.desconegudes.get(p.id))?.registre as Registre | undefined)
      const esborrat = await db.esborrats.get(p.id)
      entrades.push({ taula: p.taula, clau: p.clau, seq: p.seq, ...(registre ? { registre } : esborrat ? { esborrat } : {}) })
    }
    const text = JSON.stringify(await xifrarDiari(clau, { dispositiu, embolcalls, vistFins: rellotge.actual, ara }, entrades))
    let escrit: FitxerDrive
    try {
      escrit = estat.diariPropi ? await drive.actualitzar(estat.diariPropi, text) : await drive.crear(nomDiari(dispositiu), text)
    } catch (e) {
      // El diari propi ha desaparegut de Drive (algú l'ha esborrat): es torna a crear
      if (!(e instanceof ErrorDrive && e.estat === 404)) throw e
      escrit = await drive.crear(nomDiari(dispositiu), text)
    }
    estat.diariPropi = escrit.id
    estat.aplicats[escrit.id] = versioDe(escrit)
    estat.embolcallsPujats = textEmbolcalls
    await db.meta.put({ clau: 'pujatFins', valor: N })
    await anotarHora(escrit)
    pujat = true
  }

  // --- Foto nova (compactar) ---
  const fotosNoves = fotos.filter((x) => x.generacio === genMax)
  const midaDiaris = Object.values(estat.vistos).length + propis.length
  const fotoVella = fotosNoves.every((x) => Date.parse(x.f.modifiedTime) < ara.getTime() - COMPACTAR_CADA)
  // Fins on la foto més nova cobreix el diari propi: el que hi ha més enllà, encara no és a cap foto
  const cobertMeu = Math.min(...fotosNoves.map((x) => estat.cobertures![x.f.id]?.[dispositiu] ?? 0))
  const senseFoto = canviats > 0 || propis.some((p) => p.seq > cobertMeu)
  let textFoto: string | null = null
  let genActual = genMax
  if (fotos.length === 0 || migrant || (fotoVella && senseFoto) || midaDiaris > DIARIS_GRANS) {
    genActual = genMax + 1
    const cobertura = { ...estat.vistos, [dispositiu]: N }
    textFoto = JSON.stringify(await xifrarFoto(clau, { dispositiu, embolcalls, generacio: genActual, cobertura, ara }, await fotoLocal(db)))
    const f = await drive.crear(nomFoto(genActual, dispositiu), textFoto)
    estat.aplicats[f.id] = versioDe(f)
    estat.cobertures[f.id] = cobertura
    await anotarHora(f)
    pujat = true
  }

  // Avís per a les versions antigues a qi-dades.json (un cop migrat)
  if (migrant && v1) {
    const f = await drive.actualitzar(v1.id, AVIS_V1)
    estat.aplicats[v1.id] = versioDe(f)
  }

  // --- Escurçar el diari propi ---
  // Només el que ja és a totes les fotos de la generació més nova, quan fa prou
  // temps que existeixen (si dues es feien alhora, ja es veuen totes dues)
  if (genActual === genMax && fotosNoves.length > 0) {
    const ara2 = Date.now()
    const totesVelles = fotosNoves.every((x) => Date.parse(x.f.modifiedTime) < ara2 - MARGE_ESCURCAR)
    const cobertes = fotosNoves.map((x) => estat.cobertures![x.f.id]?.[dispositiu])
    if (totesVelles && cobertes.every((c) => c !== undefined)) {
      const fins = Math.min(...(cobertes as number[]), (await db.meta.get('pujatFins'))?.valor as number)
      await db.canvisPropis.where('seq').belowOrEqual(fins).delete()
    }
  }

  // --- Neteja i còpies ---
  const esborrar = (f: FitxerDrive) =>
    drive.esborrar(f.id).catch((e: unknown) => {
      // Si un altre dispositiu ja l'ha esborrat, no és cap error
      if (!(e instanceof ErrorDrive && e.estat === 404)) throw e
    })
  // Les fotos de més de dues generacions enrere (no es modifiquen mai: esborrar-les no trepitja ningú)
  for (const x of fotos) if (x.generacio < genActual - 1) await esborrar(x.f)
  if (!fitxers.some((f) => f.name === `qi-copia-${diaUtc(ara)}.json`) || !fitxers.some((f) => f.name === `qi-mensual-${diaUtc(ara).slice(0, 7)}.json`)) {
    textFoto ??= JSON.stringify(
      await xifrarFoto(clau, { dispositiu, embolcalls, generacio: 0, cobertura: { ...estat.vistos, [dispositiu]: N }, ara }, await fotoLocal(db)),
    )
    if (!fitxers.some((f) => f.name === `qi-copia-${diaUtc(ara)}.json`)) await drive.crear(`qi-copia-${diaUtc(ara)}.json`, textFoto)
    if (!fitxers.some((f) => f.name === `qi-mensual-${diaUtc(ara).slice(0, 7)}.json`))
      await drive.crear(`qi-mensual-${diaUtc(ara).slice(0, 7)}.json`, textFoto)
  }
  const limitDiari = diaUtc(new Date(ara.getTime() - DIES_COPIES_DIARIES * 86_400_000))
  const limitDanyada = diaUtc(new Date(ara.getTime() - DIES_COPIES_DANYADES * 86_400_000))
  const d = new Date(Date.UTC(ara.getUTCFullYear(), ara.getUTCMonth() - MESOS_COPIES_MENSUALS, 1))
  const limitMensual = d.toISOString().slice(0, 7)
  for (const f of fitxers) {
    const diari = RE_DIARIA.exec(f.name)?.[1]
    const mensual = RE_MENSUAL.exec(f.name)?.[1]
    const danyada = RE_DANYADA.exec(f.name)?.[1]
    if ((diari && diari < limitDiari) || (mensual && mensual < limitMensual) || (danyada && danyada < limitDanyada)) await esborrar(f)
  }
  return acabar(pujat)
}

/** Es guarda una còpia del fitxer danyat (qi-danyada-*) i, si cal, s'esborra */
async function apartarDanyat(drive: Drive, f: FitxerDrive, treure = true): Promise<void> {
  const text = await drive.baixar(f.id)
  await drive.crear(`qi-danyada-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, text)
  if (treure) await drive.esborrar(f.id).catch(() => {})
}

/** La còpia diària o mensual del format 1 més nova que s'obre amb aquesta clau */
async function textV1Anterior(clau: CryptoKey, drive: Drive, fitxers: readonly FitxerDrive[]): Promise<string> {
  const candidats = fitxers
    .filter((f) => RE_DIARIA.test(f.name) || RE_MENSUAL.test(f.name))
    .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
  for (const f of candidats) {
    try {
      const text = await drive.baixar(f.id)
      await desxifrarCopia(clau, llegirFitxer(text))
      return text
    } catch {
      // Es prova la següent
    }
  }
  throw new ErrorSenseCopiaAnterior()
}

/**
 * La foto més nova és danyada: s'aparta (es guarda una còpia qi-danyada-*) i
 * s'aplica la foto més nova d'abans o la còpia diària o mensual més nova que
 * es pugui obrir. Els diaris dels dispositius porten la resta.
 */
async function recuperarDeCopiesAnteriors(
  db: QiDB,
  clau: CryptoKey,
  drive: Drive,
  fitxers: readonly FitxerDrive[],
  danyada: FitxerDrive,
  genMax: number,
): Promise<number> {
  const candidats = [
    ...fotosDe(fitxers)
      .filter((x) => x.generacio < genMax)
      .sort((a, b) => b.generacio - a.generacio)
      .map((x) => x.f),
    ...fitxers.filter((f) => RE_DIARIA.test(f.name) || RE_MENSUAL.test(f.name)).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)),
  ]
  for (const f of candidats) {
    try {
      const text = await drive.baixar(f.id)
      const contingut = esFormat2(text) ? await obrirFoto(clau, llegirFitxer2(text) as FitxerFoto) : await desxifrarCopia(clau, llegirFitxer(text))
      await apartarDanyat(drive, danyada)
      return (await aplicarRemots(db, clau, entradesDe(contingut))).canviats
    } catch {
      // Es prova la següent
    }
  }
  throw new ErrorSenseCopiaAnterior()
}

// --- Del format 1 al format 2 ---

/**
 * Fusiona el qi-dades.json del format 1 amb el dispositiu, sense substituir res:
 * els registres reben versions comparant-los amb la base de l'última
 * sincronia (el que ha canviat només en un lloc no és cap conflicte).
 * `absorbir`: ja hi ha format 2 i és una versió antiga que hi ha escrit; el
 * que hi porti s'apunta a la cua perquè arribi als altres.
 */
async function aplicarV1(
  db: QiDB,
  clau: CryptoKey,
  drive: Drive,
  fitxers: readonly FitxerDrive[],
  text: string,
  { absorbir, ara }: { absorbir: boolean; ara: Date },
): Promise<number> {
  const fitxer = llegirFitxer(text)
  const remot = await desxifrarCopia(clau, fitxer)
  if (!absorbir) {
    // Còpies abans de migrar: el dispositiu (.qi) i el qi-dades.json d'abans
    if (!(await db.meta.get('copiaAbansMigracio'))) {
      const qi = JSON.stringify({ ...(await xifrarCopia(clau, await llegirContingut(db), await embolcallsLocals(db))), creatAt: ara.toISOString() })
      await db.meta.put({ clau: 'copiaAbansMigracio', valor: { at: ara.toISOString(), text: qi } })
    }
    if (!fitxers.some((f) => f.name.startsWith('qi-v1-'))) await drive.crear(`qi-v1-${diaUtc(ara)}.json`, text)
  }
  const base = await db.meta.get('baseSincronia')
  const bases = base?.clau === 'baseSincronia' ? base.valor : {}
  const entrades: EntradaRemota[] = []
  for (const e of entradesDe(remot)) {
    if (e.registre && esPerCamp(e.taula) && !e.registre.versions) {
      const b = (bases[e.taula] ?? []).find((x) => x.id === e.clau) as Registre | undefined
      e.registre = await ambVersionsDerivades(clau, e.taula, e.registre, b)
    }
    entrades.push(e)
  }
  return (await aplicarRemots(db, clau, entrades, { encuar: absorbir })).canviats
}

/**
 * Versions per a un registre del format 1: els camps iguals que a la base de
 * l'última sincronia tenen la versió de la base; els que han canviat, la del
 * registre (feta sobre la de la base).
 */
async function ambVersionsDerivades(clau: CryptoKey, taula: 'pacients' | 'fitxesCliniques' | 'cites', r: Registre, base?: Registre): Promise<Registre> {
  const obert = await obrirRegistre(clau, taula, r)
  const h = hlcDeData(r.modificatAt as string)
  const versions: Versions = {}
  if (!base) {
    for (const c of Object.keys(obert.camps)) versions[c] = [h, null]
  } else {
    const ob = await obrirRegistre(clau, taula, base)
    const hb = hlcDeData(base.modificatAt as string)
    for (const c of new Set([...Object.keys(obert.camps), ...Object.keys(ob.camps)])) {
      const iguals = JSON.stringify(obert.camps[c]) === JSON.stringify(ob.camps[c])
      versions[c] = (iguals ? [hb, null] : [h, hb]) as VersioCamp
    }
  }
  return tancarRegistre(clau, taula, r, { camps: obert.camps, versions })
}

/**
 * Una sola vegada: els registres del dispositiu d'abans de la versió 2 reben
 * versions, i el que s'havia desat després de l'última sincronia (encara no
 * era a Drive) s'apunta a la cua.
 */
async function versionsLocals(db: QiDB, clau: CryptoKey): Promise<void> {
  if (await db.meta.get('versionsLocals')) return
  const darrera = (await llegirDarreraSincronia(db)) ?? ''
  const base = await db.meta.get('baseSincronia')
  const bases = base?.clau === 'baseSincronia' ? base.valor : {}
  const { rellotge } = await rellotgeDe(db)
  const pendents: { taula: string; clau: string }[] = []
  for (const t of TAULES) {
    for (const r of (await db.table(t.nom).toArray()) as Registre[]) {
      const data = String(r[t.data] ?? '')
      if (!darrera || data > darrera) pendents.push({ taula: t.nom, clau: clauDe(t.nom, r) })
      if (!esPerCamp(t.nom) || r.versions) continue
      const b = (bases[t.nom] ?? []).find((x) => x.id === r.id) as Registre | undefined
      const nou = await ambVersionsDerivades(clau, t.nom, r, b)
      await db.transaction('rw', db.table(t.nom), async () => {
        const actual = (await db.table(t.nom).get(String(r.id))) as Registre | undefined
        if (actual && !actual.versions && JSON.stringify(actual.xifrat) === JSON.stringify(r.xifrat)) await db.table(t.nom).put(nou)
      })
    }
  }
  for (const e of (await db.esborrats.toArray()) as RegistreEsborrat[]) {
    if (!darrera || e.esborratAt > darrera) pendents.push({ taula: e.taula, clau: e.clau })
  }
  await db.transaction('rw', [db.canvisPropis, db.meta], async () => {
    // Si ja hi ha una entrada a la cua (s'ha desat amb aquesta versió), no es toca
    const ja = new Set((await db.canvisPropis.toArray()).map((c) => c.id))
    await encuar(
      db,
      pendents.filter((p) => !ja.has(`${p.taula}:${p.clau}`)),
      rellotge.actual,
    )
    await db.meta.put({ clau: 'versionsLocals', valor: new Date().toISOString() })
  })
}
