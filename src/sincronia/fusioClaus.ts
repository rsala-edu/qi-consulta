// Eines per a les dades tancades amb claus mestres diferents (canviClau.ts):
// tornar a xifrar registres d'una clau a una altra i saber si dos pacients
// poden ser la mateixa persona (mateix nom i data de naixement), que no
// s'ajunten sols: queden marcats per revisar.

import { desxifrarJson, xifrarJson } from '../crypto'
import type { NomTaula, RegistreXifrat } from '../db/esquema'
import { context } from '../db/magatzem'
import type { PacientGuardat } from '../domini/pacient'

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
    const nou: R = { ...r, xifrat: await xifrarJson(a, await desxifrarJson(de, r.xifrat, ctx), ctx) }
    // Les versions per camp (sincronia/registres.ts) també van xifrades
    if (r.versions) {
      const cv = `qi:versions:${taula}:${r.id}`
      nou.versions = await xifrarJson(a, await desxifrarJson(de, r.versions, cv), cv)
    }
    nous.push(nou)
  }
  return nous
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

