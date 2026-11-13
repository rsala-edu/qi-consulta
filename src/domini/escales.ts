// Escales de resultats (etapa 3B): THI (acúfens), DHI (vertigen), SNOT-22 (nas
// i sins) i MYMOP. El text dels ítems NO és a l'app (vegeu docs/especificacions.md,
// «Llicències»): la doctora fa servir el qüestionari amb llicència i aquí
// s'apunten les respostes de cada ítem (o només el total) i es calcula el
// total i el grau de gravetat.

import { z } from 'zod'

export type IdEscala = 'thi' | 'dhi' | 'snot22'

export interface DefinicioEscala {
  id: IdEscala
  nom: string
  /** Nombre d'ítems */
  items: number
  /** Valors possibles de cada resposta */
  respostes: readonly number[]
  maxim: number
  /** Graus: [puntuació mínima, nom] (de menys a més) */
  graus: readonly (readonly [number, string])[]
  referencia: string
}

export const ESCALES: Record<IdEscala, DefinicioEscala> = {
  thi: {
    id: 'thi',
    nom: 'THI · Tinnitus Handicap Inventory',
    items: 25,
    // No = 0, A vegades = 2, Sí = 4
    respostes: [0, 2, 4],
    maxim: 100,
    graus: [
      [0, 'Grau 1 · molt lleu'],
      [18, 'Grau 2 · lleu'],
      [38, 'Grau 3 · moderat'],
      [58, 'Grau 4 · greu'],
      [78, 'Grau 5 · catastròfic'],
    ],
    referencia: 'Newman, Jacobson i Spitzer (1996); graus de McCombe et al. (2001)',
  },
  dhi: {
    id: 'dhi',
    nom: 'DHI · Dizziness Handicap Inventory',
    items: 25,
    respostes: [0, 2, 4],
    maxim: 100,
    graus: [
      [0, 'Lleu'],
      [31, 'Moderat'],
      [61, 'Greu'],
    ],
    referencia: 'Jacobson i Newman (1990); graus de Jacobson i Calder (1998)',
  },
  snot22: {
    id: 'snot22',
    nom: 'SNOT-22 · Sino-Nasal Outcome Test',
    items: 22,
    respostes: [0, 1, 2, 3, 4, 5],
    maxim: 110,
    graus: [
      [0, 'Sense símptomes rellevants'],
      [8, 'Lleu'],
      [21, 'Moderat'],
      [51, 'Greu'],
    ],
    referencia: 'Hopkins et al. (2009); graus de Toma i Hopkins (2016)',
  },
}

/** Resultat d'una escala: les respostes per ítem (opcional) i el total */
export const esquemaResultatEscala = z.object({
  /** «1» → valor (només si s'han apuntat les respostes una per una) */
  respostes: z.record(z.string(), z.number()).optional(),
  total: z.number().nullable(),
})
export type ResultatEscala = z.infer<typeof esquemaResultatEscala>

/** Suma de les respostes; null si no n'hi ha cap */
export function totalEscala(e: DefinicioEscala, respostes: Readonly<Record<string, number>>): number | null {
  const valors = Object.entries(respostes)
    .filter(([k, v]) => Number(k) >= 1 && Number(k) <= e.items && e.respostes.includes(v))
    .map(([, v]) => v)
  return valors.length === 0 ? null : valors.reduce((a, b) => a + b, 0)
}

/** Quantes respostes falten per tenir el qüestionari complet */
export function respostesQueFalten(e: DefinicioEscala, respostes: Readonly<Record<string, number>>): number {
  let n = 0
  for (let i = 1; i <= e.items; i++) if (respostes[String(i)] === undefined) n++
  return n
}

export function grauEscala(e: DefinicioEscala, total: number | null): string | null {
  if (total === null || total < 0 || total > e.maxim) return null
  let grau: string | null = null
  for (const [min, nom] of e.graus) if (total >= min) grau = nom
  return grau
}

// --- MYMOP (Measure Yourself Medical Outcome Profile) --------------------------

export const esquemaMymop = z.object({
  simptoma1: z.object({ nom: z.string(), puntuacio: z.number().int().min(0).max(6).nullable() }),
  simptoma2: z.object({ nom: z.string(), puntuacio: z.number().int().min(0).max(6).nullable() }),
  activitat: z.object({ nom: z.string(), puntuacio: z.number().int().min(0).max(6).nullable() }),
  benestar: z.number().int().min(0).max(6).nullable(),
})
export type Mymop = z.infer<typeof esquemaMymop>

export function mymopBuit(anterior?: Mymop | null): Mymop {
  // Els símptomes i l'activitat són els mateixos de la primera vegada (els tria la persona)
  return {
    simptoma1: { nom: anterior?.simptoma1.nom ?? '', puntuacio: null },
    simptoma2: { nom: anterior?.simptoma2.nom ?? '', puntuacio: null },
    activitat: { nom: anterior?.activitat.nom ?? '', puntuacio: null },
    benestar: null,
  }
}

/** Puntuació del perfil: la mitjana de les puntuacions que hi ha (0–6, on 0 és el millor) */
export function perfilMymop(m: Mymop | null | undefined): number | null {
  if (!m) return null
  const v = [m.simptoma1.puntuacio, m.simptoma2.puntuacio, m.activitat.puntuacio, m.benestar].filter((x): x is number => x !== null)
  return v.length === 0 ? null : Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100
}

/** El MYMOP es demana a la primera sessió de l'episodi i cada 4 sessions (1, 5, 9…) */
export const tocaMymop = (numeroSessio: number) => numeroSessio >= 1 && (numeroSessio - 1) % 4 === 0

// --- PGIC (Patient Global Impression of Change) ------------------------------
// Set nivells, de 1 (molt millor) a 7 (molt pitjor), amb etiquetes pròpies en
// català (no és el text de cap qüestionari). Ve de la família de la CGI (Guy,
// 1976, manual ECDEU de l'NIMH); versió de 7 nivells àmpliament usada (Hurst
// i Bolton, 2004). Vegeu docs/especificacions.md, «Llicències».

export const NIVELLS_PGIC = [1, 2, 3, 4, 5, 6, 7] as const

/** El PGIC es demana com el MYMOP: a la primera sessió de l'episodi i cada 4 sessions */
export const tocaPgic = tocaMymop
