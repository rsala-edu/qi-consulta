// Episodi: un problema de salut d'un pacient (p. ex. «Lumbàlgia»), amb les
// seves cites i sessions. La casella «Nou episodi» de la cita n'obre un de nou;
// les cites de seguiment s'enganxen a l'episodi actiu del pacient.

import { z } from 'zod'
import type { Registre } from './registre'

export const ESTATS_EPISODI = ['actiu', 'alta', 'milloraParcial', 'abandonament'] as const
export type EstatEpisodi = (typeof ESTATS_EPISODI)[number]

export const esquemaDadesEpisodi = z.object({
  motiu: z.string().trim().max(200),
  /** Dia d'inici («2026-11-02») */
  dataInici: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estat: z.enum(ESTATS_EPISODI),
  dataFinal: z.string().nullable(),
  notaFinal: z.string().trim(),
})
export type DadesEpisodi = z.infer<typeof esquemaDadesEpisodi>

export type Episodi = Registre & { pacientId: string } & DadesEpisodi

/** L'episodi que obre una cita amb «Nou episodi» (o la primera cita d'un pacient): el mateix id a tots els dispositius */
export const idEpisodiDeCita = (citaId: string) => `episodi-${citaId}`

export function nouEpisodi(motiu: string, dataInici: string): DadesEpisodi {
  return { motiu: motiu.trim() || 'Primera visita', dataInici, estat: 'actiu', dataFinal: null, notaFinal: '' }
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
