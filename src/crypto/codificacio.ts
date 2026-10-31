// Conversions entre text, bytes i base64. No hi ha res secret aquí.

const codificador = new TextEncoder()
const descodificador = new TextDecoder()

export function textABytes(text: string): Uint8Array<ArrayBuffer> {
  return codificador.encode(text)
}

export function bytesAText(bytes: Uint8Array<ArrayBuffer>): string {
  return descodificador.decode(bytes)
}

export function bytesABase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binari = ''
  for (const b of bytes) binari += String.fromCharCode(b)
  return btoa(binari)
}

export function base64ABytes(base64: string): Uint8Array<ArrayBuffer> {
  const binari = atob(base64)
  const bytes = new Uint8Array(binari.length)
  for (let i = 0; i < binari.length; i++) bytes[i] = binari.charCodeAt(i)
  return bytes
}

export function bytesAleatoris(mida: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(mida))
}
