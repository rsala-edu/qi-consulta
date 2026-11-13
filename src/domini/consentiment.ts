// Consentiment informat (etapa 4A). Dues coses:
// - Plantilles amb versions: «Esborrany» i «Pendent de revisió» es poden
//   editar; en aprovar-ne una es crea una versió nova («Aprovada») que ja no
//   es pot editar, i l'aprovada anterior del mateix tipus passa a «Retirada».
//   Només es poden fer signar les aprovades.
// - Consentiments signats: la plantilla i la versió exactes (amb una còpia del
//   text), les signatures i el PDF. No es poden modificar mai: només revocar
//   (amb la data i el motiu), i queda a l'historial.

import { z } from 'zod'
import type { Registre } from './registre'

export const TIPUS_CONSENTIMENT = ['acupuntura', 'dades', 'imatges'] as const
export type TipusConsentiment = (typeof TIPUS_CONSENTIMENT)[number]

export const ESTATS_PLANTILLA = ['esborrany', 'pendent', 'aprovada', 'retirada'] as const
export type EstatPlantilla = (typeof ESTATS_PLANTILLA)[number]

export const esquemaDadesPlantilla = z.object({
  tipus: z.enum(TIPUS_CONSENTIMENT),
  titol: z.string().trim().min(1),
  text: z.string(),
  versio: z.number().int().min(1),
  /** Data de la versió (ISO) */
  data: z.string(),
  estat: z.enum(ESTATS_PLANTILLA),
  /** Nota visible a Ajustos (p. ex. «Plantilla orientativa…») */
  nota: z.string().default(''),
})
export type DadesPlantilla = z.infer<typeof esquemaDadesPlantilla>
export type Plantilla = Pick<Registre, 'id' | 'creatAt' | 'modificatAt'> & DadesPlantilla

/** El mateix id a tots els dispositius (dos dispositius que creen les inicials alhora no les dupliquen) */
export const idPlantilla = (tipus: TipusConsentiment, versio: number) => `plantilla-${tipus}-v${versio}`

export const esEditable = (p: Pick<DadesPlantilla, 'estat'>) => p.estat === 'esborrany' || p.estat === 'pendent'

/** Les versions d'un tipus, de la més nova a la més antiga */
export function versionsDe<P extends Pick<DadesPlantilla, 'tipus' | 'versio'>>(plantilles: readonly P[], tipus: TipusConsentiment): P[] {
  return plantilles.filter((p) => p.tipus === tipus).sort((a, b) => b.versio - a.versio)
}

/** La plantilla aprovada que es fa signar (null si no n'hi ha cap) */
export function aprovadaDe<P extends Pick<DadesPlantilla, 'tipus' | 'versio' | 'estat'>>(plantilles: readonly P[], tipus: TipusConsentiment): P | null {
  return versionsDe(plantilles, tipus).find((p) => p.estat === 'aprovada') ?? null
}

/** La que es pot editar (l'esborrany o la pendent de revisió); null si totes estan aprovades o retirades */
export function editableDe<P extends Pick<DadesPlantilla, 'tipus' | 'versio' | 'estat'>>(plantilles: readonly P[], tipus: TipusConsentiment): P | null {
  return versionsDe(plantilles, tipus).find(esEditable) ?? null
}

/**
 * Aprovar: una versió nova (la següent) amb el mateix títol i text, que ja no
 * es pot editar; l'aprovada anterior del mateix tipus passa a retirada.
 */
export function aprovar(
  plantilla: DadesPlantilla,
  totes: readonly DadesPlantilla[],
  ara: string,
): { nova: DadesPlantilla; retirades: DadesPlantilla[] } {
  if (!esEditable(plantilla)) throw new Error('Només es pot aprovar un esborrany o una plantilla pendent de revisió')
  const delTipus = totes.filter((p) => p.tipus === plantilla.tipus)
  const versio = Math.max(0, ...delTipus.map((p) => p.versio)) + 1
  return {
    nova: { ...plantilla, versio, data: ara, estat: 'aprovada', nota: '' },
    retirades: delTipus.filter((p) => p.estat === 'aprovada').map((p) => ({ ...p, estat: 'retirada' as const })),
  }
}

