// Documents adjunts (etapa 4E): informes, analítiques, audiometries i altres
// proves, en PDF o en imatge. Com les fotos: les metadades (tipus, títol, data,
// vincles i una miniatura petita) se sincronitzen amb la resta, i el fitxer
// sencer va xifrat a part (a Drive, un fitxer per document, qi-imatge-<id>.json,
// que només es baixa quan s'obre).
//
// Anul·lar un document no l'esborra: deixa de mostrar-se, però es conserven el
// registre (quan i per què) i el fitxer xifrat, perquè la història clínica
// s'ha de conservar. L'esborrat definitiu només és per a un pacient sencer.

import { z } from 'zod'
import type { Registre } from './registre'

export const TIPUS_DOCUMENT = ['informe', 'analitica', 'audiometria', 'imatge', 'altre'] as const
export type TipusDocument = (typeof TIPUS_DOCUMENT)[number]

export const FORMATS_DOCUMENT = ['pdf', 'jpeg'] as const
export type FormatDocument = (typeof FORMATS_DOCUMENT)[number]

/** Mida màxima de cada fitxer que s'afegeix (abans de reduir les imatges) */
export const MIDA_MAXIMA = 25 * 1024 * 1024
/** Les imatges dels documents, prou grans per llegir-ne el text */
export const COSTAT_MAXIM_DOCUMENT = 2400
export const QUALITAT_DOCUMENT = 0.85
/** Fitxers de documents que es guarden al dispositiu per obrir-los sense xarxa (els més recents) */
export const DOCUMENTS_EN_LOCAL = 30

export const esquemaDadesDocument = z.object({
  tipus: z.enum(TIPUS_DOCUMENT),
  titol: z.string().trim().min(1).max(200),
  /** Data del document (no la del dia que s'afegeix): «2026-11-02» */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nota: z.string(),
  episodiId: z.string().nullable(),
  /** Vincle opcional a una sessió o a una valoració */
  sessioId: z.string().nullable().default(null),
  valoracioId: z.string().nullable().default(null),
  format: z.enum(FORMATS_DOCUMENT),
  /** Pàgines (PDF) */
  pagines: z.number().int().min(1).default(1),
  /** Bytes del fitxer desat */
  mida: z.number().int().nonnegative(),
  /** Miniatura (JPEG en data URL, uns pocs kB); buida si no se n'ha pogut fer (es mostra la icona del tipus) */
  miniatura: z.string(),
  /** Quan s'ha afegit (ISO) */
  afegitAt: z.string(),
  /** D'on ve: càmera de l'app, fitxer, o «Compartir» d'una altra app */
  origen: z.enum(['camera', 'fitxer', 'compartit']).default('fitxer'),
  /** Anul·lat: no es mostra, però es conserven el registre i el fitxer */
  anullat: z.object({ at: z.string(), motiu: z.string().trim().min(1) }).nullable().default(null),
})
export type DadesDocument = z.infer<typeof esquemaDadesDocument>
export type Document = Registre & { pacientId: string } & DadesDocument

/** Els que es mostren (sense els anul·lats), del més recent (per la data del document) al més antic */
export function vigents<D extends Pick<DadesDocument, 'anullat' | 'data' | 'afegitAt'>>(docs: readonly D[]): D[] {
  return docs.filter((d) => !d.anullat).sort((a, b) => b.data.localeCompare(a.data) || b.afegitAt.localeCompare(a.afegitAt))
}

/** Anul·lar: amb el motiu i la data; no es pot anul·lar dues vegades */
export function anullar(d: DadesDocument, motiu: string, ara: string): DadesDocument {
  if (d.anullat) throw new Error('Aquest document ja està anul·lat')
  if (!motiu.trim()) throw new Error('Cal el motiu de l\'anul·lació')
  return { ...d, anullat: { at: ara, motiu: motiu.trim() } }
}

/** Títol per defecte a partir del nom del fitxer: «analitica_novembre.pdf» → «Analitica novembre» */
export function titolDeFitxer(nom: string): string {
  const t = nom
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t ? t.charAt(0).toLocaleUpperCase('ca') + t.slice(1) : ''
}

export type ClasseFitxer = 'pdf' | 'imatge' | 'heic' | 'desconegut'

/** Què és un fitxer, pel tipus MIME, l'extensió o els primers bytes */
export function classeFitxer(nom: string, tipusMime: string, inici?: Uint8Array): ClasseFitxer {
  const ext = nom.toLowerCase().split('.').pop() ?? ''
  if (inici && inici.length >= 5 && String.fromCharCode(...inici.subarray(0, 5)) === '%PDF-') return 'pdf'
  if (tipusMime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/^image\/(heic|heif)/.test(tipusMime) || ext === 'heic' || ext === 'heif') return 'heic'
  if (inici && inici.length >= 12 && String.fromCharCode(...inici.subarray(4, 12)).match(/^ftyp(heic|heix|mif1|heif)/)) return 'heic'
  if (tipusMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return 'imatge'
  return 'desconegut'
}

/** «2,4 MB», «380 kB» */
export function midaLlegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('ca', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('ca')} kB`
}

/** Les pàgines d'un escaneig, en l'ordre en què es desaran */
export function moure<T>(llista: readonly T[], de: number, a: number): T[] {
  if (a < 0 || a >= llista.length || de === a) return [...llista]
  const r = [...llista]
  const [x] = r.splice(de, 1)
  r.splice(a, 0, x!)
  return r
}
