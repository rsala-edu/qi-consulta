// Camps d'un registre clínic pel seu camí («habits.tabac»), per revisar els
// conflictes. La fusió camp a camp és a registres.ts.

export type Valor = unknown
export type Dades = Record<string, Valor>

export interface ConflicteCamp {
  /** Camí del camp: «medicacioActual», «habits.tabac» */
  camp: string
  /** El valor de l'altra versió, que no ha guanyat */
  valor: Valor
}

const esObjecte = (v: Valor): v is Dades => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Valor d'un camp pel seu camí («habits.tabac») */
export function valorDe(dades: Dades, cami: string): Valor {
  return cami.split('.').reduce<Valor>((v, c) => (esObjecte(v) ? v[c] : undefined), dades)
}

/** Còpia de les dades amb el camp canviat */
export function ambValor(dades: Dades, cami: string, valor: Valor): Dades {
  const [cap, ...resta] = cami.split('.')
  if (resta.length === 0) return { ...dades, [cap!]: valor }
  const fill = esObjecte(dades[cap!]) ? (dades[cap!] as Dades) : {}
  return { ...dades, [cap!]: ambValor(fill, resta.join('.'), valor) }
}
