// Zoom i desplaçament del dibuix de l'orella, i pas de coordenades del dibuix
// a la pantalla. Les coordenades «del dibuix» són les de l'orella esquerra
// (src/orella/dibuix.ts); l'orella dreta es mostra en mirall.

/** Part del dibuix que es mostra sencera (amb marge per als noms de les zones) */
export const LIMITS = { x1: -20, x2: 360, y1: 0, y2: 466 } as const
export const ESCALA_MAXIMA = 6

export type CostatOrella = 'E' | 'D'

export interface Vista {
  /** 1 = l'orella sencera */
  escala: number
  /** Centre de la vista, en coordenades de pantalla del dibuix (ja en mirall si és la dreta) */
  cx: number
  cy: number
}

export interface Mida {
  amplada: number
  alcada: number
}

export const VISTA_INICIAL: Vista = {
  escala: 1,
  cx: (LIMITS.x1 + LIMITS.x2) / 2,
  cy: (LIMITS.y1 + LIMITS.y2) / 2,
}

/** L'orella dreta és el mirall de l'esquerra (respecte del centre del dibuix) */
export function mirallX(x: number, costat: CostatOrella): number {
  return costat === 'D' ? LIMITS.x1 + LIMITS.x2 - x : x
}

/** Unitats del dibuix per píxel */
export function unitatsPerPixel(v: Vista, m: Mida): number {
  const base = Math.max((LIMITS.x2 - LIMITS.x1) / m.amplada, (LIMITS.y2 - LIMITS.y1) / m.alcada)
  return base / v.escala
}

export function viewBox(v: Vista, m: Mida): string {
  const u = unitatsPerPixel(v, m)
  return `${v.cx - (m.amplada * u) / 2} ${v.cy - (m.alcada * u) / 2} ${m.amplada * u} ${m.alcada * u}`
}

export function aPantalla(v: Vista, m: Mida, x: number, y: number): { x: number; y: number } {
  const u = unitatsPerPixel(v, m)
  return { x: m.amplada / 2 + (x - v.cx) / u, y: m.alcada / 2 + (y - v.cy) / u }
}

export function desDePantalla(v: Vista, m: Mida, px: number, py: number): { x: number; y: number } {
  const u = unitatsPerPixel(v, m)
  return { x: v.cx + (px - m.amplada / 2) * u, y: v.cy + (py - m.alcada / 2) * u }
}

/** El centre no pot sortir del dibuix */
function limitar(v: Vista): Vista {
  const escala = Math.min(ESCALA_MAXIMA, Math.max(1, v.escala))
  if (escala === 1) return VISTA_INICIAL
  return {
    escala,
    cx: Math.min(LIMITS.x2, Math.max(LIMITS.x1, v.cx)),
    cy: Math.min(LIMITS.y2, Math.max(LIMITS.y1, v.cy)),
  }
}

/** Amplia (factor > 1) o redueix cap a un punt de la pantalla, que es queda on és */
export function ampliar(v: Vista, m: Mida, factor: number, px = m.amplada / 2, py = m.alcada / 2): Vista {
  const p = desDePantalla(v, m, px, py)
  const escala = Math.min(ESCALA_MAXIMA, Math.max(1, v.escala * factor))
  const real = escala / v.escala
  return limitar({ escala, cx: p.x + (v.cx - p.x) / real, cy: p.y + (v.cy - p.y) / real })
}

/** Desplaça la vista seguint el dit (dx, dy en píxels) */
export function desplacar(v: Vista, m: Mida, dx: number, dy: number): Vista {
  const u = unitatsPerPixel(v, m)
  return limitar({ ...v, cx: v.cx - dx * u, cy: v.cy - dy * u })
}

/** Centra un punt del dibuix (en coordenades de pantalla del dibuix) amb una escala mínima */
export function centrar(v: Vista, x: number, y: number, escalaMinima = 2.5): Vista {
  return limitar({ escala: Math.max(v.escala, escalaMinima), cx: x, cy: y })
}
