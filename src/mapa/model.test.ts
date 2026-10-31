import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { describe, expect, it, vi } from 'vitest'
import { posicioMesPropera, puntDesDePosicio } from './geometria/baricentriques'
import { crearManiqui } from './maniqui'
import { carregarModel, modelDesDeGlb, NOM_MALLA } from './model'

/** Simula el GLB que sortirà de Blender: el cos i, a més, uns ulls. */
async function glbDeProva(nomCos = NOM_MALLA): Promise<ArrayBuffer> {
  const escena = new Group()
  const cos = new Mesh(crearManiqui(), new MeshBasicMaterial())
  cos.name = nomCos
  const ulls = new Mesh(new SphereGeometry(0.012, 8, 6), new MeshBasicMaterial())
  ulls.name = 'ulls'
  escena.add(ulls, cos)
  const resultat = await new GLTFExporter().parseAsync(escena, { binary: true })
  if (!(resultat instanceof ArrayBuffer)) throw new Error('S\'esperava un GLB binari')
  return resultat
}

describe('cos definitiu des d\'un GLB', () => {
  it('llegeix la malla «cos» amb la mateixa topologia i forma', async () => {
    const model = await modelDesDeGlb(await glbDeProva())
    const original = crearManiqui()
    expect(model.definitiu).toBe(true)
    expect(model.topologia).toMatch(/^mh-/)
    expect(model.geometria.getIndex()!.count).toBe(original.getIndex()!.count)

    // Un punt calibrat sobre l'original cau al mateix lloc sobre el GLB
    const p = posicioMesPropera(original, new Vector3(0.1, 1.2, 0.2))
    expect(puntDesDePosicio(model.geometria, p).distanceTo(puntDesDePosicio(original, p))).toBeLessThan(1e-5)
  })

  it('si la malla no es diu «cos», agafa la més gran', async () => {
    const model = await modelDesDeGlb(await glbDeProva('Human'))
    expect(model.geometria.getAttribute('position').count).toBe(crearManiqui().getAttribute('position').count)
  })

  it('carrega el GLB si hi és', async () => {
    const glb = await glbDeProva()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(glb)))
    expect((await carregarModel('/')).definitiu).toBe(true)
    vi.unstubAllGlobals()
  })

  it('si no hi ha GLB (404 o una pàgina HTML), fa servir el maniquí', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 404 })))
    expect((await carregarModel('/')).definitiu).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>')))
    expect((await carregarModel('/')).definitiu).toBe(false)
    vi.unstubAllGlobals()
  })
})
