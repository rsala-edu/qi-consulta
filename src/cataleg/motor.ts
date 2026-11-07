// Motor dels catàlegs: quines seccions i opcions es veuen (Ajustos >
// Catàlegs), en quin ordre, i com s'edita una secció. Sense React: es prova sol.

import { z } from 'zod'
import type { Camp, DadesSeccio, DadesSeccions, Grup, Opcio, Seccio, ValorCamp } from './tipus'

// --- Ajustos > Catàlegs -------------------------------------------------------

/**
 * Seccions, camps i opcions amagats, i l'ordre de les seccions i de les
 * opcions. No són dades de pacient (van sense xifrar i se sincronitzen).
 * Claus: «seccio», «seccio/camp» i «seccio/camp/opcio».
 */
export const esquemaAjustosCatalegs = z.object({
  amagats: z.array(z.string()).default([]),
  /** grup → ids de seccions en l'ordre triat */
  ordreSeccions: z.record(z.string(), z.array(z.string())).default({}),
  /** «seccio/camp» → ids d'opcions en l'ordre triat */
  ordreOpcions: z.record(z.string(), z.array(z.string())).default({}),
})
export type AjustosCatalegs = z.infer<typeof esquemaAjustosCatalegs>
export const AJUSTOS_CATALEGS_PER_DEFECTE: AjustosCatalegs = { amagats: [], ordreSeccions: {}, ordreOpcions: {} }

export const clauCamp = (s: Pick<Seccio, 'id'>, c: Pick<Camp, 'id'>) => `${s.id}/${c.id}`
export const clauOpcio = (s: Pick<Seccio, 'id'>, c: Pick<Camp, 'id'>, op: Pick<Opcio, 'id'>) => `${s.id}/${c.id}/${op.id}`

/** Ordena segons una llista d'ids (els que no hi són, al final, en l'ordre original) */
export function ordenar<T extends { id: string }>(llista: readonly T[], ordre: readonly string[] | undefined): T[] {
  if (!ordre || ordre.length === 0) return [...llista]
  const pos = new Map(ordre.map((id, i) => [id, i]))
  return [...llista]
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (pos.get(a.x.id) ?? ordre.length + a.i) - (pos.get(b.x.id) ?? ordre.length + b.i))
    .map(({ x }) => x)
}

export interface Context {
  sexe?: string
}

/**
 * Seccions que es mostren: les visibles, en l'ordre triat. Una secció amagada
 * que ja té dades es continua mostrant (no es perd res del que hi ha desat).
 */
export function seccionsVisibles(grup: Grup, ajustos: AjustosCatalegs, dades: DadesSeccions = {}, context: Context = {}): Seccio[] {
  const amagats = new Set(ajustos.amagats)
  return ordenar(grup.seccions, ajustos.ordreSeccions[grup.id]).filter((s) => {
    if (dades[s.id] && !esBuida(dades[s.id])) return true
    if (amagats.has(s.id)) return false
    // La ginecologia només si la pacient és dona (o si no consta el sexe)
    if (s.nomesSi === 'dona' && context.sexe && context.sexe !== 'dona') return false
    return true
  })
}

const valorsTriats = (v: ValorCamp | undefined): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? (v as string[]) : []

/** Camps que es mostren (un camp amagat amb valor es continua mostrant) */
export function campsVisibles(seccio: Seccio, ajustos: AjustosCatalegs, dades?: DadesSeccio): Camp[] {
  const amagats = new Set(ajustos.amagats)
  return seccio.camps.filter((c) => !amagats.has(clauCamp(seccio, c)) || teValor(dades?.valors?.[c.id]))
}

/** Opcions d'un camp que es mostren: les visibles, en l'ordre triat, i les amagades que ja estan triades */
export function opcionsVisibles(seccio: Seccio, camp: Camp & { opcions: readonly Opcio[] }, ajustos: AjustosCatalegs, valor?: ValorCamp): Opcio[] {
  const amagats = new Set(ajustos.amagats)
  const triats = new Set(valorsTriats(valor))
  return ordenar(camp.opcions, ajustos.ordreOpcions[clauCamp(seccio, camp)]).filter(
    (op) => !amagats.has(clauOpcio(seccio, camp, op)) || triats.has(op.id),
  )
}

// --- Editar una secció ----------------------------------------------------------

export function teValor(v: ValorCamp | undefined): boolean {
  if (v === undefined || v === null || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v).some((x) => teValor(x as ValorCamp))
  return true
}

/** Una secció sense res (no es desa) */
export function esBuida(d: DadesSeccio | undefined): boolean {
  if (!d) return true
  if (d.normal) return false
  if (d.altres && d.altres.trim() !== '') return false
  return !Object.values(d.valors ?? {}).some(teValor)
}

/** Neteja: treu els camps buits; si no queda res, undefined (la secció no es desa) */
export function netejar(d: DadesSeccio): DadesSeccio | undefined {
  const valors = Object.fromEntries(Object.entries(d.valors ?? {}).filter(([, v]) => teValor(v)))
  const r: DadesSeccio = {
    ...(d.normal ? { normal: true } : {}),
    ...(Object.keys(valors).length > 0 ? { valors } : {}),
    ...(d.altres && d.altres.trim() !== '' ? { altres: d.altres } : {}),
  }
  return esBuida(r) ? undefined : r
}

