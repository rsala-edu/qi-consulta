// Base de la fusió del format 1 i dades dels conflictes per revisar.
//
// La fusió camp a camp ara és a registres.ts (amb versions per camp, format 2).
// Aquí queda el que encara fa servir el format 1 (la migració i la
// recuperació d'una còpia antiga) i el tipus de les dades d'un conflicte.

import type { RegistreXifrat } from '../db/esquema'
import type { Contingut } from './copia'

/** Taules amb dades clíniques (es fusionen camp a camp) */
export const TAULES_CLINIQUES = [{ nom: 'pacients' }, { nom: 'fitxesCliniques' }, { nom: 'cites' }] as const

/** El que es xifra dins un registre de conflicte */
export interface DadesConflicte {
  camps: { camp: string; valor: unknown }[]
  /** Quan es va desar la versió que no ha guanyat */
  versioAt: string
}

/** Registres clínics (xifrats) tal com van quedar a l'última sincronia del format 1, per taula */
export type BaseSincronia = Partial<Record<string, RegistreXifrat[]>>

/** La base per migrar del format 1: els registres clínics del contingut */
export function baseDe(c: Contingut): BaseSincronia {
  return Object.fromEntries(TAULES_CLINIQUES.map(({ nom }) => [nom, c.taules[nom] as unknown as RegistreXifrat[]]))
}
