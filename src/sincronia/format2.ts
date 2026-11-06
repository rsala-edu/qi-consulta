// Format 2 de la còpia de Google Drive (docs/sincronia.md, 8.3): cada fitxer
// té un sol autor.
//
// - qi-dispositiu-<id>.json: el diari d'un dispositiu (només l'escriu ell).
// - qi-foto-<generació>-<id>.json: una foto sencera (no es modifica mai).
// - qi-copia-AAAA-MM-DD.json, qi-mensual-AAAA-MM.json: còpies diàries i
//   mensuals, en format de foto (no es modifiquen mai).
// - qi-dades.json: el fitxer del format 1. Després de migrar, és un avís per a
//   les versions antigues (les fa aturar amb «Actualitzar l'app»).
//
// En clar només hi ha la capçalera: format, versió mínima per escriure, hash
// de la clau, dispositiu, embolcalls de la clau mestra (tancats) i, segons el
// tipus, la cobertura o fins on ho ha vist tot. La resta va xifrada.

import { z } from 'zod'
import { desxifrarJson, ErrorDesxifratge, idClau, xifrarJson, type DadesXifrades } from '../crypto'
import type { RegistreEsborrat } from '../db/esquema'
import { ErrorClauDiferent, ErrorCopiaDanyada, ErrorCopiaVersio, type Embolcalls } from './copia'
import type { Hlc } from './hlc'
import type { Registre } from './registres'

export const VERSIO_FORMAT = 2

/**
 * Nivell d'aquesta versió de l'app. Una versió nova el puja quan canvia alguna
 * cosa que una de més antiga espatllaria en escriure. Cada fitxer porta la
 * versió mínima per escriure; si és més alta que aquest nivell, l'app només
 * llegeix (docs/sincronia.md, 8.5).
 */
export const NIVELL_APP = 2
/** La versió mínima per escriure que posa aquesta app als seus fitxers */
export const MINIMA_PER_ESCRIURE = 2

const CONTEXT_DIARI = 'qi:diari:v2'
const CONTEXT_FOTO = 'qi:foto:v2'

export const NOM_V1 = 'qi-dades.json'
export const nomDiari = (dispositiu: string) => `qi-dispositiu-${dispositiu}.json`
export const nomFoto = (generacio: number, dispositiu: string) => `qi-foto-${String(generacio).padStart(6, '0')}-${dispositiu}.json`
export const RE_DIARI = /^qi-dispositiu-([0-9a-z]+)\.json$/
export const RE_FOTO = /^qi-foto-(\d{6})-([0-9a-z]+)\.json$/
export const RE_DIARIA = /^qi-copia-(\d{4}-\d{2}-\d{2})\.json$/
export const RE_MENSUAL = /^qi-mensual-(\d{4}-\d{2})\.json$/
export const RE_DANYADA = /^qi-danyada-(\d{4}-\d{2}-\d{2})T.*\.json$/

/** Un registre (o la seva marca d'esborrat) dins un diari */
export interface EntradaDiari {
  taula: string
  clau: string
  /** seq del dispositiu en el moment del canvi */
  seq: number
  registre?: Registre
  esborrat?: RegistreEsborrat
}

/** El que va xifrat dins una foto: totes les taules (també les que l'app no coneix) */
export interface ContingutFoto {
  taules: Record<string, Registre[]>
  esborrats: RegistreEsborrat[]
}

interface Capcalera {
  format: 'qi-sinc'
  versio: number
  minimaPerEscriure: number
  dispositiu: string
  clauId: string
  embolcalls: Embolcalls
  creatAt: string
  xifrat: DadesXifrades
}

export interface FitxerDiari extends Capcalera {
  tipus: 'diari'
  /** Fins a quin HLC aquest dispositiu ho tenia tot vist en escriure el diari (per netejar esborrats) */
  vistFins: Hlc | null
  /** El seq més alt del diari */
  seqMax: number
}

export interface FitxerFoto extends Capcalera {
  tipus: 'foto'
  generacio: number
  /** Fins a quin seq del diari de cada dispositiu inclou */
  cobertura: Record<string, number>
}

export type Fitxer2 = FitxerDiari | FitxerFoto

