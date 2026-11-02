// Fusió de dues còpies tancades amb claus mestres DIFERENTS: un dispositiu
// que va començar de zero amb una contrasenya pròpia (i per tant una clau
// pròpia) i la còpia de Google Drive, o un fitxer .qi d'un altre dispositiu.
//
// 1. Els registres xifrats de l'origen es tornen a xifrar amb la clau del
//    destí (es desxifren amb la clau de l'origen, que s'ha obert amb la seva
//    contrasenya). Les taules sense dades de pacient (calibratge, horari…) no
//    van xifrades i no cal tocar-les.
// 2. Els pacients que tenen el mateix nom i la mateixa data de naixement a
//    totes dues bandes NO es fusionen sols: totes dues fitxes queden marcades
//    per revisar (podrien ser dues persones diferents).
// 3. Es fusiona amb la regla de no perdre res: els registres de cada banda
//    tenen ids diferents (UUID) i se sumen; si un mateix registre clínic és a
//    totes dues bandes amb canvis diferents (un .qi antic del mateix
//    dispositiu), es fusiona camp a camp i el que no guanya queda com a
//    conflicte per revisar.

import { desxifrarJson, xifrarJson } from '../crypto'
import type { NomTaula, RegistreXifrat } from '../db/esquema'
import { context } from '../db/magatzem'
import { esquemaPacientGuardat, type PacientGuardat } from '../domini/pacient'
import { fusionar, type Contingut } from './copia'
import { fusionarClinics, TAULES_CLINIQUES } from './fusioClinica'

/** Taules amb registres xifrats amb la clau mestra (les clíniques i els seus conflictes) */
const TAULES_XIFRADES: readonly (NomTaula & keyof Contingut['taules'])[] = [...TAULES_CLINIQUES.map((t) => t.nom), 'conflictes']

/** Torna a xifrar uns registres d'una clau a una altra (mateix context: taula i id) */
export async function reXifrarRegistres<R extends RegistreXifrat>(
  registres: readonly R[],
  taula: NomTaula,
  de: CryptoKey,
  a: CryptoKey,
): Promise<R[]> {
  const nous: R[] = []
  for (const r of registres) {
    const ctx = context(taula, r.id)
    nous.push({ ...r, xifrat: await xifrarJson(a, await desxifrarJson(de, r.xifrat, ctx), ctx) })
  }
  return nous
}

export async function reXifrarContingut(c: Contingut, de: CryptoKey, a: CryptoKey): Promise<Contingut> {
  const taules = { ...c.taules }
  for (const nom of TAULES_XIFRADES) {
    taules[nom] = (await reXifrarRegistres(c.taules[nom] as unknown as RegistreXifrat[], nom, de, a)) as unknown as Contingut['taules'][typeof nom]
  }
  return { ...c, taules }
}

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('ca')
    .replace(/\s+/g, ' ')
    .trim()

/** Mateix nom i llinatges (sense accents ni majúscules) i mateixa data de naixement */
export const clauPersona = (p: Pick<PacientGuardat, 'nom' | 'llinatges' | 'dataNaixement'>) =>
  `${normal(`${p.nom} ${p.llinatges}`)}|${p.dataNaixement}`

type Pacients = Contingut['taules']['pacients']

async function llegir(clau: CryptoKey, r: RegistreXifrat): Promise<PacientGuardat> {
  return esquemaPacientGuardat.parse(await desxifrarJson(clau, r.xifrat, context('pacients', r.id)))
}

/**
 * Marca per revisar els pacients de l'origen que coincideixen amb un del destí
 * (tots dos xifrats ja amb la mateixa clau). Torna les dues llistes amb les
 * fitxes marcades i quantes parelles s'han trobat.
 */
export async function marcarPossiblesDuplicats(
  clau: CryptoKey,
  desti: Pacients,
  origen: Pacients,
  ara: string,
): Promise<{ desti: Pacients; origen: Pacients; parelles: number }> {
  const idsDesti = new Set(desti.map((r) => (r as unknown as RegistreXifrat).id))
  const perPersona = new Map<string, { r: RegistreXifrat; p: PacientGuardat }[]>()
  for (const r of desti as unknown as RegistreXifrat[]) {
    const p = await llegir(clau, r)
    const k = clauPersona(p)
    perPersona.set(k, [...(perPersona.get(k) ?? []), { r, p }])
  }
  const marques = new Map<string, Set<string>>()
  const marcar = (id: string, altre: string) => marques.set(id, new Set([...(marques.get(id) ?? []), altre]))
  const origens = new Map<string, PacientGuardat>()
  for (const r of origen as unknown as RegistreXifrat[]) {
    if (idsDesti.has(r.id)) continue // el mateix registre: no és un duplicat, es fusiona camp a camp
    const p = await llegir(clau, r)
    origens.set(r.id, p)
    for (const altre of perPersona.get(clauPersona(p)) ?? []) {
      marcar(r.id, altre.r.id)
      marcar(altre.r.id, r.id)
    }
  }
  let parelles = 0
  const aplicar = async (llista: Pacients, propis: Map<string, PacientGuardat> | null) => {
    const nous: unknown[] = []
    for (const x of llista as unknown as RegistreXifrat[]) {
      const altres = marques.get(x.id)
      if (!altres) {
        nous.push(x)
        continue
      }
      const p = propis?.get(x.id) ?? (await llegir(clau, x))
      const revisarDuplicat = [...new Set([...(p.revisarDuplicat ?? []), ...altres])].sort()
      nous.push({
        ...x,
        modificatAt: ara,
        xifrat: await xifrarJson(clau, { ...p, revisarDuplicat }, context('pacients', x.id)),
      })
    }
    return nous as Pacients
  }
  for (const v of marques.values()) parelles += v.size
  return { desti: await aplicar(desti, null), origen: await aplicar(origen, origens), parelles: parelles / 2 }
}

export interface ResultatFusioClaus {
  /** Tot xifrat amb la clau del destí */
  contingut: Contingut
  /** Parelles de pacients que poden ser la mateixa persona (marcades per revisar) */
  possiblesDuplicats: number
  /** Registres clínics fusionats camp a camp (el mateix registre a totes dues bandes) */
  fusionats: number
  conflictes: number
}

/**
 * Fusiona l'origen dins el destí. El resultat va xifrat amb la clau del destí,
 * que és la que es quedarà (la de Drive en «Fusionar», la del dispositiu en
 * importar un .qi).
 */
export async function fusionarClausDiferents(
  desti: { clau: CryptoKey; contingut: Contingut },
  origen: { clau: CryptoKey; contingut: Contingut },
  ara: string,
): Promise<ResultatFusioClaus> {
  const reXifrat = await reXifrarContingut(origen.contingut, origen.clau, desti.clau)
  const d = await marcarPossiblesDuplicats(desti.clau, desti.contingut.taules.pacients, reXifrat.taules.pacients, ara)
  const a = { ...desti.contingut, taules: { ...desti.contingut.taules, pacients: d.desti } }
  const b = { ...reXifrat, taules: { ...reXifrat.taules, pacients: d.origen } }
  // Sense una sincronia comuna, tot el que és a totes dues bandes amb canvis
  // diferents es fusiona camp a camp (la data més antiga possible com a «darrera»)
  const clinica = await fusionarClinics(desti.clau, a, b, '0000', ara)
  return {
    contingut: fusionar(clinica.local, clinica.remot),
    possiblesDuplicats: d.parelles,
    fusionats: clinica.fusionats,
    conflictes: clinica.conflictes,
  }
}