/** Canvia un camp. Si es tria alguna cosa, la secció deixa de ser «normal». */
export function ambCamp(d: DadesSeccio | undefined, campId: string, valor: ValorCamp): DadesSeccio | undefined {
  const valors = { ...(d?.valors ?? {}), [campId]: valor }
  return netejar({ ...d, normal: teValor(valor) ? false : d?.normal, valors })
}

/** Toca un xip: en un camp simple, el tria o el treu; en un de múltiple, l'afegeix o el treu */
export function tocarOpcio(d: DadesSeccio | undefined, camp: Camp, opcioId: string): DadesSeccio | undefined {
  const actual = d?.valors?.[camp.id]
  if (camp.tipus === 'simple') return ambCamp(d, camp.id, actual === opcioId ? null : opcioId)
  const llista = valorsTriats(actual)
  return ambCamp(d, camp.id, llista.includes(opcioId) ? llista.filter((x) => x !== opcioId) : [...llista, opcioId])
}

/** «Normal / sense alteracions»: d'un toc (i un altre toc ho desfà). Les observacions es mantenen. */
export function canviarNormal(d: DadesSeccio | undefined): DadesSeccio | undefined {
  if (d?.normal) return netejar({ ...d, normal: false })
  return netejar({ normal: true, altres: d?.altres })
}

export function ambAltres(d: DadesSeccio | undefined, altres: string): DadesSeccio | undefined {
  // Mentre s'escriu no es retalla (els espais del final són part del que s'escriu)
  const r: DadesSeccio = { ...d, altres }
  return esBuida(r) ? undefined : r
}

/** Desa una secció dins el mapa de seccions (si queda buida, la treu) */
export function ambSeccio(seccions: DadesSeccions, id: string, d: DadesSeccio | undefined): Record<string, DadesSeccio> {
  const r = { ...seccions }
  if (!d || esBuida(d)) delete r[id]
  else r[id] = d
  return r
}

// --- Resum (capçalera plegada, valors de l'última sessió) -----------------------

export function nomOpcio(camp: Camp, id: string): string {
  if ('opcions' in camp && camp.opcions) return camp.opcions.find((x) => x.id === id)?.ca ?? id
  return id
}

/** Text curt d'un valor que no és un xip (graella, zones, punts, codis…) */
function resumValor(camp: Camp, v: ValorCamp): string {
  if (Array.isArray(v)) return (v as string[]).map((id) => nomOpcio(camp, id)).join(', ')
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.codi === 'string') return `${o.codi} ${typeof o.titol === 'string' ? o.titol : ''}`.trim()
    if (camp.tipus === 'graella') {
      return Object.entries(o)
        .map(([casella, ops]) => {
          const [f, col] = casella.split('_')
          const nom = [camp.files.find((x) => x.id === f)?.ca, camp.columnes.find((x) => x.id === col)?.ca].filter(Boolean).join(' ')
          return `${nom}: ${(ops as string[]).map((id) => nomOpcio(camp, id)).join(', ')}`
        })
        .join('; ')
    }
    // Punts (codi → costat)
    return Object.entries(o)
      .map(([k, x]) =>
        typeof x === 'string' ? `${k} ${x}` : x && typeof x === 'object' && 'costat' in x ? `${k} ${String((x as { costat: string }).costat)}` : k,
      )
      .join(', ')
  }
  return String(v)
}

/** Text curt del que hi ha a una secció: «Normal», els xips triats i les observacions */
export function resumSeccio(seccio: Seccio, d: DadesSeccio | undefined, textNormal: string): string {
  if (!d || esBuida(d)) return ''
  const parts: string[] = []
  if (d.normal) parts.push(textNormal)
  for (const c of seccio.camps) {
    const v = d.valors?.[c.id]
    if (!teValor(v)) continue
    if (c.tipus === 'simple' || c.tipus === 'multiple') parts.push(valorsTriats(v).map((id) => nomOpcio(c, id)).join(', '))
    else if (c.tipus === 'nombre') parts.push(`${c.ca}: ${String(v)}${c.unitat ? ` ${c.unitat}` : ''}`)
    else if (typeof v === 'string') parts.push(v)
    else parts.push(resumValor(c, v as ValorCamp))
  }
  if (d.altres?.trim()) parts.push(d.altres.trim())
  return parts.join(' · ')
}

// --- Validació del que es desa ------------------------------------------------

const esquemaValor: z.ZodType<ValorCamp> = z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.record(z.string(), z.unknown()),
  z.null(),
])

export const esquemaDadesSeccio = z.object({
  normal: z.boolean().optional(),
  valors: z.record(z.string(), esquemaValor).optional(),
  altres: z.string().optional(),
})

export const esquemaDadesSeccions = z.record(z.string(), esquemaDadesSeccio)
