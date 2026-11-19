// Episodi: un problema de salut d'un pacient (p. ex. «Lumbàlgia»), amb les
// seves cites i sessions. La casella «Nou episodi» de la cita n'obre un de nou;
// les cites de seguiment s'enganxen a l'episodi actiu del pacient.

import { z } from 'zod'
import type { Registre } from './registre'

export const ESTATS_EPISODI = ['actiu', 'alta', 'milloraParcial', 'abandonament'] as const
export type EstatEpisodi = (typeof ESTATS_EPISODI)[number]

/** Freqüències del pla de tractament */
export const FREQUENCIES_PLA = ['dosSetmana', 'setmanal', 'quinzenal', 'mensual'] as const
/** Tècniques previstes del pla */
export const TECNIQUES_PLA = ['acupuntura', 'electroacupuntura', 'moxa', 'ventoses', 'auriculoterapia', 'guaSha', 'tuina', 'dietetica'] as const

/** Pla de tractament de l'episodi (etapa 3B) */
const objectePla = z.object({
  /** Sessions previstes (a la capçalera de la visita: «Sessió 4 de 10») */
  sessions: z.number().int().min(1).max(100).nullable(),
  frequencia: z.enum(FREQUENCIES_PLA).nullable(),
  objectius: z.string(),
  tecniques: z.array(z.enum(TECNIQUES_PLA)),
  /** Dia en què es revisa el pla */
  revisio: z.string().nullable(),
  /** La doctora ha posat la data de revisió a mà: ja no es recalcula sola */
  revisioManual: z.boolean(),
})
/** Els plans d'abans del càlcul automàtic: si tenien data, la doctora l'havia posada a mà */
export const esquemaPla = z.preprocess(
  (v) => (v && typeof v === 'object' && !('revisioManual' in v) ? { ...v, revisioManual: (v as { revisio?: unknown }).revisio != null } : v),
  objectePla,
)
export type Pla = z.infer<typeof objectePla>
export const PLA_BUIT: Pla = { sessions: null, frequencia: null, objectius: '', tecniques: [], revisio: null, revisioManual: false }

/**
 * Data de revisió calculada: les sessions previstes al ritme de la freqüència,
 * a partir del dia d'inici de l'episodi (setmanal × 8 = 8 setmanes; dues per
 * setmana × 8 = 4 setmanes; quinzenal × 8 = 16 setmanes; mensual × 8 = 8 mesos).
 * null si falta la freqüència o les sessions.
 */
export function revisioCalculada(pla: Pick<Pla, 'sessions' | 'frequencia'>, dataInici: string): string | null {
  if (!pla.sessions || !pla.frequencia || !/^\d{4}-\d{2}-\d{2}$/.test(dataInici)) return null
  const [a, m, d] = dataInici.split('-').map(Number) as [number, number, number]
  const data = new Date(Date.UTC(a, m - 1, d))
  if (pla.frequencia === 'mensual') {
    data.setUTCMonth(data.getUTCMonth() + pla.sessions)
    // 31 de gener + 1 mes: l'últim dia de febrer, no el 3 de març
    if (data.getUTCDate() !== d) data.setUTCDate(0)
  } else {
    const setmanes = pla.frequencia === 'dosSetmana' ? Math.ceil(pla.sessions / 2) : pla.frequencia === 'setmanal' ? pla.sessions : pla.sessions * 2
    data.setUTCDate(data.getUTCDate() + setmanes * 7)
  }
  return data.toISOString().slice(0, 10)
}

/**
 * Aplica un canvi al pla. Si la doctora posa la data a mà, ja no es recalcula
 * sola; si l'esborra, torna a ser automàtica. Si no s'ha posat a mà, es
 * recalcula (si falten dades, es manté la que hi havia).
 */
export function canviarPla(pla: Pla, canvis: Partial<Pla>, dataInici: string): Pla {
  const nou = { ...pla, ...canvis }
  if ('revisio' in canvis && canvis.revisio != null) return { ...nou, revisioManual: true }
  if ('revisio' in canvis) return { ...nou, revisioManual: false, revisio: revisioCalculada(nou, dataInici) }
  if (nou.revisioManual) return nou
  return { ...nou, revisio: revisioCalculada(nou, dataInici) ?? nou.revisio }
}

