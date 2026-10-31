// Selecció de marcadors per proximitat a la pantalla. Amb el dit és molt
// més fiable que encertar una esfera petita: es tria el marcador visible
// més proper al toc, dins d'un radi en píxels.

import { Vector3, type Camera } from 'three'

export interface MarcadorPantalla<T> {
  dada: T
  /** Posició sobre la pell, en coordenades del món */
  punt: Vector3
  /** Normal de la pell, cap a fora */
  normal: Vector3
}

export interface ProjeccioPantalla<T> {
  dada: T
  x: number
  y: number
  /** Distància a la càmera, per ordenar */
  profunditat: number
}

/** Cert si la pell en aquest punt mira cap a la càmera (no és a l'esquena). */
export function miraLaCamera(punt: Vector3, normal: Vector3, posicioCamera: Vector3): boolean {
  return normal.dot(posicioCamera.clone().sub(punt)) > 0
}

/** Projecta a píxels els marcadors visibles (davant la càmera i de cara). */
export function projectarVisibles<T>(
  marcadors: ReadonlyArray<MarcadorPantalla<T>>,
  camera: Camera,
  amplada: number,
  alcada: number,
): ProjeccioPantalla<T>[] {
  const posCamera = camera.getWorldPosition(new Vector3())
  const v = new Vector3()
  const resultat: ProjeccioPantalla<T>[] = []
  for (const m of marcadors) {
    if (!miraLaCamera(m.punt, m.normal, posCamera)) continue
    v.copy(m.punt).project(camera)
    if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue
    resultat.push({
      dada: m.dada,
      x: ((v.x + 1) / 2) * amplada,
      y: ((1 - v.y) / 2) * alcada,
      profunditat: m.punt.distanceTo(posCamera),
    })
  }
  return resultat
}

/** El marcador projectat més proper al toc, si és dins del radi. */
export function mesProperAlToc<T>(
  projeccions: ReadonlyArray<ProjeccioPantalla<T>>,
  x: number,
  y: number,
  radi = 28,
): T | undefined {
  let millor: ProjeccioPantalla<T> | undefined
  let millorDist = radi * radi
  for (const p of projeccions) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d <= millorDist) {
      millorDist = d
      millor = p
    }
  }
  return millor?.dada
}
