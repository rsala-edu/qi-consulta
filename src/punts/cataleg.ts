import { normalitzar } from '../domini/cercaPacients'
import dades from './cataleg.json'
import { esquemaCataleg, type Cataleg, type CostatPosicio, type Posicio3D, type PuntCatalog } from './esquema'

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
  const exactes = c.punts.filter((p) => p.codi.toLowerCase() === q || normalitzar(p.pinyin) === q)
  const parcials = c.punts.filter(
    (p) => !exactes.includes(p) && (p.codi.toLowerCase().startsWith(q) || normalitzar(p.pinyin).includes(q)),
  )
  return [...exactes, ...parcials]
}

/** Posició d'un punt en una topologia i un costat concrets. */
export function posicioDe(p: PuntCatalog, topologia: string, costat: CostatPosicio): Posicio3D | undefined {
  return p.posicions.find((q) => q.topologia === topologia && q.costat === costat)
}

/**
 * Aplica posicions calibrades (encara no exportades) sobre el catàleg.
 * Una posició calibrada substitueix la del catàleg amb la mateixa topologia i costat;
 * `null` vol dir que s'ha esborrat.
 */
export function ambCalibratge(
  c: Cataleg,
  calibrades: ReadonlyArray<{ codi: string; topologia: string; costat: CostatPosicio; posicio: Posicio3D | null }>,
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
        posicions = posicions.filter((q) => !(q.topologia === k.topologia && q.costat === k.costat))
        if (k.posicio) posicions = [...posicions, k.posicio]
      }
      return { ...p, posicions: ordenarPosicions(posicions) }
    }),
  }
}

function ordenarPosicions(posicions: Posicio3D[]): Posicio3D[] {
  const ordre: Record<CostatPosicio, number> = { E: 0, D: 1, C: 2 }
  return [...posicions].sort((a, b) => a.topologia.localeCompare(b.topologia) || ordre[a.costat] - ordre[b.costat])
}

/** JSON llest per substituir src/punts/cataleg.json (valida abans d'exportar). */
export function exportarCataleg(c: Cataleg): string {
  return `${JSON.stringify(esquemaCataleg.parse(c), null, 2)}\n`
}
