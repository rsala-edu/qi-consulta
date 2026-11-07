// Valoració inicial (etapa 3B): una per episodi, feta a la primera visita.
// Si es revisa, es fa una versió nova (la d'abans es conserva tal com era).
// Cada secció dels catàlegs és un camp que es fusiona sol (sincronia camp a
// camp): dos dispositius que omplen seccions diferents no entren en conflicte.

import { z } from 'zod'
import { esquemaDadesSeccions } from '../cataleg/motor'
import type { Registre } from './registre'

export const esquemaDadesValoracio = z.object({
  episodiId: z.string(),
  /** 1, 2, 3… (cada revisió és una versió nova) */
  versio: z.number().int().min(1),
  /** La sessió on es va fer (o revisar) */
  sessioId: z.string().nullable(),
  creadaAt: z.string(),
  /** «grup:seccio» → el que s'hi ha marcat (les seccions sense tocar no hi són) */
  seccions: esquemaDadesSeccions.default({}),
  /** Mòdul ORL: null = automàtic (segons el motiu), true/false = triat a mà */
  orl: z.boolean().nullable().default(null),
})
export type DadesValoracio = z.infer<typeof esquemaDadesValoracio>
export type Valoracio = Registre & { pacientId: string } & DadesValoracio

/** Id de cada versió: el mateix a tots els dispositius (dues primeres visites alhora fan la mateixa valoració) */
export const idValoracio = (episodiId: string, versio: number) => `valoracio-${episodiId}-v${versio}`

export function novaValoracio(episodiId: string, versio: number, sessioId: string | null, abans?: DadesValoracio): DadesValoracio {
  return {
    episodiId,
    versio,
    sessioId,
    creadaAt: new Date().toISOString(),
    seccions: abans ? structuredClone(abans.seccions) : {},
    orl: abans?.orl ?? null,
  }
}

/** Hi ha embaràs marcat a la valoració (o possible) */
export function hiHaEmbaras(v: Pick<DadesValoracio, 'seccions'> | null | undefined): boolean {
  const e = v?.seccions['anamnesi:ginecologia']?.valors?.embaras
  return e === 'si' || e === 'possible'
}
