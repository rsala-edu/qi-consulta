// Empremta o cara (passkey) amb l'extensió PRF de WebAuthn. L'autenticador
// (Android, iPad, Windows Hello) retorna un secret de 32 bytes que només surt
// si la doctora es verifica; amb aquest secret s'obre la clau mestra.
//
// No hi ha cap servidor: el repte és aleatori i no es verifica cap signatura.
// La seguretat ve del PRF: sense l'autenticador no hi ha secret.

import { bytesAleatoris } from './codificacio'

export class ErrorSensePrf extends Error {
  constructor() {
    super('Aquest autenticador no ofereix PRF')
    this.name = 'ErrorSensePrf'
  }
}

export class ErrorPasskeyCancellada extends Error {
  constructor() {
    super('S\'ha cancel·lat la verificació')
    this.name = 'ErrorPasskeyCancellada'
  }
}

interface ResultatsPrf {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | ArrayBufferView } }
}

/** Hi ha un autenticador del dispositiu (empremta, cara, Windows Hello)? */
export async function passkeyDisponible(): Promise<boolean> {
  if (typeof PublicKeyCredential === 'undefined') return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function aBytes(v: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  const b = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  return new Uint8Array(b)
}

async function demanar<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) throw new ErrorPasskeyCancellada()
    throw e
  }
}

function base64url(b: Uint8Array<ArrayBuffer>): string {
  let binari = ''
  for (const x of b) binari += String.fromCharCode(x)
  return btoa(binari).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Secret PRF d'una de les passkeys de Qi (pot n'hi haver una per dispositiu).
 * Torna també quina credencial ha respost.
 */
export async function secretPasskey(
  passkeys: ReadonlyArray<{ credencial: Uint8Array<ArrayBuffer>; salPrf: Uint8Array<ArrayBuffer> }>,
): Promise<{ credencial: Uint8Array<ArrayBuffer>; secret: Uint8Array<ArrayBuffer> }> {
  const evalByCredential = Object.fromEntries(passkeys.map((p) => [base64url(p.credencial), { first: p.salPrf }]))
  const cred = (await demanar(() =>
    navigator.credentials.get({
      publicKey: {
        challenge: bytesAleatoris(32),
        allowCredentials: passkeys.map((p) => ({ type: 'public-key' as const, id: p.credencial })),
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
      },
    }),
  )) as PublicKeyCredential | null
  const first = (cred?.getClientExtensionResults() as ResultatsPrf | undefined)?.prf?.results?.first
  if (!cred || !first) throw new ErrorSensePrf()
  return { credencial: aBytes(cred.rawId), secret: aBytes(first) }
}

/**
 * Crea una passkey per a Qi en aquest dispositiu i en treu el secret PRF.
 * Si l'autenticador no ofereix PRF (alguns gestors externs), llança ErrorSensePrf.
 */
export async function crearPasskey(): Promise<{
  credencial: Uint8Array<ArrayBuffer>
  salPrf: Uint8Array<ArrayBuffer>
  secret: Uint8Array<ArrayBuffer>
}> {
  const salPrf = bytesAleatoris(32)
  const cred = (await demanar(() =>
    navigator.credentials.create({
      publicKey: {
        challenge: bytesAleatoris(32),
        rp: { name: 'Qi' },
        user: { id: bytesAleatoris(16), name: 'Qi', displayName: 'Qi' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        timeout: 60_000,
        extensions: { prf: { eval: { first: salPrf } } } as AuthenticationExtensionsClientInputs,
      },
    }),
  )) as PublicKeyCredential | null
  if (!cred) throw new ErrorPasskeyCancellada()
  const resultats = cred.getClientExtensionResults() as ResultatsPrf
  if (resultats.prf?.enabled === false) throw new ErrorSensePrf()
  const credencial = aBytes(cred.rawId)
  // Alguns autenticadors ja donen el secret en crear-la; si no, es demana ara
  const first = resultats.prf?.results?.first
  const secret = first ? aBytes(first) : (await secretPasskey([{ credencial, salPrf }])).secret
  return { credencial, salPrf, secret }
}
