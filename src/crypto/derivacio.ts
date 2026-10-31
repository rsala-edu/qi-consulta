// Derivació de la clau d'embolcall a partir de la contrasenya (PBKDF2-SHA256).
// La clau resultant no és extractable i només serveix per embolcallar i
// desembolcallar la clau mestra; mai xifra dades directament.

import { bytesAleatoris, textABytes } from './codificacio'

/** Recomanació OWASP (2023) per a PBKDF2-HMAC-SHA256. */
export const ITERACIONS_PBKDF2 = 600_000
export const MIDA_SAL = 16

export function generarSal(): Uint8Array<ArrayBuffer> {
  return bytesAleatoris(MIDA_SAL)
}

export async function derivarClauEmbolcall(
  contrasenya: string,
  sal: Uint8Array<ArrayBuffer>,
  iteracions: number = ITERACIONS_PBKDF2,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    textABytes(contrasenya.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracions },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}
