import { normalitzar } from '../domini/cercaPacients'
import dades from './cataleg.json'
import { CATEGORIES_PRECAUCIO, esquemaCataleg, type Cataleg, type CategoriaPrecaucio, type CostatPosicio, type Posicio3D, type PuntCatalog } from './esquema'

/** El catàleg del projecte, validat en carregar-lo. */
export const cataleg: Cataleg = esquemaCataleg.parse(dades)

export function nomMeridia(c: Cataleg, codi: string): string {
  return c.meridians.find((m) => m.codi === codi)?.nom ?? codi
}

/**
 * Cerca per codi («ST36», «st 36») o per pinyin sense accents ni espais
 * («zusanli», «Zu San Li»). Primer els codis exactes, després la resta.
 */
export function cercarPunts(c: Cataleg, consulta: string): PuntCatalog[] {
  const q = normalitzar(consulta).replace(/[\s-]/g, '')
  if (q === '') return []
  // Els codis dels extraordinaris porten guionet (EX-HN3): es compara sense
  const codi = (p: PuntCatalog) => p.codi.toLowerCase().replace(/-/g, '')
  const exactes = c.punts.filter((p) => codi(p) === q || normalitzar(p.pinyin) === q)
  const parcials = c.punts.filter(
    (p) => !exactes.includes(p) && (codi(p).startsWith(q) || normalitzar(p.pinyin).includes(q)),
  )
  return [...exactes, ...parcials]
}

/** Posició d'un punt en una topologia, un costat i (per als codis amb subpunts) un subpunt concrets. */
export function posicioDe(p: PuntCatalog, topologia: string, costat: CostatPosicio, index = 0): Posicio3D | undefined {
  return p.posicions.find((q) => q.topologia === topologia && q.costat === costat && (q.index ?? 0) === index)
}

/** Costats on va un punt: E i D, o només C (línia mitja i punts únics com Yintang) */
export function costatsDe(c: Cataleg, p: PuntCatalog): CostatPosicio[] {
  const bilateral = (c.meridians.find((m) => m.codi === p.meridia)?.bilateral ?? true) && !p.mitja
  return bilateral ? ['E', 'D'] : ['C']
}

/**
 * Aplica posicions calibrades (encara no exportades) sobre el catàleg.
 * Una posició calibrada substitueix la del catàleg amb la mateixa topologia i costat;
 * `null` vol dir que s'ha esborrat.
 */
export function ambCalibratge(
  c: Cataleg,
  calibrades: ReadonlyArray<{
    codi: string
    topologia: string
    costat: CostatPosicio
    index?: number
    posicio: Posicio3D | null
  }>,
): Cataleg {
  if (calibrades.length === 0) return c
  const perCodi = new Map<string, typeof calibrades>()
  for (const k of calibrades) perCodi.set(k.codi, [...(perCodi.get(k.codi) ?? []), k])
  return {
    ...c,
    punts: c.punts.map((p) => {
      const canvis = perCodi.get(p.codi)
      if (!canvis) return p
      let posicions = p.posicions
      for (const k of canvis) {
        posicions = posicions.filter(
          (q) => !(q.topologia === k.topologia && q.costat === k.costat && (q.index ?? 0) === (k.index ?? 0)),
        )
        if (k.posicio) posicions = [...posicions, k.posicio]
      }
      return { ...p, posicions: ordenarPosicions(posicions) }
    }),
  }
}

function ordenarPosicions(posicions: Posicio3D[]): Posicio3D[] {
  const ordre: Record<CostatPosicio, number> = { E: 0, D: 1, C: 2 }
  return [...posicions].sort(
    (a, b) =>
      a.topologia.localeCompare(b.topologia) || ordre[a.costat] - ordre[b.costat] || (a.index ?? 0) - (b.index ?? 0),
  )
}

/** Excepció de la doctora per a un punt concret: categories i text propis. */
export interface ExcepcioPrecaucio {
  codi: string
  categories: readonly CategoriaPrecaucio[]
  nota: string
}

/** El que la doctora ha revisat: categories confirmades i excepcions per punt. */
export interface RevisioPrecaucions {
  categories: readonly CategoriaPrecaucio[]
  excepcions: readonly ExcepcioPrecaucio[]
}

export const REVISIO_BUIDA: RevisioPrecaucions = { categories: [], excepcions: [] }

/**
 * Aplica la revisió de la doctora. Un punt amb excepció pren les categories i
 * el text de l'excepció i queda confirmat; els altres queden confirmats quan
 * totes les seves categories estan confirmades.
 */
export function ambPrecaucions(c: Cataleg, revisio: RevisioPrecaucions): Cataleg {
  if (revisio.categories.length === 0 && revisio.excepcions.length === 0) return c
  const confirmades = new Set(revisio.categories)
  const excepcions = new Map(revisio.excepcions.map((e) => [e.codi, e]))
  return {
    ...c,
    punts: c.punts.map((p) => {
      const e = excepcions.get(p.codi)
      if (e) return { ...p, precaucions: { categories: ordenarCategories(e.categories), nota: e.nota, confirmada: true } }
      const cats = p.precaucions.categories
      const confirmada = cats.length > 0 && cats.every((x) => confirmades.has(x))
      return confirmada ? { ...p, precaucions: { ...p.precaucions, confirmada } } : p
    }),
  }
}

export function ordenarCategories(cats: readonly CategoriaPrecaucio[]): CategoriaPrecaucio[] {
  return CATEGORIES_PRECAUCIO.filter((x) => cats.includes(x))
}

/** Punts amb alguna precaució proposada al catàleg del projecte (els que la doctora ha de revisar). */
export function puntsAmbPrecaucio(c: Cataleg): Cataleg['punts'] {
  return c.punts.filter((p) => p.precaucions.categories.length > 0)
}

/**
 * Punts d'una categoria: els que la tenen al catàleg i els que la doctora hi
 * ha afegit amb una excepció (els treu d'una categoria també es veuen, per
 * poder desfer l'excepció).
 */
export function puntsDeCategoria(
  original: Cataleg,
  categoria: CategoriaPrecaucio,
  revisio: RevisioPrecaucions,
): Cataleg['punts'] {
  const excepcions = new Map(revisio.excepcions.map((e) => [e.codi, e]))
  return original.punts.filter(
    (p) => p.precaucions.categories.includes(categoria) || excepcions.get(p.codi)?.categories.includes(categoria),
  )
}

/** JSON llest per substituir src/punts/cataleg.json (valida abans d'exportar). */
export function exportarCataleg(c: Cataleg): string {
  return `${JSON.stringify(esquemaCataleg.parse(c), null, 2)}\n`
}
