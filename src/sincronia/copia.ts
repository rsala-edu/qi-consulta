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
}

export const TAULES: readonly DefinicioTaula[] = [
  { nom: 'pacients', clau: 'id', data: 'modificatAt' },
  { nom: 'fitxesCliniques', clau: 'id', data: 'modificatAt' },
  { nom: 'cites', clau: 'id', data: 'modificatAt' },
  { nom: 'calibratge', clau: 'id', data: 'modificatAt' },
  { nom: 'calibratgeOrella', clau: 'codi', data: 'modificatAt' },
  { nom: 'precaucions', clau: 'codi', data: 'confirmadaAt' },
  { nom: 'categoriesPrecaucio', clau: 'categoria', data: 'confirmadaAt' },
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
    taules[t.nom] = [...perClau.entries()]
      .filter(([clau, r]) => {
        const e = esborrats.get(`${t.nom}:${clau}`)
        return !e || e.esborratAt < valor(r, t.data)
      })
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([, r]) => r)
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
      const noves = new Set(c.taules[t.nom].map((r) => valor(r, t.clau)))
      const sobren = ((await taula.toCollection().primaryKeys()) as string[]).filter((k) => !noves.has(String(k)))
      await taula.bulkDelete(sobren)
      await taula.bulkPut(c.taules[t.nom])
    }
    await db.esborrats.clear()
    await db.esborrats.bulkPut(c.esborrats)
  })
}

export async function xifrarCopia(clau: CryptoKey, contingut: Contingut, embolcalls: Embolcalls): Promise<FitxerCopia> {
  return { format: 'qi-copia', versio: 1, embolcalls, xifrat: await xifrarJson(clau, contingut, CONTEXT) }
}

export function llegirFitxer(text: string): FitxerCopia {
  return esquemaFitxerCopia.parse(JSON.parse(text)) as unknown as FitxerCopia
}

export async function desxifrarCopia(clau: CryptoKey, fitxer: FitxerCopia): Promise<Contingut> {
  const c = (await desxifrarJson(clau, fitxer.xifrat, CONTEXT)) as Contingut
  if (c.versio !== 1) throw new Error('Versió de còpia desconeguda')
  return c
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
