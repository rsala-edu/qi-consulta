// 3D o 2D: el que es va triar en aquest dispositiu (una comoditat: si el
// navegador no deixa guardar-ho, es torna a triar sol). Si el navegador no
// té WebGL, el 2D d'entrada.

export type ModeMapa = '3d' | '2d'

const CLAU = 'qi-mapa-mode'

let webgl: boolean | null = null

/**
 * El navegador pot crear un context WebGL (es prova una sola vegada). No es
 * fa loseContext() al de prova: a Chrome això pot fer perdre també el context
 * del visor que es crea just després.
 */
export function teWebgl(): boolean {
  if (webgl !== null) return webgl
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    webgl = !!gl
  } catch {
    webgl = false
  }
  return webgl
}

export function modeInicial(): ModeMapa {
  let desat: string | null = null
  try {
    desat = localStorage.getItem(CLAU)
  } catch {
    // Sense emmagatzematge: el per defecte
  }
  if (!teWebgl()) return '2d'
  return desat === '2d' ? '2d' : '3d'
}

export function desarMode(mode: ModeMapa): void {
  try {
    localStorage.setItem(CLAU, mode)
  } catch {
    // No passa res: la propera vegada es tornarà a triar
  }
}
