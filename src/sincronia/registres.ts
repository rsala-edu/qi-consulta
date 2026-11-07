// Registres amb versions, per a la sincronia (docs/sincronia.md, 8.2 i 8.4).
//
// - Registres clínics (pacients, fitxes, cites): cada camp porta la seva
//   versió [HLC, HLC del valor que va substituir], en un mapa xifrat al
//   mateix registre (`versions`). Els camps niats («habits.tabac») són camps.
// - La resta de taules (calibratge, precaucions, horari, dies tancats,
//   conflictes): una sola versió per registre (`hlc`).
// - Tots els registres porten en clar `hlc`: la versió més alta que tenen.
//
// fusionarRegistre() és la fusió de dues versions d'un registre: per a cada
// camp guanya l'HLC més gran, i si el que guanya no s'ha fet sobre el que perd
// (s'han editat alhora) i els valors són diferents, el que perd queda com a
// conflicte per revisar. És commutativa i idempotent: tots els dispositius hi
// arriben igual, sigui quin sigui l'ordre.

import { desxifrarJson, xifrarJson, type DadesXifrades } from '../crypto'
import type { NomTaula, RegistreConflicte, RegistreEsborrat, TaulaSincronitzada } from '../db/esquema'
import { context } from '../db/magatzem'
import { hlcDeData, llegirHlc, maxHlc, type Hlc } from './hlc'

/** Versió d'un camp: el seu HLC i el del valor que va substituir (null si era nou) */
export type VersioCamp = [Hlc, Hlc | null]
export type Versions = Record<string, VersioCamp>
export type Camps = Record<string, unknown>
export type Registre = Record<string, unknown> & { hlc?: Hlc }

/** Taules amb dades clíniques, fusionades camp a camp */
export const TAULES_PER_CAMP = ['pacients', 'fitxesCliniques', 'cites', 'episodis', 'sessions'] as const
export type TaulaPerCamp = (typeof TAULES_PER_CAMP)[number]
export const esPerCamp = (t: string): t is TaulaPerCamp => (TAULES_PER_CAMP as readonly string[]).includes(t)

/** Camps clínics que van en clar fora del xifrat (per cercar): també es fusionen */
export const CAMPS_CLARS: Record<TaulaPerCamp, readonly string[]> = {
  pacients: [],
  fitxesCliniques: ['pacientId'],
  cites: ['pacientId', 'inici'],
  episodis: ['pacientId'],
  sessions: ['pacientId', 'citaId', 'episodiId'],
}

const contextVersions = (taula: string, id: string) => `qi:versions:${taula}:${id}`

const esObjecte = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** { habits: { tabac: 'no' } } → { 'habits.tabac': 'no' }. Els objectes buits i les llistes són valors. */
export function aplanar(o: Record<string, unknown>, prefix = ''): Camps {
  const r: Camps = {}
  for (const [k, v] of Object.entries(o)) {
    const cami = prefix ? `${prefix}.${k}` : k
    if (esObjecte(v) && Object.keys(v).length > 0) Object.assign(r, aplanar(v, cami))
    else if (v !== undefined) r[cami] = v
  }
  return r
}

export function desplegar(camps: Camps): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  for (const [cami, v] of Object.entries(camps)) {
    if (v === undefined) continue
    const parts = cami.split('.')
    let o = r
    for (const p of parts.slice(0, -1)) {
      if (!esObjecte(o[p])) o[p] = {}
      o = o[p] as Record<string, unknown>
    }
    o[parts.at(-1)!] = v
  }
  return r
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** La versió d'un registre que no en té (format d'abans): la data de l'últim canvi */
export function hlcDeRegistre(r: Registre): Hlc {
  if (typeof r.hlc === 'string' && llegirHlc(r.hlc)) return r.hlc
  const data = (r.modificatAt ?? r.confirmadaAt) as string | undefined
  return hlcDeData(data)
}

export interface RegistreObert {
  /** Tots els camps (els xifrats i els clars), aplanats */
  camps: Camps
  versions: Versions
}

