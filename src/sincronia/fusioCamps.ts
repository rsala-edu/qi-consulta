// Fusió camp a camp de dues versions d'un registre clínic (desxifrades), per
// no perdre mai cap dada:
// - si un camp només està omplert en una versió, es queda;
// - si totes dues hi tenen el mateix valor, cap problema;
// - si tenen valors diferents, guanya el de la versió més nova i el de l'altra
//   es guarda com a «versió anterior» (un conflicte que la doctora revisa).
// Les caselles (sí/no) d'una contraindicació: si alguna versió la té marcada,
// queda marcada (és el més prudent) i no cal revisar-la.
// Els camps niats (contraindicacions.altres) es tracten un per un.

export type Valor = unknown
export type Dades = Record<string, Valor>

export interface ConflicteCamp {
  /** Camí del camp: «medicacioActual», «habits.tabac» */
  camp: string
  /** El valor de l'altra versió, que no ha guanyat */
  valor: Valor
}

const esObjecte = (v: Valor): v is Dades => typeof v === 'object' && v !== null && !Array.isArray(v)

const buit = (v: Valor) =>
  v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)

const igual = (a: Valor, b: Valor) => JSON.stringify(a) === JSON.stringify(b)

/**
 * `nova` és la versió més nova (la que guanya si hi ha diferències).
 * `base`, si se sap, és la versió de l'última sincronia: un camp que només
 * ha canviat en una de les dues versions es pren d'aquella, sense conflicte.
 */
export function fusionarCamps(
  nova: Dades,
  anterior: Dades,
  prefix = '',
  base?: Dades,
): { dades: Dades; conflictes: ConflicteCamp[] } {
  const dades: Dades = {}
  const conflictes: ConflicteCamp[] = []
  for (const camp of new Set([...Object.keys(nova), ...Object.keys(anterior)])) {
    const a = nova[camp]
    const b = anterior[camp]
    const cami = prefix ? `${prefix}.${camp}` : camp
    const o = base?.[camp]
    if (esObjecte(a) && esObjecte(b)) {
      const sub = fusionarCamps(a, b, cami, esObjecte(o) ? o : undefined)
      dades[camp] = sub.dades
      conflictes.push(...sub.conflictes)
    } else if (base && !igual(a, b) && igual(a, o)) dades[camp] = b // només ha canviat l'anterior
    else if (base && !igual(a, b) && igual(b, o)) dades[camp] = a // només ha canviat la nova
    else if (igual(a, b) || buit(b)) dades[camp] = a === undefined ? b : a
    else if (buit(a)) dades[camp] = b
    else {
      dades[camp] = a
      conflictes.push({ camp: cami, valor: b })
    }
  }
  return { dades, conflictes }
}

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
