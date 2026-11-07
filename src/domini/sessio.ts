// Sessió: el que es fa en una visita (etapa 3A). Una per cita feta; penja d'un
// episodi i té número dins l'episodi. Els punts es desen com un mapa
// «mapa:codi → punt»: dos dispositius que hi afegeixen punts diferents no
// entren en conflicte (es fusiona camp a camp, sincronia/registres.ts).

import { z } from 'zod'
import { esquemaPuntMarcat, type PuntMarcat } from './puntMarcat'
import type { Registre } from './registre'

export const ESTATS_SESSIO = ['enCurs', 'tancada'] as const
export type EstatSessio = (typeof ESTATS_SESSIO)[number]

/** Hores que una sessió tancada es pot editar lliurement; després, només addendes */
export const HORES_EDITABLE = 24
/** Minuts de retenció de les agulles per defecte */
export const MINUTS_RETENCIO = 28

const escala = z.number().int().min(0).max(10).nullable()
const simptoma = z.object({ nom: z.string().trim(), escala })

export const esquemaDadesSessio = z.object({
  citaId: z.string(),
  episodiId: z.string(),
  /** Número de la sessió dins l'episodi */
  numero: z.number().int().min(1),
  /** Hora d'inici i de final (ISO) */
  iniciAt: z.string(),
  finalAt: z.string().nullable(),
  estat: z.enum(ESTATS_SESSIO),
  /** Temporitzador de retenció: quan s'han posat les agulles i quants minuts */
  retencio: z.object({ iniciAt: z.string().nullable(), minuts: z.number().int().min(1).max(120) }),
  comEsta: z.object({
    canvis: z.string(),
    /** Escala 0–10 del símptoma principal */
    escala,
    /** Fins a dos símptomes secundaris */
    secundari1: simptoma,
    secundari2: simptoma,
  }),
  exploracio: z.object({ llengua: z.string(), pols: z.string() }),
  /** «mapa:codi» → punt */
  punts: z.record(z.string(), esquemaPuntMarcat),
  agulles: z.object({
    /** Corregides a mà (null: les dels punts) */
    posades: z.number().int().min(0).nullable(),
    retirades: z.number().int().min(0).nullable(),
    /** Si les retirades no quadren amb les posades */
    motiu: z.string(),
  }),
  tancar: z.object({ recomanacions: z.string(), incidencies: z.string(), capIncidencia: z.boolean() }),
})
export type DadesSessio = z.infer<typeof esquemaDadesSessio>
export type Sessio = Registre & { pacientId: string } & DadesSessio

export function novaSessio(d: { citaId: string; episodiId: string; numero: number; iniciAt: string; minuts?: number }): DadesSessio {
  const buit = { nom: '', escala: null }
  return {
    citaId: d.citaId,
    episodiId: d.episodiId,
    numero: d.numero,
    iniciAt: d.iniciAt,
    finalAt: null,
    estat: 'enCurs',
    retencio: { iniciAt: null, minuts: d.minuts ?? MINUTS_RETENCIO },
    comEsta: { canvis: '', escala: null, secundari1: buit, secundari2: { ...buit } },
    exploracio: { llengua: '', pols: '' },
    punts: {},
    agulles: { posades: null, retirades: null, motiu: '' },
    tancar: { recomanacions: '', incidencies: '', capIncidencia: false },
  }
}

// --- Punts ------------------------------------------------------------------

export const clauPunt = (p: Pick<PuntMarcat, 'mapa' | 'codi'>) => `${p.mapa}:${p.codi}`

export function llistaPunts(punts: DadesSessio['punts']): PuntMarcat[] {
  return Object.values(punts)
}

export function mapaPunts(llista: readonly PuntMarcat[]): DadesSessio['punts'] {
  return Object.fromEntries(llista.map((p) => [clauPunt(p), p]))
}

/**
 * «Repetir el tractament de l'última sessió»: tots els punts amb el costat, la
 * tècnica i els paràmetres. `substituir`: treu els que ja hi havia; si no,
 * s'hi afegeixen (els que hi són tots dos, es queden com els de l'última).
 */
export function copiarTractament(actuals: DadesSessio['punts'], anteriors: DadesSessio['punts'], substituir: boolean): DadesSessio['punts'] {
  const copia = structuredClone(anteriors)
  return substituir ? copia : { ...actuals, ...copia }
}

/** «Respecte de l'última sessió: +2 punts, −1 punt» */
export function diferenciaPunts(actuals: DadesSessio['punts'], anteriors: DadesSessio['punts']): { mes: number; menys: number } {
  const a = new Set(Object.keys(actuals))
  const b = new Set(Object.keys(anteriors))
  return { mes: [...a].filter((k) => !b.has(k)).length, menys: [...b].filter((k) => !a.has(k)).length }
}

// --- Agulles ----------------------------------------------------------------

/** Agulles posades segons els punts: els de tècnica «agulla»; els bilaterals compten com a 2 */
export function agullesDelsPunts(punts: DadesSessio['punts']): number {
  return llistaPunts(punts)
    .filter((p) => p.tecnica === 'agulla')
    .reduce((n, p) => n + (p.costat === 'bilateral' ? 2 : 1), 0)
}

export function agullesPosades(s: Pick<DadesSessio, 'agulles' | 'punts'>): number {
  return s.agulles.posades ?? agullesDelsPunts(s.punts)
}

/** Es pot finalitzar: les retirades quadren amb les posades, o s'ha escrit el motiu */
export function agullesQuadren(s: Pick<DadesSessio, 'agulles' | 'punts'>, retirades: number, motiu: string): boolean {
  return retirades === agullesPosades(s) || motiu.trim() !== ''
}

// --- Temporitzador ----------------------------------------------------------

/**
 * Mil·lisegons que queden de retenció (negatiu: ja s'ha acabat), calculats a
 * partir de l'hora d'inici, mai amb un comptador: si la pantalla s'apaga, en
 * tornar continua bé. null: no s'ha començat.
 */
export function tempsRestant(retencio: DadesSessio['retencio'], ara: number): number | null {
  if (!retencio.iniciAt) return null
  return Date.parse(retencio.iniciAt) + retencio.minuts * 60_000 - ara
}

/** «27:59» (els segons que queden, arrodonits cap amunt) */
export function formatTemps(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// --- Integritat -------------------------------------------------------------

/** Fins quan es pot editar una sessió tancada (null: en curs, sempre editable) */
export function editableFins(s: Pick<DadesSessio, 'estat' | 'finalAt'>): Date | null {
  if (s.estat !== 'tancada' || !s.finalAt) return null
  return new Date(Date.parse(s.finalAt) + HORES_EDITABLE * 3_600_000)
}

export function esEditable(s: Pick<DadesSessio, 'estat' | 'finalAt'>, ara: number): boolean {
  const fins = editableFins(s)
  return fins === null || ara < fins.getTime()
}

// --- Addendes ---------------------------------------------------------------

export const esquemaDadesAddenda = z.object({
  sessioId: z.string(),
  text: z.string().trim().min(1),
  /** Data i hora (ISO) */
  at: z.string(),
})
export type DadesAddenda = z.infer<typeof esquemaDadesAddenda>
export type Addenda = Registre & { pacientId: string } & DadesAddenda
