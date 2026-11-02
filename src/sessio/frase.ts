// Tria de la frase de la pantalla d'entrada: a l'atzar i sense repetir la de
// la vegada anterior (que es recorda en aquest navegador).

import { FRASES_ENTRADA } from '../i18n/frases'

const CLAU = 'qi.fraseAnterior'

/** Índex a l'atzar entre 0 i n-1, diferent d'`anterior` (si n'hi ha més d'una) */
export function triarFrase(n: number, anterior: number | null, aleatori: () => number = Math.random): number {
  if (n <= 1) return 0
  const valida = anterior !== null && anterior >= 0 && anterior < n
  if (!valida) return Math.floor(aleatori() * n) % n
  // Es tria entre les altres n-1 i se salta l'anterior
  const i = Math.floor(aleatori() * (n - 1)) % (n - 1)
  return i >= anterior ? i + 1 : i
}

let triada: string | null = null

/** La frase d'aquesta obertura de l'app (la mateixa fins que es torna a obrir) */
export function fraseEntrada(): string {
  if (triada !== null) return triada
  let anterior: number | null = null
  try {
    const v = window.localStorage.getItem(CLAU)
    anterior = v === null ? null : Number(v)
  } catch {
    // Sense emmagatzematge (finestra privada): qualsevol frase
  }
  const i = triarFrase(FRASES_ENTRADA.length, Number.isInteger(anterior) ? anterior : null)
  try {
    window.localStorage.setItem(CLAU, String(i))
  } catch {
    // no passa res
  }
  triada = FRASES_ENTRADA[i]!
  return triada
}
