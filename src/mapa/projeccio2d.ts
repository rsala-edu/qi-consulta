// Mapa del cos en 2D (part 3): per quan no hi ha WebGL o la doctora el tria.
//
// Les quatre vistes (davant, darrere, esquerra i dreta) són projeccions
// ortogràfiques del mateix model 3D, amb la mateixa orientació que les vistes
// ràpides del visor 3D (camera.ts). Els punts també es projecten des de la
// seva posició 3D: el 2D i el 3D sempre coincideixen.
//
// La silueta es calcula sense WebGL: cada triangle es pinta en una graella i
// les files de cel·les plenes es converteixen en un camí SVG.

import type { BufferGeometry } from 'three'
import { VISTES, type Vista } from './camera'

export interface Punt2D {
  x: number
  y: number
}

type V3 = { x: number; y: number; z: number }

/** Eix horitzontal de la pantalla per a cada vista (la càmera mira cap al cos) */
function eixos(vista: Vista) {
  const a = VISTES[vista]
  return {
    /** Cap a on mira la càmera, al revés: un punt es veu si la normal hi apunta */
    capALaCamera: { x: Math.sin(a), z: Math.cos(a) },
    dreta: { x: Math.cos(a), z: -Math.sin(a) },
  }
}

/** Coordenades SVG (metres): x cap a la dreta, y cap avall */
export function projectar(p: V3, vista: Vista): Punt2D {
  const { dreta } = eixos(vista)
  return { x: p.x * dreta.x + p.z * dreta.z, y: -p.y }
}

/** El punt es veu des d'aquesta vista (la pell mira cap a la càmera) */
export function esVeu(normal: V3, vista: Vista): boolean {
  const { capALaCamera: c } = eixos(vista)
  return normal.x * c.x + normal.z * c.z > 0.05
}

/** La vista des d'on es veu millor un punt (la pell hi mira més de cara) */
export function millorVista(normal: V3): Vista {
  let millor: Vista = 'davant'
  let max = -Infinity
  for (const v of Object.keys(VISTES) as Vista[]) {
    const { capALaCamera: c } = eixos(v)
    const d = normal.x * c.x + normal.z * c.z
    if (d > max) {
      max = d
      millor = v
    }
  }
  return millor
}

export interface Silueta {
  /** Camí SVG (metres) */
  cami: string
  /** Rectangle que l'envolta: x, y, amplada, alçada */
  caixa: [number, number, number, number]
}

/** Cel·les per metre de la graella (prou fina perquè a la tauleta no es vegin esglaons) */
const RESOLUCIO = 520

export function silueta(geometria: BufferGeometry, vista: Vista, resolucio = RESOLUCIO): Silueta {
  const pos = geometria.getAttribute('position')
  const index = geometria.getIndex()
  const n = pos.count
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const p = projectar({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) }, vista)
    xs[i] = p.x
    ys[i] = p.y
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const cel = 1 / resolucio
  const ample = Math.ceil((maxX - minX) / cel) + 1
  const alt = Math.ceil((maxY - minY) / cel) + 1
  const ple = new Uint8Array(ample * alt)
  const gx = (x: number) => (x - minX) / cel
  const gy = (y: number) => (y - minY) / cel

  const triangles = index ? index.count / 3 : n / 3
  const vertex = (k: number) => (index ? index.getX(k) : k)
  for (let t = 0; t < triangles; t++) {
    const a = vertex(t * 3)
    const b = vertex(t * 3 + 1)
    const c = vertex(t * 3 + 2)
    const ax = gx(xs[a]!), ay = gy(ys[a]!)
    const bx = gx(xs[b]!), by = gy(ys[b]!)
    const cx = gx(xs[c]!), cy = gy(ys[c]!)
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
    const x1 = Math.min(ample - 1, Math.ceil(Math.max(ax, bx, cx)))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)))
    const y1 = Math.min(alt - 1, Math.ceil(Math.max(ay, by, cy)))
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (Math.abs(area) < 1e-9) {
      // Triangle de cantell: com a mínim, les cel·les dels vèrtexs
      for (const [x, y] of [[ax, ay], [bx, by], [cx, cy]] as const) ple[Math.round(y) * ample + Math.round(x)] = 1
      continue
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Centre de la cel·la dins el triangle (coordenades baricèntriques)
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
        const w2 = 1 - w0 - w1
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) ple[y * ample + x] = 1
      }
    }
  }

  // Cada tros de fila ple, un rectangle
  const r = (v: number) => Math.round(v * 10000) / 10000
  const parts: string[] = []
  for (let y = 0; y < alt; y++) {
    let x = 0
    while (x < ample) {
      if (!ple[y * ample + x]) {
        x++
        continue
      }
      const inici = x
      while (x < ample && ple[y * ample + x]) x++
      parts.push(`M${r(minX + inici * cel)} ${r(minY + y * cel)}h${r((x - inici) * cel)}v${r(cel * 1.1)}h${r(-(x - inici) * cel)}z`)
    }
  }
  return { cami: parts.join(''), caixa: [minX, minY, maxX - minX, maxY - minY] }
}
