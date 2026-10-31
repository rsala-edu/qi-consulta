// Clau mestra (clau de dades) i el seu embolcall.
//
// - La clau mestra és una clau AES-GCM 256 aleatòria que xifra totes les dades.
// - Es guarda «embolcallada» (wrapKey) amb una clau derivada de la contrasenya.
// - wrapKey exigeix que la clau embolcallada sigui extractable. Per això només
//   existeix una còpia extractable en dos moments, i sempre dins d'aquest mòdul
//   i durant una sola funció: en crear-la i en canviar la contrasenya.
// - En l'ús normal (desbloquejar) es desembolcalla com a NO extractable: el
//   codi de l'app la pot fer servir per xifrar i desxifrar, però no la pot llegir.

import { base64ABytes, bytesABase64, bytesAleatoris } from './codificacio'
import { MIDA_IV } from './aesGcm'
import { derivarClauEmbolcall, generarSal, ITERACIONS_PBKDF2 } from './derivacio'

export interface ClauEmbolcallada {
  versio: 1
  kdf: 'PBKDF2-SHA256'
  iteracions: number
  /** base64 */
  sal: string
  /** base64 */
  iv: string
  /** clau mestra embolcallada amb AES-GCM, en base64 */
  clau: string
}

export class ErrorContrasenya extends Error {
  constructor() {
    super('Contrasenya incorrecta')
    this.name = 'ErrorContrasenya'
  }
}

const ALGORISME = { name: 'AES-GCM', length: 256 } as const
const USOS: KeyUsage[] = ['encrypt', 'decrypt']
/** Lliga l'embolcall al seu propòsit (dades associades d'AES-GCM). */
const CONTEXT_EMBOLCALL = new TextEncoder().encode('qi:clau-mestra:v1')

async function embolcallar(
  clauExtractable: CryptoKey,
  contrasenya: string,
  iteracions: number,
): Promise<{ embolcall: ClauEmbolcallada; kek: CryptoKey }> {
  const sal = generarSal()
  const iv = bytesAleatoris(MIDA_IV)
  const kek = await derivarClauEmbolcall(contrasenya, sal, iteracions)
  const embolcallada = await crypto.subtle.wrapKey('raw', clauExtractable, kek, {
    name: 'AES-GCM',
    iv,
    additionalData: CONTEXT_EMBOLCALL,
  })
  const embolcall: ClauEmbolcallada = {
    versio: 1,
    kdf: 'PBKDF2-SHA256',
    iteracions,
    sal: bytesABase64(sal),
    iv: bytesABase64(iv),
    clau: bytesABase64(new Uint8Array(embolcallada)),
  }
  return { embolcall, kek }
}

async function desembolcallar(
  embolcall: ClauEmbolcallada,
  contrasenya: string,
  extractable: boolean,
): Promise<CryptoKey> {
  const kek = await derivarClauEmbolcall(contrasenya, base64ABytes(embolcall.sal), embolcall.iteracions)
  return desembolcallarAmbKek(embolcall, kek, extractable)
}

async function desembolcallarAmbKek(
  embolcall: ClauEmbolcallada,
  kek: CryptoKey,
  extractable: boolean,
): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      base64ABytes(embolcall.clau),
      kek,
      { name: 'AES-GCM', iv: base64ABytes(embolcall.iv), additionalData: CONTEXT_EMBOLCALL },
      ALGORISME,
      extractable,
      USOS,
    )
  } catch {
    // AES-GCM falla l'autenticació si la contrasenya (i per tant la KEK) és errònia
    throw new ErrorContrasenya()
  }
}

/**
 * Crea una clau mestra nova. Retorna l'embolcall (per guardar) i una còpia
 * no extractable (per fer servir). La còpia extractable no surt d'aquí.
 */
export async function crearClauMestra(
  contrasenya: string,
  iteracions: number = ITERACIONS_PBKDF2,
): Promise<{ embolcall: ClauEmbolcallada; clau: CryptoKey }> {
  const extractable = await crypto.subtle.generateKey(ALGORISME, true, USOS)
  const { embolcall, kek } = await embolcallar(extractable, contrasenya, iteracions)
  // Desembolcallem amb la mateixa KEK com a no extractable: no cal tornar a
  // derivar la contrasenya i els bytes de la clau mai passen per JavaScript.
  const clau = await desembolcallarAmbKek(embolcall, kek, false)
  return { embolcall, clau }
}

/** Ús normal: desembolcalla la clau mestra com a NO extractable. */
export async function desbloquejarClauMestra(
  embolcall: ClauEmbolcallada,
  contrasenya: string,
): Promise<CryptoKey> {
  return desembolcallar(embolcall, contrasenya, false)
}

/**
 * Torna a embolcallar la mateixa clau mestra amb una contrasenya nova (i sal nova).
 * Les dades no s'han de tornar a xifrar. Cal la contrasenya actual.
 */
export async function canviarContrasenya(
  embolcall: ClauEmbolcallada,
  contrasenyaActual: string,
  contrasenyaNova: string,
  iteracions: number = ITERACIONS_PBKDF2,
): Promise<ClauEmbolcallada> {
  const extractable = await desembolcallar(embolcall, contrasenyaActual, true)
  const { embolcall: nou } = await embolcallar(extractable, contrasenyaNova, iteracions)
  return nou
}
