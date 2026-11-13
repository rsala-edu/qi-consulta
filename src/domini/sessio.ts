// Sessió: el que es fa en una visita (etapa 3A). Una per cita feta; penja d'un
// episodi i té número dins l'episodi. Els punts es desen com un mapa
// «mapa:codi → punt»: dos dispositius que hi afegeixen punts diferents no
// entren en conflicte (es fusiona camp a camp, sincronia/registres.ts).

import { z } from 'zod'
import { esquemaPuntMarcat, type PuntMarcat } from './puntMarcat'
import { esquemaDadesSeccions } from '../cataleg/motor'
import { esquemaMymop } from './escales'
import type { Registre } from './registre'

export const ESTATS_SESSIO = ['enCurs', 'tancada'] as const
export type EstatSessio = (typeof ESTATS_SESSIO)[number]

/** Hores que una sessió tancada es pot editar lliurement; després, només addendes */
export const HORES_EDITABLE = 24
/** Minuts de retenció de les agulles per defecte */
export const MINUTS_RETENCIO = 28

/**
 * L'exploració d'abans de la 3B (llengua i pols en text lliure) passa a les
 * observacions de les seccions de la llengua i del pols: no es perd res.
 */
export function migrarExploracio(v: unknown): unknown {
  if (!v || typeof v !== 'object') return { seccions: {} }
  const { llengua, pols, seccions } = v as { llengua?: unknown; pols?: unknown; seccions?: Record<string, unknown> }
  const r: Record<string, unknown> = { ...(seccions ?? {}) }
  const posar = (id: string, text: unknown) => {
    if (typeof text !== 'string' || text.trim() === '' || r[id]) return
    r[id] = { altres: text }
  }
  posar('exploracio:llengua', llengua)
  posar('exploracio:pols', pols)
  return { seccions: r }
}

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
  retencio: z.object({
    iniciAt: z.string().nullable(),
    minuts: z.number().int().min(1).max(120),
    /**
     * (A7) Estones en marxa: una pausa tanca l'última (fi) i continuar n'obre
     * una altra. «Tornar a començar» n'obre una amb reinici: el temps es compta
     * des d'aquesta. Les sessions d'abans no en tenen: un sol tram des d'iniciAt
     */
    trams: z.array(z.object({ inici: z.string(), fi: z.string().nullable(), reinici: z.boolean().optional() })).optional(),
    /** (A7) La doctora l'ha aturat abans d'hora */
    aturadaAt: z.string().nullable().optional(),
  }),
  comEsta: z.object({
    canvis: z.string(),
    /** Escala 0–10 del símptoma principal */
    escala,
    /** Fins a dos símptomes secundaris */
    secundari1: simptoma,
    secundari2: simptoma,
  }),
  /** Seccions del catàleg d'exploració (etapa 3B). Abans eren dos textos: van a «Altres / observacions» */
  exploracio: z.preprocess(migrarExploracio, z.object({ seccions: esquemaDadesSeccions })),
  /** MYMOP: a la primera sessió de l'episodi i cada 4 (les d'abans de la 3B no en tenen) */
  mymop: esquemaMymop.nullable().default(null),
  /** (4B) El protocol del qual s'ha partit (el nom, per si després s'esborra) */
  protocol: z.object({ id: z.string(), nom: z.string() }).nullable().default(null),
  /** (4A) Quan es va començar la visita sense el consentiment d'acupuntura vigent («Continuar igualment») */
  senseConsentiment: z.string().nullable().default(null),
  /** PGIC: impressió global de canvi, de 1 (molt millor) a 7 (molt pitjor) (les d'abans no en tenen) */
  pgic: z.number().int().min(1).max(7).nullable().default(null),
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
    exploracio: { seccions: {} },
    mymop: null,
    pgic: null,
    senseConsentiment: null,
    protocol: null,
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

type Retencio = DadesSessio['retencio']
type Tram = NonNullable<Retencio['trams']>[number]