/** Desxifra un registre clínic: els seus camps i les seves versions */
export async function obrirRegistre(clau: CryptoKey, taula: TaulaPerCamp, r: Registre): Promise<RegistreObert> {
  const id = String(r.id)
  const dades = (await desxifrarJson(clau, r.xifrat as DadesXifrades, context(taula as NomTaula, id))) as Record<string, unknown>
  const clars = Object.fromEntries(CAMPS_CLARS[taula].filter((c) => r[c] !== undefined).map((c) => [c, r[c]]))
  const camps = aplanar({ ...dades, ...clars })
  let versions: Versions
  if (r.versions) versions = (await desxifrarJson(clau, r.versions as DadesXifrades, contextVersions(taula, id))) as Versions
  else {
    // Format d'abans: tots els camps tenen la versió de l'últim canvi del registre
    const h = hlcDeRegistre(r)
    versions = Object.fromEntries(Object.keys(camps).map((c) => [c, [h, null] as VersioCamp]))
  }
  return { camps, versions }
}

/** Torna a xifrar un registre clínic a partir dels camps i les versions */
export async function tancarRegistre(
  clau: CryptoKey,
  taula: TaulaPerCamp,
  base: Registre,
  { camps, versions }: RegistreObert,
): Promise<Registre> {
  const id = String(base.id)
  const clars: Camps = {}
  const resta: Camps = {}
  for (const [c, v] of Object.entries(camps)) (CAMPS_CLARS[taula].includes(c) ? clars : resta)[c] = v
  const hlc = Object.values(versions).reduce<Hlc | undefined>((m, [h]) => maxHlc(m, h), undefined) ?? hlcDeRegistre(base)
  const registre: Registre = { ...base }
  for (const c of CAMPS_CLARS[taula]) delete registre[c]
  Object.assign(registre, clars, {
    hlc,
    xifrat: await xifrarJson(clau, desplegar(resta), context(taula as NomTaula, id)),
    versions: await xifrarJson(clau, versions, contextVersions(taula, id)),
  })
  return registre
}

/** Un camp que s'ha perdut en fusionar (s'havia editat alhora en un altre lloc) */
export interface CampPerdut {
  camp: string
  valor: unknown
  /** HLC del valor que ha perdut */
  hlc: Hlc
}

/** Fusió camp a camp de dues versions obertes d'un mateix registre */
export function fusionarCamps(a: RegistreObert, b: RegistreObert): { obert: RegistreObert; perduts: CampPerdut[] } {
  const camps: Camps = {}
  const versions: Versions = {}
  const perduts: CampPerdut[] = []
  for (const c of new Set([...Object.keys(a.versions), ...Object.keys(b.versions), ...Object.keys(a.camps), ...Object.keys(b.camps)])) {
    const va = a.versions[c]
    const vb = b.versions[c]
    let guanya: RegistreObert
    let perd: RegistreObert | null = null
    if (!vb) guanya = a
    else if (!va) guanya = b
    else if (va[0] === vb[0]) guanya = igual(a.camps[c], b.camps[c]) || JSON.stringify(a.camps[c] ?? null) >= JSON.stringify(b.camps[c] ?? null) ? a : b
    else if (va[0] > vb[0]) [guanya, perd] = [a, b]
    else [guanya, perd] = [b, a]
    if (guanya.camps[c] !== undefined) camps[c] = guanya.camps[c]
    const v = guanya.versions[c]
    if (v) versions[c] = v
    if (!perd) continue
    const [hGuanya, sobre] = guanya.versions[c]!
    const [hPerd] = perd.versions[c]!
    // S'ha fet sobre el que perd: és un canvi posterior, no un conflicte
    if (sobre === hPerd || hGuanya === hPerd) continue
    if (igual(guanya.camps[c], perd.camps[c])) continue
    // Una contraindicació (sí/no) marcada en qualsevol de les dues versions fetes
    // alhora queda marcada: és el més prudent, i no cal revisar-la
    if (c.startsWith('contraindicacions.') && typeof guanya.camps[c] === 'boolean' && typeof perd.camps[c] === 'boolean') {
      camps[c] = true
      continue
    }
    perduts.push({ camp: c, valor: perd.camps[c], hlc: hPerd })
  }
  return { obert: { camps, versions }, perduts }
}

