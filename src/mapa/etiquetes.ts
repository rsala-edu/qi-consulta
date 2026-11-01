// Col·locació d'etiquetes sense que se superposin. Cada etiqueta prova
// diverses posicions al voltant del seu punt (dreta, esquerra, dalt, baix);
// si no en troba cap de lliure, no es mostra. Les primeres de la llista
// (més importants) trien primer.

export interface EtiquetaEntrada {
  id: string
  /** Posició del punt a la pantalla (px) */
  x: number
  y: number
  text: string
}

export interface EtiquetaColocada {
  id: string
  text: string
  /** Cantonada superior esquerra de l'etiqueta (px) */
  esquerra: number
  dalt: number
}

export interface MidaEtiquetes {
  /** Amplada aproximada d'un caràcter (px) */
  caracter: number
  /** Alçada de l'etiqueta (px) */
  alt: number
  /** Marge interior horitzontal total (px) */
  marge: number
  /** Separació respecte del punt (px) */
  separacio: number
}

export const MIDA_PER_DEFECTE: MidaEtiquetes = { caracter: 6.6, alt: 18, marge: 12, separacio: 9 }

interface Rect {
  x1: number
  y1: number
  x2: number
  y2: number
}

const solapen = (a: Rect, b: Rect, aire = 2) =>
  a.x1 < b.x2 + aire && b.x1 < a.x2 + aire && a.y1 < b.y2 + aire && b.y1 < a.y2 + aire

export function colocarEtiquetes(
  entrades: readonly EtiquetaEntrada[],
  amplada: number,
  alcada: number,
  mida: MidaEtiquetes = MIDA_PER_DEFECTE,
): EtiquetaColocada[] {
  const ocupats: Rect[] = []
  const resultat: EtiquetaColocada[] = []
  for (const e of entrades) {
    const w = e.text.length * mida.caracter + mida.marge
    const h = mida.alt
    const s = mida.separacio
    const candidats: Array<[number, number]> = [
      [e.x + s, e.y - h / 2], // dreta
      [e.x - s - w, e.y - h / 2], // esquerra
      [e.x - w / 2, e.y - s - h], // dalt
      [e.x - w / 2, e.y + s], // baix
    ]
    for (const [x, y] of candidats) {
      const r = { x1: x, y1: y, x2: x + w, y2: y + h }
      if (r.x1 < 0 || r.y1 < 0 || r.x2 > amplada || r.y2 > alcada) continue
      if (ocupats.some((o) => solapen(o, r))) continue
      ocupats.push(r)
      resultat.push({ id: e.id, text: e.text, esquerra: Math.round(x), dalt: Math.round(y) })
      break
    }
  }
  return resultat
}