/** Les estones en marxa (les sessions d'abans de l'A7: un sol tram des d'iniciAt) */
export function tramsRetencio(r: Retencio): Tram[] {
  return r.trams ?? (r.iniciAt ? [{ inici: r.iniciAt, fi: null }] : [])
}

/** Les estones que compten: des de l'últim «Tornar a començar» */
function tramsQueCompten(r: Retencio): Tram[] {
  const trams = tramsRetencio(r)
  let des = 0
  trams.forEach((t, i) => t.reinici && (des = i))
  return trams.slice(des)
}

/** Mil·lisegons en marxa (sense les pauses), des de l'últim «Tornar a començar» */
export function tempsTranscorregut(r: Retencio, ara: number): number {
  return tramsQueCompten(r).reduce((suma, t) => suma + (t.fi ? Date.parse(t.fi) : ara) - Date.parse(t.inici), 0)
}

/**
 * Mil·lisegons que queden de retenció (negatiu: ja s'ha acabat), calculats a
 * partir de les hores d'inici i de pausa, mai amb un comptador: si la pantalla
 * s'apaga, en tornar continua bé. null: no s'ha començat.
 */
export function tempsRestant(r: Retencio, ara: number): number | null {
  if (!r.iniciAt) return null
  return r.minuts * 60_000 - tempsTranscorregut(r, ara)
}

export type EstatRetencio = 'perComencar' | 'enMarxa' | 'pausa' | 'acabada' | 'aturada'

export function estatRetencio(r: Retencio, ara: number): EstatRetencio {
  const restant = tempsRestant(r, ara)
  if (restant === null) return 'perComencar'
  if (r.aturadaAt) return 'aturada'
  if (restant <= 0) return 'acabada'
  return tramsRetencio(r).at(-1)?.fi ? 'pausa' : 'enMarxa'
}

/**
 * L'hora d'inici que tindria si no hi hagués hagut pauses (per al registre de
 * tota l'app: la pantalla de bloqueig i el so). Només si està en marxa (o
 * acabada sense aturar-la): en pausa o aturada, null
 */
export function iniciEquivalent(r: Retencio, ara: number): string | null {
  const estat = estatRetencio(r, ara)
  if (estat !== 'enMarxa' && estat !== 'acabada') return null
  const trams = tramsQueCompten(r)
  const ultim = trams.at(-1)
  if (!ultim || ultim.fi) return null
  const abans = trams.slice(0, -1).reduce((suma, t) => suma + Date.parse(t.fi!) - Date.parse(t.inici), 0)
  return new Date(Date.parse(ultim.inici) - abans).toISOString()
}

const tancarUltim = (trams: Tram[], ara: string): Tram[] =>
  trams.map((t, i) => (i === trams.length - 1 && !t.fi ? { ...t, fi: ara } : t))

/** Les accions del temporitzador (ara: ISO) */
export const accionsRetencio = {
  comencar: (r: Retencio, ara: string): Retencio => ({ ...r, iniciAt: ara, trams: [{ inici: ara, fi: null }], aturadaAt: null }),
  pausar: (r: Retencio, ara: string): Retencio => ({ ...r, trams: tancarUltim(tramsRetencio(r), ara) }),
  /** Després d'una pausa o d'aturar-lo */
  continuar: (r: Retencio, ara: string): Retencio => ({
    ...r,
    trams: [...tancarUltim(tramsRetencio(r), ara), { inici: ara, fi: null }],
    aturadaAt: null,
  }),
  aturar: (r: Retencio, ara: string): Retencio => ({ ...r, trams: tancarUltim(tramsRetencio(r), ara), aturadaAt: ara }),
  /** Torna a comptar els minuts sencers (les estones d'abans es conserven) */
  tornarAComencar: (r: Retencio, ara: string): Retencio => ({
    ...r,
    trams: [...tancarUltim(tramsRetencio(r), ara), { inici: ara, fi: null, reinici: true }],
    aturadaAt: null,
  }),
  /** ±1 minut (entre 1 i 120) */
  minuts: (r: Retencio, delta: number): Retencio => ({ ...r, minuts: Math.min(120, Math.max(1, r.minuts + delta)) }),
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