/** Primera lletra en majúscula (el motiu de l'episodi, en mostrar-lo i en desar-lo) */
export const ambMajuscula = (s: string): string => {
  const t = s.trim()
  return t ? t.charAt(0).toLocaleUpperCase('ca') + t.slice(1) : t
}

export const esquemaDadesEpisodi = z.object({
  motiu: z.string().trim().max(200).transform(ambMajuscula),
  /** Dia d'inici («2026-11-02») */
  dataInici: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estat: z.enum(ESTATS_EPISODI),
  dataFinal: z.string().nullable(),
  notaFinal: z.string().trim(),
  /** Els episodis d'abans de la 3B no en tenen */
  pla: esquemaPla.nullable().default(null),
})
export type DadesEpisodi = z.infer<typeof esquemaDadesEpisodi>

export type Episodi = Registre & { pacientId: string } & DadesEpisodi

/** L'episodi que obre una cita amb «Nou episodi» (o la primera cita d'un pacient): el mateix id a tots els dispositius */
export const idEpisodiDeCita = (citaId: string) => `episodi-${citaId}`

/** El nom que rep un episodi obert per una cita sense motiu (no és un motiu de veritat) */
export const MOTIU_PER_DEFECTE = 'Primera visita'

export function nouEpisodi(motiu: string, dataInici: string): DadesEpisodi {
  return { motiu: ambMajuscula(motiu) || MOTIU_PER_DEFECTE, dataInici, estat: 'actiu', dataFinal: null, notaFinal: '', pla: null }
}

/** L'episodi encara no té cap motiu de veritat (es va obrir amb una cita sense motiu) */
export const senseMotiu = (motiu: string) => !motiu.trim() || motiu.trim() === MOTIU_PER_DEFECTE

/**
 * Nom de l'episodi per mostrar: el seu motiu o, si no en té (abans es posava
 * «Primera visita», que és el tipus de la cita i no un motiu), el primer motiu
 * de les cites de l'episodi que en tingui.
 */
export function nomEpisodi(episodi: Pick<DadesEpisodi, 'motiu'>, motiusCites: readonly string[] = []): string {
  if (!senseMotiu(episodi.motiu)) return ambMajuscula(episodi.motiu)
  return ambMajuscula(motiusCites.map((m) => m.trim()).find((m) => !senseMotiu(m)) ?? '')
}

/** Els episodis actius d'un pacient, del més recent al més antic */
export function episodisActius<E extends Pick<Episodi, 'estat' | 'dataInici' | 'id'>>(episodis: readonly E[]): E[] {
  return episodis
    .filter((e) => e.estat === 'actiu')
    .sort((a, b) => b.dataInici.localeCompare(a.dataInici) || b.id.localeCompare(a.id))
}

export interface CitaPerEpisodi {
  id: string
  pacientId: string
  inici: string
  motiu: string
  nouEpisodi: boolean
  episodiId: string | null
}

/**
 * Migració (una sola vegada): per a cada pacient amb cites, un episodi amb el
 * motiu de la seva primera visita, i a partir de cada cita amb «Nou episodi»,
 * un altre. Torna els episodis que cal crear i l'episodi de cada cita que no en
 * tenia. Els ids depenen de la cita que obre l'episodi: si dos dispositius
 * migren alhora, creen els mateixos.
 */
export function migracioEpisodis(cites: readonly CitaPerEpisodi[]): {
  episodis: (DadesEpisodi & { id: string; pacientId: string })[]
  assignacions: { citaId: string; episodiId: string }[]
} {
  const perPacient = new Map<string, CitaPerEpisodi[]>()
  for (const c of cites) perPacient.set(c.pacientId, [...(perPacient.get(c.pacientId) ?? []), c])
  const episodis: (DadesEpisodi & { id: string; pacientId: string })[] = []
  const assignacions: { citaId: string; episodiId: string }[] = []
  for (const [pacientId, llista] of perPacient) {
    let actual: string | null = null
    for (const c of [...llista].sort((a, b) => a.inici.localeCompare(b.inici) || a.id.localeCompare(b.id))) {
      if (c.episodiId) {
        actual = c.episodiId
        continue
      }
      if (!actual || c.nouEpisodi) {
        actual = idEpisodiDeCita(c.id)
        episodis.push({ id: actual, pacientId, ...nouEpisodi(c.motiu, c.inici.slice(0, 10)) })
      }
      assignacions.push({ citaId: c.id, episodiId: actual })
    }
  }
  return { episodis, assignacions }
}
