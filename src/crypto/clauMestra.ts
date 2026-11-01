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

// --- Altres maneres d'obrir la mateixa clau mestra -------------------------
//
// L'empremta (passkey amb PRF) i la clau de recuperació impresa donen un
// secret aleatori de 32 bytes. D'aquest secret es deriva (HKDF-SHA256) una
// clau que embolcalla la mateixa clau mestra. Per crear aquests embolcalls cal
// la contrasenya (la clau mestra només és extractable dins d'aquest mòdul).

export type TipusSecret = 'passkey' | 'recuperacio'

export interface EmbolcallSecret {
  versio: 1
  tipus: TipusSecret
  /** Identificador de l'embolcall (UUID) */
  id: string
  creatAt: string
  /** base64 */
  sal: string
  /** base64 */
  iv: string
  /** clau mestra embolcallada, en base64 */
  clau: string
  /** Passkey: id de la credencial (base64) */
  credencial?: string
  /** Passkey: entrada del PRF (base64) */
  salPrf?: string
}

export class ErrorSecret extends Error {
  constructor() {
    super('El secret no obre la clau mestra')
    this.name = 'ErrorSecret'
  }
}

const contextSecret = (tipus: TipusSecret) => new TextEncoder().encode(`qi:clau-mestra:${tipus}:v1`)

async function kekDeSecret(secret: Uint8Array<ArrayBuffer>, sal: Uint8Array<ArrayBuffer>, tipus: TipusSecret): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: sal, info: contextSecret(tipus) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

async function embolcallarAmbSecret(
  extractable: CryptoKey,
  secret: Uint8Array<ArrayBuffer>,
  dades: Pick<EmbolcallSecret, 'tipus' | 'credencial' | 'salPrf'>,
): Promise<EmbolcallSecret> {
  const sal = bytesAleatoris(16)
  const iv = bytesAleatoris(MIDA_IV)
  const kek = await kekDeSecret(secret, sal, dades.tipus)
  const clau = await crypto.subtle.wrapKey('raw', extractable, kek, {
    name: 'AES-GCM',
    iv,
    additionalData: contextSecret(dades.tipus),
  })
  return {
    versio: 1,
    ...dades,
    id: crypto.randomUUID(),
    creatAt: new Date().toISOString(),
    sal: bytesABase64(sal),
    iv: bytesABase64(iv),
    clau: bytesABase64(new Uint8Array(clau)),
  }
}

async function obrirAmbSecret(e: EmbolcallSecret, secret: Uint8Array<ArrayBuffer>, extractable: boolean): Promise<CryptoKey> {
  const kek = await kekDeSecret(secret, base64ABytes(e.sal), e.tipus)
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      base64ABytes(e.clau),
      kek,
      { name: 'AES-GCM', iv: base64ABytes(e.iv), additionalData: contextSecret(e.tipus) },
      ALGORISME,
      extractable,
      USOS,
    )
  } catch {
    throw new ErrorSecret()
  }
}

/** Afegeix una manera d'obrir la clau mestra (empremta o clau de recuperació). Cal la contrasenya. */
export async function afegirEmbolcallSecret(
  embolcall: ClauEmbolcallada,
  contrasenya: string,
  secret: Uint8Array<ArrayBuffer>,
  dades: Pick<EmbolcallSecret, 'tipus' | 'credencial' | 'salPrf'>,
): Promise<EmbolcallSecret> {
  const extractable = await desembolcallar(embolcall, contrasenya, true)
  return embolcallarAmbSecret(extractable, secret, dades)
}

/** Ús normal amb l'empremta: la clau mestra NO extractable. */
export async function desbloquejarAmbSecret(e: EmbolcallSecret, secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return obrirAmbSecret(e, secret, false)
}

/**
 * Contrasenya oblidada: amb la clau de recuperació s'embolcalla la mateixa
 * clau mestra amb una contrasenya nova. Les dades no canvien.
 */
export async function contrasenyaNovaAmbSecret(
  e: EmbolcallSecret,
  secret: Uint8Array<ArrayBuffer>,
  contrasenyaNova: string,
  iteracions: number = ITERACIONS_PBKDF2,
): Promise<{ embolcall: ClauEmbolcallada; clau: CryptoKey }> {
  const extractable = await obrirAmbSecret(e, secret, true)
  const { embolcall, kek } = await embolcallar(extractable, contrasenyaNova, iteracions)
  return { embolcall, clau: await desembolcallarAmbKek(embolcall, kek, false) }
}