export interface ResultatFusio {
  /** El registre fusionat */
  registre: Registre
  /** Els valors que no han guanyat i s'han d'anotar com a conflicte */
  perduts: CampPerdut[]
}

/**
 * Fusiona dues versions d'un registre de la mateixa taula i clau. Les
 * metadades (id, creatAt…) són les de `a`, excepte modificatAt (el més nou).
 */
export async function fusionarRegistre(clau: CryptoKey, taula: TaulaSincronitzada, a: Registre, b: Registre): Promise<ResultatFusio> {
  if (!esPerCamp(taula)) {
    const ha = hlcDeRegistre(a)
    const hb = hlcDeRegistre(b)
    const guanya = ha > hb ? a : hb > ha ? b : JSON.stringify(a) >= JSON.stringify(b) ? a : b
    return { registre: { ...guanya, hlc: hlcDeRegistre(guanya) }, perduts: [] }
  }
  const [oa, ob] = await Promise.all([obrirRegistre(clau, taula, a), obrirRegistre(clau, taula, b)])
  const { obert, perduts } = fusionarCamps(oa, ob)
  const modificatAt = [a.modificatAt, b.modificatAt].map(String).sort().at(-1)
  // Si el resultat és el mateix que `a` (o que `b`), no cal tornar a xifrar
  if (igual(obert, oa)) return { registre: { ...a, hlc: hlcDeRegistre(a) }, perduts }
  if (igual(obert, ob)) return { registre: { ...b, ...metadades(a), modificatAt, hlc: hlcDeRegistre(b) }, perduts }
  return { registre: await tancarRegistre(clau, taula, { ...a, modificatAt }, obert), perduts }
}

const metadades = (r: Registre) => ({ id: r.id, creatAt: r.creatAt })

/** El registre continua viu si la seva versió és posterior a la de l'esborrat */
export const viuDespresDe = (r: Registre, e: RegistreEsborrat | undefined) => !e || hlcDeRegistre(r) > hlcEsborrat(e)

export function hlcEsborrat(e: RegistreEsborrat): Hlc {
  return e.hlc && llegirHlc(e.hlc) ? e.hlc : hlcDeData(e.esborratAt)
}

/** Dades xifrades d'un conflicte: els camps que no van guanyar */
export interface DadesConflicteCamp {
  camps: { camp: string; valor: unknown }[]
  versioAt: string
}

/**
 * El registre de conflicte d'un camp perdut. L'identificador depèn del
 * registre, del camp i de la versió que ha perdut: tots els dispositius creen
 * el mateix (no un per dispositiu), i un cop resolt (esborrat) no torna.
 */
export async function registreConflicte(
  clau: CryptoKey,
  taula: TaulaPerCamp,
  registre: Registre,
  perdut: CampPerdut,
): Promise<RegistreConflicte & { hlc: Hlc }> {
  const id = `${taula}:${String(registre.id)}:${perdut.camp}:${perdut.hlc}`
  const ms = llegirHlc(perdut.hlc)?.ms ?? 0
  const versioAt = new Date(ms).toISOString()
  const dades: DadesConflicteCamp = { camps: [{ camp: perdut.camp, valor: perdut.valor ?? '' }], versioAt }
  return {
    id,
    taula,
    registreId: String(registre.id),
    ...(registre.pacientId ? { pacientId: String(registre.pacientId) } : {}),
    creatAt: versioAt,
    modificatAt: versioAt,
    // La mateixa versió a tots els dispositius: la del camp perdut
    hlc: perdut.hlc,
    xifrat: await xifrarJson(clau, dades, context('conflictes', id)),
  }
}
