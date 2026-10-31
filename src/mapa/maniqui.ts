// Maniquí PROVISIONAL fet amb peces geomètriques, fins que tinguem el cos de
// MakeHuman. És determinista: sempre genera la mateixa malla (mateixa
// topologia), així que les proves de calibratge hi funcionen igual.
//
// Convencions (les mateixes que el GLB definitiu): metres, Y amunt, peus a
// Y = 0, mirant cap a +Z. L'esquerra del pacient és +X.

import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type V = [number, number, number]

/** Càpsula entre dos punts, opcionalment aixafada (escala local x/z). */
function segment(radi: number, de: V, a: V, escala: [number, number] = [1, 1]): BufferGeometry {
  const inici = new Vector3(...de)
  const fi = new Vector3(...a)
  const dir = fi.clone().sub(inici)
  const geom = new CapsuleGeometry(radi, dir.length(), 6, 16)
  geom.scale(escala[0], 1, escala[1])
  geom.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()))
  const centre = inici.add(fi).multiplyScalar(0.5)
  geom.translate(centre.x, centre.y, centre.z)
  return geom
}

function esfera(radi: number, centre: V, escala: V): BufferGeometry {
  const geom = new SphereGeometry(radi, 24, 16)
  geom.scale(...escala)
  geom.translate(...centre)
  return geom
}

function cilindre(radi: number, alt: number, centre: V): BufferGeometry {
  const geom = new CylinderGeometry(radi, radi * 1.1, alt, 16, 1, true)
  geom.translate(...centre)
  return geom
}

/** Les extremitats d'un costat; s = 1 esquerra (+X), s = −1 dreta. */
function extremitats(s: number): BufferGeometry[] {
  const x = (v: number) => v * s
  return [
    // braç, avantbraç i mà (lleugerament separats del cos)
    segment(0.046, [x(0.19), 1.4, 0], [x(0.25), 1.13, -0.01]),
    segment(0.039, [x(0.25), 1.13, -0.01], [x(0.29), 0.87, 0.03]),
    segment(0.032, [x(0.29), 0.86, 0.035], [x(0.31), 0.73, 0.045], [1, 0.55]),
    // cuixa, cama i peu
    segment(0.078, [x(0.095), 0.92, 0], [x(0.1), 0.5, 0.01]),
    segment(0.055, [x(0.1), 0.5, 0.01], [x(0.1), 0.09, -0.005]),
    segment(0.042, [x(0.1), 0.045, -0.03], [x(0.11), 0.035, 0.16], [1.1, 1]),
  ]
}

export function crearManiqui(): BufferGeometry {
  const peces = [
    esfera(0.105, [0, 1.61, 0.005], [0.88, 1.12, 1]),
    cilindre(0.052, 0.14, [0, 1.47, 0]),
    segment(0.165, [0, 1.06, 0], [0, 1.3, 0], [1.05, 0.62]), // tronc
    segment(0.15, [0, 0.9, 0], [0, 0.98, 0], [1.12, 0.72]), // pelvis
    ...extremitats(1),
    ...extremitats(-1),
  ]
  const geom = mergeGeometries(peces, false)
  if (!geom) throw new Error('No s\'ha pogut construir el maniquí')
  geom.deleteAttribute('uv')
  geom.computeBoundingBox()
  geom.computeBoundingSphere()
  return geom
}
