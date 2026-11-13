// Ajuntar dues fitxes de la mateixa persona (part 2).
//
// La comparació va camp a camp, amb les dades del pacient i les de la fitxa
// clínica:
// - Iguals (o buits a totes dues): surten una sola vegada, sense res a triar.
// - Només en una fitxa: es queda el que hi ha (un text no es perd mai).
// - Diferents: la doctora tria; per defecte, el de la fitxa modificada més
//   recentment.
// Les contraindicacions marcades en una de les dues fitxes es queden marcades
// (com en la fusió de dos dispositius: per seguretat, el «sí» guanya).

import { z } from 'zod'
import type { DadesFitxaClinica } from './fitxaClinica'
import { fitxaClinicaBuida } from './fitxaClinica'
import type { DadesPacient } from './pacient'
import { esquemaDadesCita, type Cita } from './cita'

/** Dies durant els quals es pot desfer un ajuntament */
export const DIES_DESFER = 30

export type Costat = 'queda' | 'treu'
export type EstatCamp = 'igual' | 'nomesQueda' | 'nomesTreu' | 'diferent'

export interface CampComparat {
  grup: 'pacient' | 'fitxa'
  /** El nom del camp (els de la fitxa, amb punts: «habits.son») */
  camp: string
  queda: string | boolean
  treu: string | boolean
  estat: EstatCamp
  /** Quin valor es queda si la doctora no tria res */
  perDefecte: Costat
}

const CAMPS_PACIENT = [
  'nom',
  'llinatges',
  'dataNaixement',
  'sexe',
  'telefon',
  'correu',
  'adreca',
  'professio',
  'comEnsHaConegut',
] as const satisfies readonly (keyof DadesPacient)[]

/** Els camps de la fitxa clínica, aplanats («contraindicacions.embaras») */
function aplanarFitxa(f: DadesFitxaClinica): Record<string, string | boolean> {
  const sortida: Record<string, string | boolean> = {}
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'object' && v !== null) for (const [k2, v2] of Object.entries(v)) sortida[`${k}.${k2}`] = v2 as string | boolean
    else sortida[k] = v as string | boolean
  }
  return sortida
}

function desplegarFitxa(pla: Record<string, string | boolean>): DadesFitxaClinica {
  const f = fitxaClinicaBuida() as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(pla)) {
    const [a, b] = k.split('.')
    if (b) (f[a!] as Record<string, unknown>)[b] = v
    else f[a!] = v
  }
  return f as unknown as DadesFitxaClinica
}

const buit = (v: string | boolean) => v === '' || v === false

function comparar(
  grup: CampComparat['grup'],
  camps: readonly string[],
  queda: Record<string, string | boolean>,
  treu: Record<string, string | boolean>,
  mesRecent: Costat,
): CampComparat[] {
  return camps.map((camp) => {
    const a = queda[camp] ?? ''
    const b = treu[camp] ?? ''
    const estat: EstatCamp =
      a === b ? 'igual' : buit(b) ? 'nomesQueda' : buit(a) ? 'nomesTreu' : typeof a === 'boolean' ? 'nomesQueda' : 'diferent'
    const perDefecte: Costat = estat === 'nomesTreu' ? 'treu' : estat === 'diferent' ? mesRecent : 'queda'
    return { grup, camp, queda: a, treu: b, estat, perDefecte }
  })
}

export interface FitxaPerAjuntar {
  pacient: DadesPacient
  /** null: no té fitxa clínica */
  fitxa: DadesFitxaClinica | null
  /** Última modificació del pacient i de la fitxa clínica (per triar el més recent) */
  pacientModificatAt: string
  fitxaModificatAt: string | null
}

export function compararFitxes(queda: FitxaPerAjuntar, treu: FitxaPerAjuntar): CampComparat[] {
  const recent = (a: string | null, b: string | null): Costat => ((b ?? '') > (a ?? '') ? 'treu' : 'queda')
  const fq = aplanarFitxa(queda.fitxa ?? fitxaClinicaBuida())
  const ft = aplanarFitxa(treu.fitxa ?? fitxaClinicaBuida())
  return [
    ...comparar('pacient', CAMPS_PACIENT, queda.pacient, treu.pacient, recent(queda.pacientModificatAt, treu.pacientModificatAt)),
    ...comparar('fitxa', Object.keys(fq), fq, ft, recent(queda.fitxaModificatAt, treu.fitxaModificatAt)),
  ]
}

