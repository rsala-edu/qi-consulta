// Cites de l'agenda. Cada cita va lligada a un pacient i, quan es fa la
// visita, a la seva sessió clínica (`sessioId`).
//
// Les hores són locals, sense zona horària («2026-11-02T10:15»): l'agenda és
// la de la consulta, i així una cita no es mou si el dispositiu canvia d'hora.

import { z } from 'zod'
import { t } from '../i18n/t'
import type { Registre } from './registre'

export const TIPUS_CITA = ['primera', 'seguiment'] as const
export type TipusCita = (typeof TIPUS_CITA)[number]

/** Programada → Feta (crea la sessió), Anul·lada o No presentat. */
export const ESTATS_CITA = ['programada', 'feta', 'anullada', 'noPresentat'] as const
export type EstatCita = (typeof ESTATS_CITA)[number]

/** 60 minuts la primera visita i 40 el seguiment */
export const DURADA_PER_DEFECTE: Record<TipusCita, number> = { primera: 60, seguiment: 40 }

/** Mida de les franges de l'agenda (minuts) */
export const FRANJA = 15

const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DIA = /^\d{4}-\d{2}-\d{2}$/

export const esquemaDadesCita = z.object({
  pacientId: z.string().min(1, t.errors.pacientObligatori),
  inici: z.string().regex(DATA_HORA, t.errors.dataInvalida),
  durada: z.number(t.errors.duradaInvalida).int(t.errors.duradaInvalida).min(5, t.errors.duradaInvalida).max(480, t.errors.duradaInvalida),
  tipus: z.enum(TIPUS_CITA),
  estat: z.enum(ESTATS_CITA),
  motiu: z.string().trim().max(200),
  notes: z.string().trim(),
  /** La sessió clínica que s'hi va fer (quan n'hi ha) */
  sessioId: z.string().nullable(),
})
export type DadesCita = z.infer<typeof esquemaDadesCita>

/** El que es xifra: tot menys el pacient i l'hora d'inici, que van en clar per poder-hi cercar. */
export const esquemaCitaGuardada = esquemaDadesCita.omit({ pacientId: true, inici: true })
export type CitaGuardada = z.infer<typeof esquemaCitaGuardada>

export type Cita = Registre & DadesCita

export function novaCita(pacientId: string, inici: string, tipus: TipusCita = 'seguiment'): DadesCita {
  return { pacientId, inici, durada: DURADA_PER_DEFECTE[tipus], tipus, estat: 'programada', motiu: '', notes: '', sessioId: null }
}

// --- Dates locals ---------------------------------------------------------

const dos = (n: number) => String(n).padStart(2, '0')

export function aData(diaHora: string): Date {
  const [d, h = '00:00'] = diaHora.split('T')
  const [any, mes, dia] = d!.split('-').map(Number)
  const [hora, minut] = h.split(':').map(Number)
  return new Date(any!, mes! - 1, dia!, hora!, minut!)
}