const esquemaCapcalera = z.object({
  format: z.literal('qi-sinc'),
  versio: z.number(),
  minimaPerEscriure: z.number(),
  dispositiu: z.string(),
  clauId: z.string(),
  embolcalls: z.object({
    contrasenya: z.object({}).passthrough(),
    contrasenyaAt: z.string(),
    secrets: z.array(z.object({}).passthrough()),
  }),
  creatAt: z.string(),
  xifrat: z.object({ iv: z.string(), dades: z.string() }),
})
const esquemaFitxer2 = z.discriminatedUnion('tipus', [
  esquemaCapcalera.extend({ tipus: z.literal('diari'), vistFins: z.string().nullable(), seqMax: z.number() }).passthrough(),
  esquemaCapcalera.extend({ tipus: z.literal('foto'), generacio: z.number(), cobertura: z.record(z.string(), z.number()) }).passthrough(),
])

/** És un fitxer de format 2 (o més nou)? (sense validar-lo) */
export function esFormat2(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: unknown }).format === 'qi-sinc'
  } catch {
    return false
  }
}

export function llegirFitxer2(text: string): Fitxer2 {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ErrorCopiaDanyada()
  }
  const v = json as { format?: unknown; versio?: unknown } | null
  if (v?.format === 'qi-sinc' && typeof v.versio === 'number' && v.versio > VERSIO_FORMAT) throw new ErrorCopiaVersio()
  const r = esquemaFitxer2.safeParse(json)
  if (!r.success) throw new ErrorCopiaDanyada()
  return r.data as unknown as Fitxer2
}

async function desxifrar<T>(clau: CryptoKey, f: Fitxer2, context: string): Promise<T> {
  if (f.clauId !== (await idClau(clau))) throw new ErrorClauDiferent()
  try {
    return (await desxifrarJson(clau, f.xifrat, context)) as T
  } catch (e) {
    if (e instanceof ErrorDesxifratge) throw new ErrorCopiaDanyada()
    throw e
  }
}

export async function obrirDiari(clau: CryptoKey, f: FitxerDiari): Promise<EntradaDiari[]> {
  const entrades = await desxifrar<unknown>(clau, f, CONTEXT_DIARI)
  if (!Array.isArray(entrades)) throw new ErrorCopiaDanyada()
  return entrades as EntradaDiari[]
}

export async function obrirFoto(clau: CryptoKey, f: FitxerFoto): Promise<ContingutFoto> {
  const c = await desxifrar<ContingutFoto>(clau, f, CONTEXT_FOTO)
  if (typeof c !== 'object' || c === null || typeof c.taules !== 'object' || !Array.isArray(c.esborrats)) throw new ErrorCopiaDanyada()
  return c
}

interface DadesCapcalera {
  dispositiu: string
  embolcalls: Embolcalls
  ara?: Date
}

async function capcalera(clau: CryptoKey, d: DadesCapcalera) {
  return {
    format: 'qi-sinc' as const,
    versio: VERSIO_FORMAT,
    minimaPerEscriure: MINIMA_PER_ESCRIURE,
    dispositiu: d.dispositiu,
    clauId: await idClau(clau),
    embolcalls: d.embolcalls,
    creatAt: (d.ara ?? new Date()).toISOString(),
  }
}

export async function xifrarDiari(
  clau: CryptoKey,
  d: DadesCapcalera & { vistFins: Hlc | null },
  entrades: EntradaDiari[],
): Promise<FitxerDiari> {
  return {
    ...(await capcalera(clau, d)),
    tipus: 'diari',
    vistFins: d.vistFins,
    seqMax: entrades.reduce((m, e) => Math.max(m, e.seq), 0),
    xifrat: await xifrarJson(clau, entrades, CONTEXT_DIARI),
  }
}

export async function xifrarFoto(
  clau: CryptoKey,
  d: DadesCapcalera & { generacio: number; cobertura: Record<string, number> },
  contingut: ContingutFoto,
): Promise<FitxerFoto> {
  return {
    ...(await capcalera(clau, d)),
    tipus: 'foto',
    generacio: d.generacio,
    cobertura: d.cobertura,
    xifrat: await xifrarJson(clau, contingut, CONTEXT_FOTO),
  }
}

/**
 * El que queda a qi-dades.json després de migrar: un fitxer de format 1 amb
 * un número de versió més alt, perquè les versions antigues de l'app hi vegin
 * «Actualitzar l'app» (DRV-V) i no hi escriguin.
 */
export const AVIS_V1 = JSON.stringify({
  format: 'qi-copia',
  versio: 2,
  nota: 'Format 1 substituït pel format 2 (qi-foto-*, qi-dispositiu-*). Cal una versió nova de Qi.',
})

export function esAvisV1(text: string): boolean {
  try {
    const j = JSON.parse(text) as { format?: unknown; versio?: unknown; xifrat?: unknown }
    return j.format === 'qi-copia' && j.versio === 2 && j.xifrat === undefined
  } catch {
    return false
  }
}
