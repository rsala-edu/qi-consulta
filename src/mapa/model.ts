// Model del cos. Si existeix public/models/cos.glb (MakeHuman), es fa servir;
// si no, el maniquí provisional. No cal tocar codi per canviar-los.

import { BufferGeometry, Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { empremtaTopologia } from './geometria/topologia'
import { crearManiqui } from './maniqui'

export interface ModelCos {
  /** Cert si és el cos definitiu (GLB); fals si és el maniquí provisional */
  definitiu: boolean
  topologia: string
  geometria: BufferGeometry
}

export const RUTA_GLB = 'models/cos.glb'
/** Nom de l'objecte del cos dins el GLB */
export const NOM_MALLA = 'cos'

export function modelManiqui(): ModelCos {
  const geometria = crearManiqui()
  return { definitiu: false, topologia: empremtaTopologia('maniqui', geometria), geometria }
}

function mallaDelCos(arrel: Object3D): Mesh {
  const malles: Mesh[] = []
  arrel.traverse((o) => {
    if (o instanceof Mesh) malles.push(o)
  })
  const perNom = malles.find((m) => m.name === NOM_MALLA)
  if (perNom) return perNom
  // Si no té el nom esperat, la més gran (el cos, no els ulls)
  const gran = malles.sort((a, b) => b.geometry.getAttribute('position').count - a.geometry.getAttribute('position').count)[0]
  if (!gran) throw new Error('El GLB no conté cap malla')
  return gran
}

/** Llegeix el GLB i en treu la geometria del cos, amb les transformacions aplicades. */
export async function modelDesDeGlb(dades: ArrayBuffer): Promise<ModelCos> {
  const gltf = await new GLTFLoader().parseAsync(dades, '')
  gltf.scene.updateMatrixWorld(true)
  const malla = mallaDelCos(gltf.scene)
  const geometria = new BufferGeometry()
  geometria.setAttribute('position', malla.geometry.getAttribute('position').clone())
  const normal = malla.geometry.getAttribute('normal')
  if (normal) geometria.setAttribute('normal', normal.clone())
  const index = malla.geometry.getIndex()
  if (!index) throw new Error('La malla del GLB ha de ser indexada')
  geometria.setIndex(index.clone())
  geometria.applyMatrix4(malla.matrixWorld)
  if (!normal) geometria.computeVertexNormals()
  geometria.computeBoundingBox()
  geometria.computeBoundingSphere()
  return { definitiu: true, topologia: empremtaTopologia('mh', geometria), geometria }
}

function esGlb(dades: ArrayBuffer): boolean {
  return dades.byteLength > 12 && new TextDecoder().decode(dades.slice(0, 4)) === 'glTF'
}

/** El GLB si hi és (i és vàlid), si no el maniquí. */
export async function carregarModel(base: string = import.meta.env.BASE_URL): Promise<ModelCos> {
  try {
    const resposta = await fetch(`${base}${RUTA_GLB}`)
    if (resposta.ok) {
      const dades = await resposta.arrayBuffer()
      if (esGlb(dades)) return await modelDesDeGlb(dades)
    }
  } catch (e) {
    console.warn('No s\'ha pogut carregar el cos definitiu; es fa servir el maniquí', e)
  }
  return modelManiqui()
}
