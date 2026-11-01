// Clau de recuperació per imprimir: 32 bytes aleatoris escrits en base32 de
// Crockford (sense I, L, O ni U, que es confonen), en grups de 4 caràcters.
// Si la doctora oblida la contrasenya, aquesta clau obre la clau mestra.

import { bytesAleatoris } from './codificacio'

const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const MIDA_SECRET = 32
/** 32 bytes = 256 bits → 52 caràcters de 5 bits */
const CARACTERS = Math.ceil((MIDA_SECRET * 8) / 5)

export function generarSecretRecuperacio(): Uint8Array<ArrayBuffer> {
  return bytesAleatoris(MIDA_SECRET)
}

export function textClauRecuperacio(secret: Uint8Array<ArrayBuffer>): string {
  let bits = 0
  let valor = 0
  let text = ''
  for (const b of secret) {
    valor = (valor << 8) | b
    bits += 8
    while (bits >= 5) {
      text += ALFABET[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) text += ALFABET[(valor << (5 - bits)) & 31]
  return text.match(/.{1,4}/g)!.join('-')
}

/** Llegeix la clau tal com l'escrigui la doctora (minúscules, espais, O per 0…). Null si no és vàlida. */
export function llegirClauRecuperacio(text: string): Uint8Array<ArrayBuffer> | null {
  const net = text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (net.length !== CARACTERS || [...net].some((c) => !ALFABET.includes(c))) return null
  const bytes = new Uint8Array(MIDA_SECRET)
  let bits = 0
  let valor = 0
  let i = 0
  for (const c of net) {
    valor = ((valor << 5) | ALFABET.indexOf(c)) & 0xffff
    bits += 5
    if (bits >= 8) {
      if (i < MIDA_SECRET) bytes[i++] = (valor >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  return bytes
}