export function diaHoraDe(d: Date): string {
  return `${diaDe(d)}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

export function diaDe(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

export function esDia(v: string): boolean {
  return DIA.test(v)
}

export function sumarDies(dia: string, n: number): string {
  const d = aData(dia)
  d.setDate(d.getDate() + n)
  return diaDe(d)
}

export function sumarMinuts(diaHora: string, n: number): string {
  const d = aData(diaHora)
  d.setMinutes(d.getMinutes() + n)
  return diaHoraDe(d)
}

/** Dilluns de la setmana del dia */
export function dillunsDe(dia: string): string {
  const d = aData(dia)
  return sumarDies(dia, -((d.getDay() + 6) % 7))
}

/** Els set dies (de dilluns a diumenge) de la setmana del dia */
export function setmanaDe(dia: string): string[] {
  const dilluns = dillunsDe(dia)
  return Array.from({ length: 7 }, (_, i) => sumarDies(dilluns, i))
}

/** Minuts des de mitjanit */
export function minutDelDia(diaHora: string): number {
  const [h, m] = diaHora.slice(11, 16).split(':').map(Number)
  return h! * 60 + m!
}

export function fiDe(c: Pick<DadesCita, 'inici' | 'durada'>): string {
  return sumarMinuts(c.inici, c.durada)
}

// --- Solapaments ----------------------------------------------------------

/** Les cites anul·lades o no presentades ja no ocupen l'hora. */
export function ocupaHora(c: Pick<DadesCita, 'estat'>): boolean {
  return c.estat === 'programada' || c.estat === 'feta'
}

type Interval = Pick<DadesCita, 'inici' | 'durada' | 'estat'> & { id?: string }

/** Cites que se solapen amb `cita` (sense comptar-la a ella mateixa). */
export function solapaments<C extends Interval>(cita: Interval, altres: readonly C[]): C[] {
  if (!ocupaHora(cita)) return []
  const fi = fiDe(cita)
  return altres.filter(
    (a) => (cita.id === undefined || a.id !== cita.id) && ocupaHora(a) && a.inici < fi && cita.inici < fiDe(a),
  )
}

/**
 * Columnes per dibuixar un dia: les cites que se solapen van una al costat
 * de l'altra. Torna, per a cada cita, la seva columna i quantes n'hi ha al
 * grup de cites que s'encavalquen.
 */
export function columnesDelDia<C extends Interval & { id: string }>(
  cites: readonly C[],
): Map<string, { columna: number; columnes: number }> {
  const ordenades = [...cites].sort((a, b) => a.inici.localeCompare(b.inici) || b.durada - a.durada)
  const resultat = new Map<string, { columna: number; columnes: number }>()
  let grup: C[] = []
  let fiGrup = ''
  let finsColumna: string[] = []
  const tancar = () => {
    const n = finsColumna.length
    for (const c of grup) resultat.get(c.id)!.columnes = n
    grup = []
    finsColumna = []
  }
  for (const c of ordenades) {
    if (grup.length > 0 && c.inici >= fiGrup) tancar()
    let columna = finsColumna.findIndex((fi) => fi <= c.inici)
    if (columna === -1) {
      columna = finsColumna.length
      finsColumna.push('')
    }
    finsColumna[columna] = fiDe(c)
    resultat.set(c.id, { columna, columnes: 1 })
    grup.push(c)
    if (grup.length === 1 || fiDe(c) > fiGrup) fiGrup = fiDe(c)
  }
  tancar()
  return resultat
}

// --- Historial del pacient ------------------------------------------------

export interface RecompteCites {
  fetes: number
  anullades: number
  noPresentat: number
  programades: number
}

export function recompteCites(cites: readonly Pick<DadesCita, 'estat'>[]): RecompteCites {
  const r: RecompteCites = { fetes: 0, anullades: 0, noPresentat: 0, programades: 0 }
  for (const c of cites) {
    if (c.estat === 'feta') r.fetes++
    else if (c.estat === 'anullada') r.anullades++
    else if (c.estat === 'noPresentat') r.noPresentat++
    else r.programades++
  }
  return r
}

/** La primera cita programada a partir d'ara */
export function properaCita<C extends Pick<DadesCita, 'inici' | 'estat'>>(cites: readonly C[], ara: string): C | undefined {
  return [...cites].filter((c) => c.estat === 'programada' && c.inici >= ara).sort((a, b) => a.inici.localeCompare(b.inici))[0]
}

// --- Primera visita i seguiment ---------------------------------------------

export type ErrorSeguiment = 'sensePrimera' | 'anteriorAPrimera'

/** La primera visita del pacient: la més antiga de tipus «primera» que no s'ha anul·lat. */
export function primeraVisita<C extends Pick<Cita, 'id' | 'pacientId' | 'inici' | 'tipus' | 'estat'>>(
  pacientId: string,
  cites: readonly C[],
  excepte?: string,
): C | undefined {
  return cites
    .filter((c) => c.pacientId === pacientId && c.id !== excepte && c.tipus === 'primera' && ocupaHora(c))
    .sort((a, b) => a.inici.localeCompare(b.inici))[0]
}

/**
 * Una cita de seguiment ha de ser posterior a la primera visita del pacient.
 * Torna el motiu si no ho és (encara no en té cap, o és anterior). Les
 * cites anul·lades o no presentades no es comproven.
 */
export function errorSeguiment(
  cita: Pick<DadesCita, 'pacientId' | 'inici' | 'tipus'> & { id?: string; estat?: EstatCita },
  cites: readonly Pick<Cita, 'id' | 'pacientId' | 'inici' | 'tipus' | 'estat'>[],
): ErrorSeguiment | null {
  // Una cita anul·lada o no presentada ja no es fa: no cal comprovar-la
  if (cita.tipus !== 'seguiment' || cita.pacientId === '' || (cita.estat && !ocupaHora({ estat: cita.estat }))) return null
  const primera = primeraVisita(cita.pacientId, cites, cita.id)
  if (!primera) return 'sensePrimera'
  return cita.inici > primera.inici ? null : 'anteriorAPrimera'
}

/** Historial: primer les pròximes (de la més propera a la més llunyana), després les passades (de la més recent a la més antiga). */
export function ordenarHistorial<C extends Pick<DadesCita, 'inici'>>(cites: readonly C[], ara: string): C[] {
  const properes = cites.filter((c) => c.inici >= ara).sort((a, b) => a.inici.localeCompare(b.inici))
  const passades = cites.filter((c) => c.inici < ara).sort((a, b) => b.inici.localeCompare(a.inici))
  return [...properes, ...passades]
}
