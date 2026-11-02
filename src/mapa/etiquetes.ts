// Col·locació d'etiquetes sense que se superposin entre elles ni tapin cap
// punt. Cada etiqueta prova diverses posicions al voltant del seu punt,
// començant pel costat de fora (els punts de la meitat esquerra del grup,
// a l'esquerra; els de la dreta, a la dreta), perquè les etiquetes de dues
// columnes properes (BL31–BL35 al sacre) no es barregin. Si no en troba cap
// de lliure, no es mostra. Les primeres de la llista (més importants) trien
// primer. Una entrada sense text no porta etiqueta, però el seu punt també
// ocupa lloc.

export interface EtiquetaEntrada {
  id: string
  /** Posició del punt a la pantalla (px) */
  x: number
  y: number
  text: string
  /** Text més curt (només el codi) per si el llarg no hi cap */
  curt?: string
  /** Radi del punt a la pantalla (px); per defecte, RADI_PUNT */
  radi?: number
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

/** Mida del punt dibuixat (px): les etiquetes no el poden tapar */
const RADI_PUNT = 5

const solapen = (a: Rect, b: Rect, aire = 2) =>
  a.x1 < b.x2 + aire && b.x1 < a.x2 + aire && a.y1 < b.y2 + aire && b.y1 < a.y2 + aire

export function colocarEtiquetes(
  entrades: readonly EtiquetaEntrada[],
  amplada: number,
  alcada: number,
  mida: MidaEtiquetes = MIDA_PER_DEFECTE,
): EtiquetaColocada[] {
  // Els punts mateixos també ocupen lloc: cap etiqueta en pot tapar cap
  const punts: Array<Rect & { id: string }> = entrades.map((e) => {
    const r = Math.max(RADI_PUNT, e.radi ?? 0)
    return { id: e.id, x1: e.x - r, y1: e.y - r, x2: e.x + r, y2: e.y + r }
  })
  const centre = entrades.reduce((s, e) => s + e.x, 0) / Math.max(1, entrades.length)
  const ocupats: Rect[] = []
  const resultat: EtiquetaColocada[] = []
  for (const e of entrades) {
    if (!e.text) continue
    const textos = e.curt && e.curt !== e.text ? [e.text, e.curt] : [e.text]
    for (const text of textos) {
      const r = colocarUna(e, text, centre, punts, ocupats, amplada, alcada, mida)
      if (!r) continue
      ocupats.push(r)
      resultat.push({ id: e.id, text, esquerra: Math.round(r.x1), dalt: Math.round(r.y1) })
      break
    }
  }
  return resultat
}

function colocarUna(
  e: EtiquetaEntrada,
  text: string,
  centre: number,
  punts: ReadonlyArray<Rect & { id: string }>,
  ocupats: readonly Rect[],
  amplada: number,
  alcada: number,
  mida: MidaEtiquetes,
): Rect | null {
  const w = text.length * mida.caracter + mida.marge
  const h = mida.alt
  // La separació creix amb el punt: l'etiqueta no el toca
  const s = Math.max(mida.separacio, (e.radi ?? 0) + 4)
  const dreta: Array<[number, number]> = [
    [e.x + s, e.y - h / 2],
    [e.x + s, e.y - h - 1], // dreta, una mica amunt
    [e.x + s, e.y + 1], // dreta, una mica avall
  ]
  const esquerra: Array<[number, number]> = [
    [e.x - s - w, e.y - h / 2],
    [e.x - s - w, e.y - h - 1],
    [e.x - s - w, e.y + 1],
  ]
  const candidats: Array<[number, number]> = [
    ...(e.x < centre ? [...esquerra, ...dreta] : [...dreta, ...esquerra]),
    [e.x - w / 2, e.y - s - h], // dalt
    [e.x - w / 2, e.y + s], // baix
  ]
  for (const [x, y] of candidats) {
    const r = { x1: x, y1: y, x2: x + w, y2: y + h }
    if (r.x1 < 0 || r.y1 < 0 || r.x2 > amplada || r.y2 > alcada) continue
    if (ocupats.some((o) => solapen(o, r))) continue
    if (punts.some((o) => o.id !== e.id && solapen(o, r, 0))) continue
    return r
  }
  return null
}
