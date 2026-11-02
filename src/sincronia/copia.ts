// Còpia de les dades per pujar a Google Drive.
//
// - El fitxer porta en clar només els embolcalls de la clau mestra (que ja
//   van xifrats amb la contrasenya, l'empremta o la clau de recuperació): així
//   un dispositiu nou, amb la contrasenya, pot obrir la còpia.
// - Tota la resta (pacients, fitxes, cites, ajustos i fins i tot els ids i les
//   dates) va xifrada amb la clau mestra a través de src/crypto.
// - Dos dispositius es posen d'acord registre per registre: guanya el canvi
//   més nou, i un esborrat més nou que el registre l'esborra.

import { z } from 'zod'
import { desxifrarJson, xifrarJson, type ClauEmbolcallada, type DadesXifrades, type EmbolcallSecret } from '../crypto'
import type { QiDB, RegistreEsborrat, TaulaSincronitzada } from '../db/esquema'

const CONTEXT = 'qi:copia:v1'

interface DefinicioTaula {
  nom: TaulaSincronitzada
  /** Camp que és la clau del registre */
  clau: string
  /** Camp amb la data de l'últim canvi */
  data: string
  /**
   * Camp que la base de dades vol únic (índex &). Si dos dispositius creen,
   * sense haver sincronitzat, un registre per al mateix valor (la fitxa clínica
   * d'un pacient), sincronitzar() els fusiona camp a camp abans (fusioClinica.ts):
   * escriure'ls tots dos fallaria i la sincronia quedaria bloquejada.
   */
  unic?: string
}

export const TAULES: readonly DefinicioTaula[] = [
  { nom: 'pacients', clau: 'id', data: 'modificatAt' },
  { nom: 'fitxesCliniques', clau: 'id', data: 'modificatAt', unic: 'pacientId' },
  { nom: 'cites', clau: 'id', data: 'modificatAt' },
  { nom: 'calibratge', clau: 'id', data: 'modificatAt' },
  { nom: 'calibratgeOrella', clau: 'codi', data: 'modificatAt' },
  { nom: 'precaucions', clau: 'codi', data: 'confirmadaAt' },
  { nom: 'categoriesPrecaucio', clau: 'categoria', data: 'confirmadaAt' },
  { nom: 'configuracio', clau: 'clau', data: 'modificatAt' },
  { nom: 'diesTancats', clau: 'dia', data: 'modificatAt' },
  { nom: 'conflictes', clau: 'id', data: 'modificatAt' },
]

type Registre = Record<string, unknown>

/** El que va xifrat dins el fitxer */
export interface Contingut {
  versio: 1
  taules: Record<TaulaSincronitzada, Registre[]>
  esborrats: RegistreEsborrat[]
}

export interface Embolcalls {
  contrasenya: ClauEmbolcallada
  /** Quan es va posar la contrasenya (guanya la més nova) */
  contrasenyaAt: string
  secrets: EmbolcallSecret[]
}

/** El fitxer que es puja a Drive */
export interface FitxerCopia {
  format: 'qi-copia'
  versio: 1
  embolcalls: Embolcalls
  xifrat: DadesXifrades
}

export const esquemaFitxerCopia = z.object({
  format: z.literal('qi-copia'),
  versio: z.literal(1),
  embolcalls: z.object({
    contrasenya: z.object({}).passthrough(),
    contrasenyaAt: z.string(),
    secrets: z.array(z.object({}).passthrough()),
  }),
  xifrat: z.object({ iv: z.string(), dades: z.string() }),
})

const valor = (r: Registre, camp: string) => String(r[camp] ?? '')

export async function llegirContingut(db: QiDB): Promise<Contingut> {
  const taules = {} as Contingut['taules']
  for (const t of TAULES) {
    const registres = (await db.table(t.nom).toArray()) as Registre[]
    taules[t.nom] = registres.sort((a, b) => valor(a, t.clau).localeCompare(valor(b, t.clau)))
  }
  const esborrats = (await db.esborrats.toArray()).sort((a, b) => a.id.localeCompare(b.id))
  return { versio: 1, taules, esborrats }
}

/** Fusiona dues còpies: per a cada registre guanya el canvi més nou. És simètrica. */
export function fusionar(a: Contingut, b: Contingut): Contingut {
  const esborrats = new Map<string, RegistreEsborrat>()
  for (const e of [...a.esborrats, ...b.esborrats]) {
    const ja = esborrats.get(e.id)
    if (!ja || e.esborratAt > ja.esborratAt) esborrats.set(e.id, e)
  }
  const taules = {} as Contingut['taules']
  for (const t of TAULES) {
    const perClau = new Map<string, Registre>()
    for (const r of [...(a.taules[t.nom] ?? []), ...(b.taules[t.nom] ?? [])]) {
      const clau = valor(r, t.clau)
      const ja = perClau.get(clau)
      if (!ja || valor(r, t.data) > valor(ja, t.data)) perClau.set(clau, r)
    }
    const vius = [...perClau.entries()].filter(([clau, r]) => {
      const e = esborrats.get(`${t.nom}:${clau}`)
      return !e || e.esborratAt < valor(r, t.data)
    })
    taules[t.nom] = vius.sort(([x], [y]) => x.localeCompare(y)).map(([, r]) => r)
  }
  // Un esborrat ja no cal si el registre s'ha tornat a crear després
  return { versio: 1, taules, esborrats: [...esborrats.values()].sort((x, y) => x.id.localeCompare(y.id)) }
}

