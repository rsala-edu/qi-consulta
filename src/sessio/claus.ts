// Operacions amb les claus del dispositiu: activar l'empremta, generar la
// clau de recuperació i recuperar l'accés si s'oblida la contrasenya.
// Tot el xifratge passa per src/crypto.

import {
  afegirEmbolcallSecret,
  base64ABytes,
  bytesABase64,
  contrasenyaNovaAmbSecret,
  crearPasskey,
  desbloquejarAmbSecret,
  desbloquejarClauMestra,
  generarSecretRecuperacio,
  llegirClauRecuperacio,
  secretPasskey,
  textClauRecuperacio,
  type ClauEmbolcallada,
  type EmbolcallSecret,
} from '../crypto'
import type { QiDB } from '../db/esquema'
import { guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada, llegirSecrets } from '../db/magatzem'

export class ErrorClauRecuperacio extends Error {
  constructor() {
    super('La clau de recuperació no és vàlida')
    this.name = 'ErrorClauRecuperacio'
  }
}

async function embolcallActual(db: QiDB): Promise<ClauEmbolcallada> {
  const e = await llegirClauEmbolcallada(db)
  if (!e) throw new Error('No hi ha contrasenya')
  return e
}

export async function teEmpremta(db: QiDB): Promise<boolean> {
  return (await llegirSecrets(db)).some((s) => s.tipus === 'passkey')
}

export async function teClauRecuperacio(db: QiDB): Promise<boolean> {
  return (await llegirSecrets(db)).some((s) => s.tipus === 'recuperacio')
}

/** Activa l'empremta en aquest dispositiu. Cal la contrasenya. */
export async function activarEmpremta(db: QiDB, contrasenya: string): Promise<void> {
  const embolcall = await embolcallActual(db)
  // Primer es comprova la contrasenya, abans de demanar l'empremta
  await desbloquejarClauMestra(embolcall, contrasenya)
  const { credencial, salPrf, secret } = await crearPasskey()
  const nou = await afegirEmbolcallSecret(embolcall, contrasenya, secret, {
    tipus: 'passkey',
    credencial: bytesABase64(credencial),
    salPrf: bytesABase64(salPrf),
  })
  await guardarSecrets(db, [...(await llegirSecrets(db)), nou])
}

/** Treu l'empremta (de tots els dispositius): es tornarà a entrar amb la contrasenya. */
export async function desactivarEmpremta(db: QiDB): Promise<void> {
  await guardarSecrets(db, (await llegirSecrets(db)).filter((s) => s.tipus !== 'passkey'))
}

export async function desbloquejarAmbEmpremta(db: QiDB): Promise<CryptoKey> {
  const passkeys = (await llegirSecrets(db)).filter((s) => s.tipus === 'passkey' && s.credencial && s.salPrf)
  const { credencial, secret } = await secretPasskey(
    passkeys.map((p) => ({ credencial: base64ABytes(p.credencial!), salPrf: base64ABytes(p.salPrf!) })),
  )
  const qui = bytesABase64(credencial)
  const embolcall = passkeys.find((p) => p.credencial === qui)
  if (!embolcall) throw new Error('Passkey desconeguda')
  return desbloquejarAmbSecret(embolcall, secret)
}

/**
 * Genera una clau de recuperació nova (l'anterior deixa de valer) i en torna
 * el text per imprimir. Cal la contrasenya.
 */
export async function novaClauRecuperacio(db: QiDB, contrasenya: string): Promise<string> {
  const secret = generarSecretRecuperacio()
  const nou = await afegirEmbolcallSecret(await embolcallActual(db), contrasenya, secret, { tipus: 'recuperacio' })
  await guardarSecrets(db, [...(await llegirSecrets(db)).filter((s) => s.tipus !== 'recuperacio'), nou])
  return textClauRecuperacio(secret)
}

/**
 * Contrasenya oblidada: amb la clau de recuperació es posa una contrasenya
 * nova. Torna la clau mestra (no extractable) per obrir l'app.
 */
export async function recuperarAmbClau(
  db: QiDB,
  text: string,
  contrasenyaNova: string,
  secrets?: readonly EmbolcallSecret[],
): Promise<CryptoKey> {
  const secret = llegirClauRecuperacio(text)
  if (!secret) throw new ErrorClauRecuperacio()
  const e = (secrets ?? (await llegirSecrets(db))).find((s) => s.tipus === 'recuperacio')
  if (!e) throw new ErrorClauRecuperacio()
  try {
    const { embolcall, clau } = await contrasenyaNovaAmbSecret(e, secret, contrasenyaNova)
    await guardarClauEmbolcallada(db, embolcall)
    return clau
  } catch {
    throw new ErrorClauRecuperacio()
  }
}