/** Les dades que queden amb les tries de la doctora (camp → costat; sense tria, el per defecte) */
export function dadesAjuntades(
  camps: readonly CampComparat[],
  tries: Readonly<Record<string, Costat>>,
): { pacient: DadesPacient; fitxa: DadesFitxaClinica } {
  const valor = (c: CampComparat) => {
    if (typeof c.queda === 'boolean' || typeof c.treu === 'boolean') return c.queda === true || c.treu === true
    return c[c.estat === 'diferent' ? (tries[`${c.grup}:${c.camp}`] ?? c.perDefecte) : c.perDefecte]
  }
  const pacient = Object.fromEntries(camps.filter((c) => c.grup === 'pacient').map((c) => [c.camp, valor(c)])) as DadesPacient
  const fitxa = desplegarFitxa(Object.fromEntries(camps.filter((c) => c.grup === 'fitxa').map((c) => [c.camp, valor(c)])))
  return { pacient, fitxa }
}

/** Dues cites són la mateixa si són el mateix dia, a la mateixa hora i duren el mateix */
export function citesRepetides<C extends Pick<Cita, 'id' | 'inici' | 'durada' | 'sessioId'>>(
  queden: readonly C[],
  venen: readonly C[],
): { treure: C; mantenir: C }[] {
  const parells: { treure: C; mantenir: C }[] = []
  const usades = new Set<string>()
  for (const v of venen) {
    const q = queden.find((x) => !usades.has(x.id) && x.inici === v.inici && x.durada === v.durada)
    if (!q) continue
    // Si totes dues tenen visita feta, no se'n treu cap (hi ha dades clíniques a totes dues)
    if (q.sessioId && v.sessioId) continue
    usades.add(q.id)
    // Es queda la que té la visita; si cap no en té, la de la fitxa que queda
    parells.push(v.sessioId ? { treure: q, mantenir: v } : { treure: v, mantenir: q })
  }
  return parells
}

// --- El que es desa a la fitxa que es treu (xifrat, sincronitzat) ---------

const esquemaCitaTreta = z.object({ id: z.string(), pacientId: z.string(), dades: esquemaDadesCita })

/** Tot el que cal per desfer l'ajuntament (dins el registre xifrat del pacient que es treu) */
export const esquemaAjuntament = z.object({
  /** El pacient que es queda */
  pacientId: z.string(),
  at: z.string(),
  /** Si s'ha desfet, quan */
  desfetAt: z.string().nullable(),
  /** Registres que han passat a l'altre pacient (també els que han arribat després d'un altre dispositiu) */
  moguts: z.object({
    cites: z.array(z.string()),
    episodis: z.array(z.string()),
    sessions: z.array(z.string()),
    addendes: z.array(z.string()),
    valoracions: z.array(z.string()).default([]),
    consentiments: z.array(z.string()).default([]),
    fotos: z.array(z.string()).default([]),
  }),
  /** Cites repetides que es van treure (per tornar-les a posar si es desfà) */
  citesTretes: z.array(esquemaCitaTreta),
  /** Les dades del pacient que es queda i la seva fitxa clínica, abans i després d'ajuntar */
  abans: z.object({ pacient: z.record(z.string(), z.unknown()), fitxa: z.record(z.string(), z.unknown()).nullable() }),
  despres: z.object({ pacient: z.record(z.string(), z.unknown()), fitxa: z.record(z.string(), z.unknown()) }),
  /** Els avisos de possible duplicat que tenien totes dues fitxes */
  duplicatsAbans: z.object({ queda: z.array(z.string()), treu: z.array(z.string()) }),
})
export type Ajuntament = z.infer<typeof esquemaAjuntament>

export function esPotDesfer(a: Pick<Ajuntament, 'at' | 'desfetAt'>, ara: number): boolean {
  return a.desfetAt === null && ara - Date.parse(a.at) < DIES_DESFER * 24 * 3600 * 1000
}

/**
 * En desfer, cada camp torna al valor d'abans, excepte si s'ha tornat a
 * editar després d'ajuntar (llavors es queda l'edició).
 */
export function valorsDesfets<T extends Record<string, unknown>>(actual: T, abans: Record<string, unknown>, despres: Record<string, unknown>): T {
  const sortida: Record<string, unknown> = { ...actual }
  for (const k of Object.keys(abans)) {
    if (JSON.stringify(actual[k]) === JSON.stringify(despres[k])) sortida[k] = abans[k]
  }
  return sortida as T
}
