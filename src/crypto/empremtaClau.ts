// Identificador d'una clau mestra, per saber si dues còpies van tancades amb
// la mateixa clau sense haver de desxifrar res (i sense revelar-la).
//
// Es xifra un missatge buit amb un IV fix i reservat (tot zeros) i unes dades
// associades pròpies: el resultat (l'etiqueta d'AES-GCM, 16 bytes) depèn
// només de la clau. Se'n guarda el SHA-256, mai l'etiqueta. Cap altre xifratge
// fa servir aquest IV: tots els altres són aleatoris (aesGcm.ts), i la
// probabilitat que un d'aquests surti tot zeros és nul·la (2⁻⁹⁶).

import { textABytes } from './codificacio'

const CONTEXT = textABytes('qi:id-clau:v1')
const IV_RESERVAT = new Uint8Array(12)

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** SHA-256 (hex) de l'etiqueta: el mateix a tots els dispositius que tenen la mateixa clau */
export async function idClau(clau: CryptoKey): Promise<string> {
  const etiqueta = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: IV_RESERVAT, additionalData: CONTEXT }, clau, new Uint8Array(0))
  return hex(await crypto.subtle.digest('SHA-256', etiqueta))
}

/** Empremta curta per als detalls tècnics: 4 caràcters (mai la clau) */
export function empremtaCurta(id: string | null | undefined): string {
  return id ? id.slice(0, 4).toUpperCase() : '—'
}
