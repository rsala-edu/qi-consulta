// Xifratge de dades amb AES-GCM 256. Cada xifratge fa servir un IV aleatori
// nou de 12 bytes. Les «dades associades» (context) lliguen el text xifrat al
// registre on es guarda: si algú el copia a un altre registre, no es desxifra.

import { base64ABytes, bytesABase64, bytesAleatoris, bytesAText, textABytes } from './codificacio'

export const MIDA_IV = 12

export interface DadesXifrades {
  /** IV en base64 */
  iv: string
  /** Text xifrat més l'etiqueta d'autenticació, en base64 */
  dades: string
}

export class ErrorDesxifratge extends Error {
  constructor() {
    super('No s\'han pogut desxifrar les dades')
    this.name = 'ErrorDesxifratge'
  }
}

export async function xifrar(
  clau: CryptoKey,
  bytes: Uint8Array<ArrayBuffer>,
  context: string,
): Promise<DadesXifrades> {
  const iv = bytesAleatoris(MIDA_IV)
  const xifrat = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: textABytes(context) },
    clau,
    bytes,
  )
  return { iv: bytesABase64(iv), dades: bytesABase64(new Uint8Array(xifrat)) }
}

export async function desxifrar(
  clau: CryptoKey,
  xifrat: DadesXifrades,
  context: string,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const clar = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ABytes(xifrat.iv), additionalData: textABytes(context) },
      clau,
      base64ABytes(xifrat.dades),
    )
    return new Uint8Array(clar)
  } catch {
    throw new ErrorDesxifratge()
  }
}

export async function xifrarJson(clau: CryptoKey, valor: unknown, context: string): Promise<DadesXifrades> {
  return xifrar(clau, textABytes(JSON.stringify(valor)), context)
}

export async function desxifrarJson(clau: CryptoKey, xifrat: DadesXifrades, context: string): Promise<unknown> {
  return JSON.parse(bytesAText(await desxifrar(clau, xifrat, context)))
}