/** Editar una aprovada: un esborrany nou (la versió següent) a partir del seu text */
export function nouEsborrany(base: DadesPlantilla, totes: readonly DadesPlantilla[], ara: string): DadesPlantilla {
  const versio = Math.max(0, ...totes.filter((p) => p.tipus === base.tipus).map((p) => p.versio)) + 1
  return { ...base, versio, data: ara, estat: 'esborrany', nota: '' }
}

// --- Consentiments signats ------------------------------------------------------

export const RELACIONS_REPRESENTANT = ['pare', 'mare', 'tutor', 'altre'] as const

export const esquemaRepresentant = z.object({
  nom: z.string().trim().min(1),
  dni: z.string().trim(),
  relacio: z.enum(RELACIONS_REPRESENTANT),
  /** Signatura (PNG en data URL) */
  signatura: z.string().min(1),
})
export type Representant = z.infer<typeof esquemaRepresentant>

export const esquemaDadesConsentiment = z.object({
  tipus: z.enum(TIPUS_CONSENTIMENT),
  plantillaId: z.string(),
  versio: z.number().int().min(1),
  titol: z.string(),
  /** El text exacte que es va signar */
  text: z.string(),
  /** Data i hora de la signatura (ISO) */
  signatAt: z.string(),
  signaturaPacient: z.string().min(1),
  representant: esquemaRepresentant.nullable(),
  signaturaDoctora: z.string().min(1),
  estat: z.enum(['vigent', 'revocat']),
  revocacio: z.object({ at: z.string(), motiu: z.string().trim().min(1) }).nullable(),
  /** El PDF del document signat (base64) */
  pdf: z.string(),
})
export type DadesConsentiment = z.infer<typeof esquemaDadesConsentiment>
export type Consentiment = Registre & { pacientId: string } & DadesConsentiment

export type EstatConsentiment = 'vigent' | 'pendent' | 'revocat'

/**
 * L'estat d'un tipus per a un pacient: «vigent» si en té un de signat i no
 * revocat; «revocat» si l'últim que va signar està revocat; «pendent» si no
 * n'ha signat cap.
 */
export function estatDelTipus(consentiments: readonly Pick<DadesConsentiment, 'tipus' | 'estat' | 'signatAt'>[], tipus: TipusConsentiment): EstatConsentiment {
  const delTipus = consentiments.filter((c) => c.tipus === tipus).sort((a, b) => b.signatAt.localeCompare(a.signatAt))
  if (delTipus.some((c) => c.estat === 'vigent')) return 'vigent'
  return delTipus.length > 0 ? 'revocat' : 'pendent'
}

/** Revocar: només canvien l'estat i la revocació (la resta és intocable) */
export function revocar(c: DadesConsentiment, motiu: string, ara: string): DadesConsentiment {
  if (c.estat === 'revocat') throw new Error('Aquest consentiment ja està revocat')
  if (!motiu.trim()) throw new Error('Cal el motiu de la revocació')
  return { ...c, estat: 'revocat', revocacio: { at: ara, motiu: motiu.trim() } }
}

/** Un consentiment signat no es pot modificar mai: només es pot revocar */
export function comprovarCanvi(abans: DadesConsentiment, despres: DadesConsentiment): void {
  const { estat: _e1, revocacio: _r1, ...a } = abans
  const { estat: _e2, revocacio: _r2, ...d } = despres
  if (JSON.stringify(a) !== JSON.stringify(d)) throw new Error('Un consentiment signat no es pot modificar; només es pot revocar')
  if (abans.estat === 'revocat' && (despres.estat !== 'revocat' || JSON.stringify(abans.revocacio) !== JSON.stringify(despres.revocacio)))
    throw new Error('Una revocació no es pot desfer ni canviar')
}
