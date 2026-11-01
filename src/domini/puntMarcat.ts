// Punt marcat en una sessió. De moment (etapa 2d) només en memòria.

import { z } from 'zod'

export const TECNIQUES = ['agulla', 'moxa', 'ventosa', 'llavor', 'electro'] as const
export type Tecnica = (typeof TECNIQUES)[number]

/** Colors dels marcadors segons la tècnica (també a la llegenda) */
export const COLOR_TECNICA: Record<Tecnica, string> = {
  agulla: '#2f5d50',
  moxa: '#c2571a',
  ventosa: '#7b3fa0',
  llavor: '#a8840f',
  electro: '#1f63b5',
}

export const COSTATS_MARCAT = ['E', 'D', 'bilateral'] as const
export type CostatMarcat = (typeof COSTATS_MARCAT)[number]

export const METODES = ['tonificar', 'dispersar', 'neutre'] as const

export const esquemaPuntMarcat = z.object({
  codi: z.string().min(1),
  costat: z.enum(COSTATS_MARCAT),
  tecnica: z.enum(TECNIQUES),
  metode: z.enum(METODES),
  profunditat: z.string().trim(),
  temps: z.string().trim(),
  notes: z.string().trim(),
})

export type PuntMarcat = z.infer<typeof esquemaPuntMarcat>

export function nouPuntMarcat(codi: string, costat: CostatMarcat, tecnica: Tecnica): PuntMarcat {
  return { codi, costat, tecnica, metode: 'neutre', profunditat: '', temps: '', notes: '' }
}

/** Marca un punt; si ja hi era, n'actualitza el costat i la tècnica. */
export function marcar(llista: readonly PuntMarcat[], punt: PuntMarcat): PuntMarcat[] {
  const i = llista.findIndex((p) => p.codi === punt.codi)
  if (i === -1) return [...llista, punt]
  return llista.map((p, j) => (j === i ? { ...p, costat: punt.costat, tecnica: punt.tecnica } : p))
}

export function desmarcar(llista: readonly PuntMarcat[], codi: string): PuntMarcat[] {
  return llista.filter((p) => p.codi !== codi)
}

/**
 * Tècnica amb què s'ha de pintar el marcador d'un costat concret, o
 * undefined si aquest costat no està marcat. Els punts de la línia mitja
 * (costat C) es pinten sempre que el punt estigui marcat.
 */
export function tecnicaDelMarcador(
  llista: readonly PuntMarcat[],
  codi: string,
  costatMarcador: 'E' | 'D' | 'C',
): Tecnica | undefined {
  const p = llista.find((x) => x.codi === codi)
  if (!p) return undefined
  if (costatMarcador === 'C' || p.costat === 'bilateral' || p.costat === costatMarcador) return p.tecnica
  return undefined
}
