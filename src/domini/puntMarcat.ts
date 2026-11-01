// Punt marcat en una sessió. De moment (etapa 2d) només en memòria. Els punts
// del cos i els de l'orella van a la mateixa llista (`mapa` diu de quin és),
// perquè a l'etapa 3 surtin junts a la sessió i a l'historial.

import { z } from 'zod'

/** Mapes on es marquen punts: el cos 3D i l'orella (auriculoteràpia) */
export const MAPES = ['cos', 'orella'] as const
export type Mapa = (typeof MAPES)[number]

export const TECNIQUES = ['agulla', 'moxa', 'ventosa', 'llavor', 'electro', 'xinxeta'] as const
export type Tecnica = (typeof TECNIQUES)[number]

/** Tècniques que es poden triar a cada mapa */
export const TECNIQUES_DEL_MAPA: Record<Mapa, readonly Tecnica[]> = {
  cos: ['agulla', 'moxa', 'ventosa', 'llavor', 'electro'],
  orella: ['agulla', 'llavor', 'xinxeta', 'electro'],
}

/** Colors dels marcadors segons la tècnica (també a la llegenda) */
export const COLOR_TECNICA: Record<Tecnica, string> = {
  agulla: '#2f5d50',
  moxa: '#c2571a',
  ventosa: '#7b3fa0',
  llavor: '#a8840f',
  electro: '#1f63b5',
  xinxeta: '#a3366f',
}

export const COSTATS_MARCAT = ['E', 'D', 'bilateral'] as const
export type CostatMarcat = (typeof COSTATS_MARCAT)[number]

export const METODES = ['tonificar', 'dispersar', 'neutre'] as const

export const esquemaPuntMarcat = z
  .object({
    /** Els registres d'abans de l'orella no el porten: són del cos */
    mapa: z.enum(MAPES).default('cos'),
    codi: z.string().min(1),
    costat: z.enum(COSTATS_MARCAT),
    tecnica: z.enum(TECNIQUES),
    metode: z.enum(METODES),
    profunditat: z.string().trim(),
    temps: z.string().trim(),
    notes: z.string().trim(),
  })
  .refine((p) => TECNIQUES_DEL_MAPA[p.mapa].includes(p.tecnica), {
    message: 'Aquesta tècnica no es fa servir en aquest mapa',
    path: ['tecnica'],
  })

export type PuntMarcat = z.infer<typeof esquemaPuntMarcat>

export function nouPuntMarcat(codi: string, costat: CostatMarcat, tecnica: Tecnica, mapa: Mapa = 'cos'): PuntMarcat {
  return { mapa, codi, costat, tecnica, metode: 'neutre', profunditat: '', temps: '', notes: '' }
}

const mateix = (p: PuntMarcat, codi: string, mapa: Mapa) => p.codi === codi && p.mapa === mapa

/** Marca un punt; si ja hi era (al mateix mapa), n'actualitza el costat i la tècnica. */
export function marcar(llista: readonly PuntMarcat[], punt: PuntMarcat): PuntMarcat[] {
  const i = llista.findIndex((p) => mateix(p, punt.codi, punt.mapa))
  if (i === -1) return [...llista, punt]
  return llista.map((p, j) => (j === i ? { ...p, costat: punt.costat, tecnica: punt.tecnica } : p))
}

export function desmarcar(llista: readonly PuntMarcat[], codi: string, mapa: Mapa = 'cos'): PuntMarcat[] {
  return llista.filter((p) => !mateix(p, codi, mapa))
}

export function puntMarcat(llista: readonly PuntMarcat[], codi: string, mapa: Mapa = 'cos'): PuntMarcat | undefined {
  return llista.find((p) => mateix(p, codi, mapa))
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
  mapa: Mapa = 'cos',
): Tecnica | undefined {
  const p = puntMarcat(llista, codi, mapa)
  if (!p) return undefined
  if (costatMarcador === 'C' || p.costat === 'bilateral' || p.costat === costatMarcador) return p.tecnica
  return undefined
}
