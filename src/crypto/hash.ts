// Hash del correu (SHA-256 en hexadecimal del correu en minúscules). L'app
// només guarda aquest hash per saber quin compte de Google pot entrar: el
// correu de la doctora no apareix enlloc en clar.

import { textABytes } from './codificacio'

export async function hashCorreu(correu: string): Promise<string> {
  const resum = await crypto.subtle.digest('SHA-256', textABytes(correu.trim().toLowerCase()))
  return [...new Uint8Array(resum)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
