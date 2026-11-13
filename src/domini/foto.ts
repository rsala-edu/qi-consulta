// Fotos clíniques (etapa 4C). Cada foto té unes metadades (pacient, episodi,
// sessió, zona, nota i una miniatura petita) que se sincronitzen com la resta,
// i la imatge sencera, que va xifrada a part (a Drive, un fitxer per foto, que
// només es baixa quan s'obre). Abans de desar-la se'n treuen les metadades
// EXIF (sobretot la ubicació) i es redueix a 1.600 px pel costat llarg.

import { z } from 'zod'
import type { Registre } from './registre'

export const COSTAT_MAXIM = 1600
export const QUALITAT_JPEG = 0.8
export const COSTAT_MINIATURA = 240

export const ZONES_FOTO = ['llengua', 'cara', 'cap', 'coll', 'espatlla', 'esquena', 'lumbar', 'abdomen', 'brac', 'ma', 'cama', 'genoll', 'peu', 'orella', 'pell', 'altres'] as const
export type ZonaFoto = (typeof ZONES_FOTO)[number]

export const esquemaDadesFoto = z.object({
  episodiId: z.string().nullable(),
  sessioId: z.string().nullable(),
  zona: z.enum(ZONES_FOTO).nullable(),
  nota: z.string(),
  /** Quan es va fer (ISO) */
  presaAt: z.string(),
  amplada: z.number().int().positive(),
  alcada: z.number().int().positive(),
  /** Mida de la imatge sencera (bytes del JPEG) */
  mida: z.number().int().nonnegative(),
  /** Miniatura (JPEG en data URL, uns pocs kB): es veu sense baixar la foto */
  miniatura: z.string(),
  /** Esborrada: queda el registre (quan i per què), sense la imatge ni la miniatura */
  esborrada: z.object({ at: z.string(), motiu: z.string() }).nullable().default(null),
})
export type DadesFoto = z.infer<typeof esquemaDadesFoto>
export type Foto = Registre & { pacientId: string } & DadesFoto

/** El fitxer de Drive de cada foto (un per foto, no es modifica) */
export const nomFitxerImatge = (id: string) => `qi-imatge-${id}.json`
export const RE_IMATGE = /^qi-imatge-([0-9a-z-]+)\.json$/

/** Mida reduïda conservant la proporció: el costat llarg com a molt `maxim` (no s'amplia mai) */
export function midaReduida(amplada: number, alcada: number, maxim = COSTAT_MAXIM): { amplada: number; alcada: number } {
  const escala = Math.min(1, maxim / Math.max(amplada, alcada))
  return { amplada: Math.max(1, Math.round(amplada * escala)), alcada: Math.max(1, Math.round(alcada * escala)) }
}

/**
 * Treu d'un JPEG els segments de metadades: APP1 a APP15 (EXIF amb la
 * ubicació GPS, XMP, IPTC…) i els comentaris. Es queden APP0 (JFIF) i la
 * imatge. Si no és un JPEG, el torna tal qual.
 */
export function treureExif(jpeg: Uint8Array): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg
  const parts: Uint8Array[] = [jpeg.subarray(0, 2)]
  let i = 2
  while (i + 4 <= jpeg.length) {
    if (jpeg[i] !== 0xff) break
    const marcador = jpeg[i + 1]!
    // Inici de les dades de la imatge (SOS): la resta es copia tal qual
    if (marcador === 0xda) break
    const llargada = (jpeg[i + 2]! << 8) | jpeg[i + 3]!
    const fi = i + 2 + llargada
    const esMetadada = (marcador >= 0xe1 && marcador <= 0xef) || marcador === 0xfe
    if (!esMetadada) parts.push(jpeg.subarray(i, fi))
    i = fi
  }
  parts.push(jpeg.subarray(i))
  const r = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    r.set(p, o)
    o += p.length
  }
  return r
}

/** Hi ha cap segment EXIF (APP1 «Exif») abans de la imatge? */
export function teExif(jpeg: Uint8Array): boolean {
  let i = 2
  while (i + 10 <= jpeg.length && jpeg[i] === 0xff && jpeg[i + 1] !== 0xda) {
    const llargada = (jpeg[i + 2]! << 8) | jpeg[i + 3]!
    if (jpeg[i + 1] === 0xe1 && String.fromCharCode(...jpeg.subarray(i + 4, i + 8)) === 'Exif') return true
    i += 2 + llargada
  }
  return false
}

/** Les fotos que es veuen (sense les esborrades), de la més recent a la més antiga */
export function visibles<F extends Pick<DadesFoto, 'esborrada' | 'presaAt'>>(fotos: readonly F[]): F[] {
  return fotos.filter((f) => !f.esborrada).sort((a, b) => b.presaAt.localeCompare(a.presaAt))
}