export function iguals(a: Contingut, b: Contingut): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Escriu el contingut fusionat a la base de dades local (substitueix les taules sincronitzades). */
export async function aplicarContingut(db: QiDB, c: Contingut): Promise<void> {
  await db.transaction('rw', [...TAULES.map((t) => t.nom), 'esborrats'], async () => {
    for (const t of TAULES) {
      const taula = db.table(t.nom)
      const registres = c.taules[t.nom] ?? []
      const noves = new Set(registres.map((r) => valor(r, t.clau)))
      const sobren = ((await taula.toCollection().primaryKeys()) as string[]).filter((k) => !noves.has(String(k)))
      await taula.bulkDelete(sobren)
      await taula.bulkPut(registres)
    }
    await db.esborrats.clear()
    await db.esborrats.bulkPut(c.esborrats)
  })
}

export async function xifrarCopia(clau: CryptoKey, contingut: Contingut, embolcalls: Embolcalls): Promise<FitxerCopia> {
  return { format: 'qi-copia', versio: 1, embolcalls, xifrat: await xifrarJson(clau, contingut, CONTEXT) }
}

/** La còpia és d'una versió de l'app més nova, amb un format que aquesta no entén */
export class ErrorCopiaVersio extends Error {
  constructor() {
    super('Còpia d\'una versió més nova de l\'app')
    this.name = 'ErrorCopiaVersio'
  }
}

/** La còpia no té el format esperat o no es pot desxifrar amb la clau correcta */
export class ErrorCopiaDanyada extends Error {
  constructor() {
    super('Còpia danyada')
    this.name = 'ErrorCopiaDanyada'
  }
}

export function llegirFitxer(text: string): FitxerCopia {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ErrorCopiaDanyada()
  }
  const r = esquemaFitxerCopia.safeParse(json)
  if (r.success) return r.data as unknown as FitxerCopia
  const v = json as { format?: unknown; versio?: unknown } | null
  if (v?.format === 'qi-copia' && typeof v.versio === 'number' && v.versio > 1) throw new ErrorCopiaVersio()
  throw new ErrorCopiaDanyada()
}

/**
 * Porta el contingut d'una còpia al format actual. Les còpies fetes per
 * versions anteriors no tenen les taules que s'han afegit després (l'orella,
 * l'horari, els dies tancats): són buides, no un error.
 */
export function migrarContingut(c: unknown): Contingut {
  if (typeof c !== 'object' || c === null) throw new ErrorCopiaDanyada()
  const { versio, taules, esborrats } = c as Partial<Record<keyof Contingut, unknown>>
  if (typeof versio === 'number' && versio > 1) throw new ErrorCopiaVersio()
  if (versio !== 1 || typeof taules !== 'object' || taules === null) throw new ErrorCopiaDanyada()
  if (esborrats !== undefined && !Array.isArray(esborrats)) throw new ErrorCopiaDanyada()
  const totes = {} as Contingut['taules']
  for (const t of TAULES) {
    const registres = (taules as Record<string, unknown>)[t.nom] ?? []
    if (!Array.isArray(registres)) throw new ErrorCopiaDanyada()
    totes[t.nom] = registres as Registre[]
  }
  return { versio: 1, taules: totes, esborrats: (esborrats ?? []) as RegistreEsborrat[] }
}

export async function desxifrarCopia(clau: CryptoKey, fitxer: FitxerCopia): Promise<Contingut> {
  let c: unknown
  try {
    c = await desxifrarJson(clau, fitxer.xifrat, CONTEXT)
  } catch {
    // La clau és la bona (s'ha obert amb la contrasenya): el contingut és el que falla
    throw new ErrorCopiaDanyada()
  }
  return migrarContingut(c)
}

/** Embolcalls: la contrasenya més nova i la unió de les altres maneres d'obrir. */
export function fusionarEmbolcalls(a: Embolcalls, b: Embolcalls): Embolcalls {
  const nova = b.contrasenyaAt > a.contrasenyaAt ? b : a
  const secrets = new Map<string, EmbolcallSecret>()
  for (const s of [...a.secrets, ...b.secrets]) secrets.set(s.id, s)
  // Només una clau de recuperació: la més nova (en fer-ne una de nova, l'antiga deixa de valer)
  const recuperacions = [...secrets.values()].filter((s) => s.tipus === 'recuperacio').sort((x, y) => y.creatAt.localeCompare(x.creatAt))
  for (const vella of recuperacions.slice(1)) secrets.delete(vella.id)
  return {
    contrasenya: nova.contrasenya,
    contrasenyaAt: nova.contrasenyaAt,
    secrets: [...secrets.values()].sort((x, y) => x.id.localeCompare(y.id)),
  }
}
