// Derivació de la clau d'embolcall a partir de la contrasenya (PBKDF2-SHA256).
// La clau resultant no és extractable i només serveix per embolcallar i
// desembolcallar la clau mestra; mai xifra dades directament.

import { bytesAleatoris, textABytes } from './codificacio'

/** Recomanació OWASP (2023) per a PBKDF2-HMAC-SHA256. */
export const ITERACIONS_PBKDF2 = 600_000
export const MIDA_SAL = 16

/**
 * Iteracions per a un embolcall nou (contrasenya nova o canviada). Sempre
 * ITERACIONS_PBKDF2, llevat del servidor de desenvolupament i del build de
 * proves (`vite build --mode proves`), on les proves E2E les poden baixar
 * (localStorage `qi:proves:iteracions`) perquè cada contrasenya no trigui mig
 * segon. El build publicat no conté aquesta branca (la condició es resol en
 * compilar), i en arrencar comprova que són 600.000 (comprovarIteracions).
 */
export function iteracionsNoves(): number {
  if (import.meta.env.DEV || import.meta.env.MODE === 'proves') {
    try {
      const n = Number(localStorage.getItem('qi:proves:iteracions'))
      if (Number.isInteger(n) && n > 0) return n
    } catch {
      // sense localStorage: les de debò
    }
  }
  return ITERACIONS_PBKDF2
}

/** Al build publicat, l'app no arrenca si les iteracions no són les de debò */
export function comprovarIteracions(): void {
  if (import.meta.env.PROD && import.meta.env.MODE !== 'proves' && iteracionsNoves() !== ITERACIONS_PBKDF2) {
    throw new Error(`PBKDF2: ${iteracionsNoves()} iteracions en lloc de ${ITERACIONS_PBKDF2}`)
  }
}
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
