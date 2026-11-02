// Agenda: horari de consulta, dies tancats i càlculs de la graella (quines
// hores es veuen, on se situa en obrir, minicalendari). Tot són funcions
// pures; l'horari i els dies tancats es desen a src/db/agenda.ts.

import { z } from 'zod'
import { aData, diaDe, fiDe, minutDelDia, sumarDies, type DadesCita } from './cita'

/** Dies de la setmana com Date.getDay(): 0 = diumenge … 6 = dissabte */
export const esquemaHorari = z
  .object({
    /** Minuts des de mitjanit */
    inici: z.number().int().min(0).max(24 * 60),
    fi: z.number().int().min(0).max(24 * 60),
    dies: z.array(z.number().int().min(0).max(6)),
  })
  .refine((h) => h.fi > h.inici, { path: ['fi'] })
export type Horari = z.infer<typeof esquemaHorari>

/** De 9:00 a 20:00, de dilluns a divendres */
export const HORARI_PER_DEFECTE: Horari = { inici: 9 * 60, fi: 20 * 60, dies: [1, 2, 3, 4, 5] }

/** Marge que es veu abans i després de l'horari */
export const MARGE_GRAELLA = 30

const QUART = 15

/** Rang de minuts de la graella: l'horari amb el marge, ampliat per encabir les cites que en surten */
export function rangGraella(
  horari: Horari,
  cites: readonly Pick<DadesCita, 'inici' | 'durada'>[],
): { inici: number; fi: number } {
  let inici = Math.max(0, horari.inici - MARGE_GRAELLA)
  let fi = Math.min(24 * 60, horari.fi + MARGE_GRAELLA)
  for (const c of cites) {
    const m = minutDelDia(c.inici)
    inici = Math.min(inici, Math.floor(m / 30) * 30)
    fi = Math.max(fi, Math.min(24 * 60, Math.ceil((m + c.durada) / 30) * 30))
  }
  return { inici, fi }
}

/**
 * Minut on se situa la graella en obrir-la: l'hora actual si avui es veu i
 * és dins l'horari; si no, la primera cita dels dies que es veuen; si no,
 * l'inici de l'horari.
 */
export function minutInicial(
  dies: readonly string[],
  ara: Date,
  horari: Horari,
  cites: readonly Pick<DadesCita, 'inici'>[],
): number {
  const avui = diaDe(ara)
  const minutAra = ara.getHours() * 60 + ara.getMinutes()
  if (dies.includes(avui) && minutAra >= horari.inici && minutAra < horari.fi) return minutAra
  const delsDies = cites.filter((c) => dies.includes(c.inici.slice(0, 10))).map((c) => minutDelDia(c.inici))
  return delsDies.length > 0 ? Math.min(...delsDies) : horari.inici
}

/** Hora (minuts) del tram de 15 minuts on s'ha tocat, dins la graella */
export function trancaDeQuart(minut: number, rang: { inici: number; fi: number }): number {
  const m = Math.floor(minut / QUART) * QUART
  return Math.min(rang.fi - QUART, Math.max(rang.inici, m))
}

export function esLaborable(dia: string, horari: Horari): boolean {
  return horari.dies.includes(aData(dia).getDay())
}

export type MotiuAvisCita = 'tancat' | 'noLaborable' | 'foraHorari'

/** Per què una cita cau fora de l'horari de consulta (l'app avisa però la deixa crear) */
export function avisHorari(
  cita: Pick<DadesCita, 'inici' | 'durada'>,
  horari: Horari,
  diesTancats: ReadonlySet<string>,
): MotiuAvisCita | null {
  const dia = cita.inici.slice(0, 10)
  if (diesTancats.has(dia)) return 'tancat'
  if (!esLaborable(dia, horari)) return 'noLaborable'
  const inici = minutDelDia(cita.inici)
  const fi = fiDe(cita).slice(0, 10) === dia ? minutDelDia(fiDe(cita)) : 24 * 60
  return inici < horari.inici || fi > horari.fi ? 'foraHorari' : null
}

export type VistaAgenda = 'dia' | 'setmana'

/** Setmana a l'ordinador i a la tauleta horitzontal; dia a la tauleta vertical (o pantalles estretes) */
export function vistaPerDefecte(amplada: number, alcada: number): VistaAgenda {
  return amplada < alcada || amplada < 720 ? 'dia' : 'setmana'
}

/** Les sis setmanes (de dilluns a diumenge) que es veuen al minicalendari del mes del dia */
export function diesMinicalendari(dia: string): string[] {
  const primer = `${dia.slice(0, 7)}-01`
  const dilluns = sumarDies(primer, -((aData(primer).getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => sumarDies(dilluns, i))
}

/** El mateix dia del mes anterior o següent (o l'últim, si no existeix) */
export function sumarMesos(dia: string, n: number): string {
  const d = aData(dia)
  const objectiu = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const ultim = new Date(objectiu.getFullYear(), objectiu.getMonth() + 1, 0).getDate()
  objectiu.setDate(Math.min(d.getDate(), ultim))
  return diaDe(objectiu)
}

export function hhmm(minuts: number): string {
  return `${String(Math.floor(minuts / 60)).padStart(2, '0')}:${String(minuts % 60).padStart(2, '0')}`
}

export function minutsDe(hhmmText: string): number {
  const [h, m] = hhmmText.split(':').map(Number)
  return h! * 60 + m!
}

/** Alçada mínima d'una hora a la graella (px): amb ratolí i amb els dits */
export const HORA_MINIMA = { ratoli: 48, dits: 56 } as const
/** Més enllà d'això, les hores no es fan més altes encara que sobri pantalla */
const HORA_MAXIMA = 120

/**
 * Alçada d'una hora perquè tota la graella càpiga a l'espai disponible sense
 * desplaçar-se; si no hi cap, el mínim (i la graella es desplaça).
 */
export function alcadaHora(espai: number, minuts: number, minima: number): number {
  const hores = minuts / 60
  return Math.min(HORA_MAXIMA, Math.max(minima, Math.floor(espai / hores)))
}

/**
 * On comença la vista quan cal desplaçar-se: una hora abans del minut de
 * referència (l'hora actual o la primera cita), en punt.
 */
export function iniciVista(minut: number, rang: { inici: number }): number {
  return Math.max(rang.inici, Math.floor(minut / 60) * 60 - 60)
}

export type ContingutTargeta =
  /** Hora d'inici i nom junts, en una o dues línies */
  | { tipus: 'curta'; linies: number }
  /** Nom (fins a dues línies), hora d'inici i, si hi cap, el motiu */
  | { tipus: 'completa'; liniesNom: number; motiu: boolean }

/**
 * Què es mostra en una targeta de la setmana segons l'alçada, perquè el text
 * no en sobresurti mai. Prioritat: nom, hora d'inici, motiu. Les cites de 40
 * minuts o menys, només l'hora i el nom.
 */
export function contingutTargeta(alcada: number, durada: number, alturaLinia: number, marge: number): ContingutTargeta {
  const linies = Math.max(1, Math.floor((alcada - marge) / alturaLinia))
  if (durada <= 40 || linies <= 1) return { tipus: 'curta', linies: Math.min(2, linies) }
  if (linies === 2) return { tipus: 'completa', liniesNom: 1, motiu: false }
  return { tipus: 'completa', liniesNom: 2, motiu: linies >= 4 }
}
