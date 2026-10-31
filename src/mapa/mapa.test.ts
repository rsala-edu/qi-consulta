// @vitest-environment node
import { BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { esquemaPosicio3D } from '../punts/esquema'
import { azimutMesProper, nivellEtiquetes, VISTES, vistaCapAlPunt } from './camera'
import {
  nombreTriangles,
  normalTriangle,
  posicio3D,
  posicioDesDePunt,
  posicioMesPropera,
  posicioMirall,
  puntDesDePosicio,
} from './geometria/baricentriques'
import { empremtaTopologia } from './geometria/topologia'
import { crearManiqui } from './maniqui'
import { modelManiqui } from './model'
import { mesProperAlToc, miraLaCamera, projectarVisibles } from './seleccio'

/** Un quadrat d'1 m (dos triangles) al pla Z = 0, mirant cap a +Z. */
function quadrat(escala = 1): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0].map((v) => v * escala), 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  return g
}

describe('coordenades baricèntriques', () => {
  it('fan anada i tornada entre punt i posició', () => {
    const g = quadrat()
    const p = posicioDesDePunt(g, 0, new Vector3(0.75, 0.25, 0))
    expect(p.b[0] + p.b[1] + p.b[2]).toBeCloseTo(1, 6)
    expect(puntDesDePosicio(g, p).distanceTo(new Vector3(0.75, 0.25, 0))).toBeLessThan(1e-5)
  })

  it('el punt segueix la pell si el cos canvia de forma però no de topologia', () => {
    const p = posicioDesDePunt(quadrat(), 0, new Vector3(0.75, 0.25, 0))
    // Mateixa malla, el doble de gran: el punt queda al mateix lloc relatiu
    expect(puntDesDePosicio(quadrat(2), p).distanceTo(new Vector3(1.5, 0.5, 0))).toBeLessThan(1e-5)
    expect(empremtaTopologia('x', quadrat())).toBe(empremtaTopologia('x', quadrat(2)))
  })

  it('un punt fora del triangle es porta a la vora més propera', () => {
    const p = posicioDesDePunt(quadrat(), 0, new Vector3(2, -1, 0.3))
    expect(p.b.every((v) => v >= 0 && v <= 1)).toBe(true)
    expect(puntDesDePosicio(quadrat(), p).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-5)
  })

  it('troba el triangle més proper a un punt de l\'espai', () => {
    const p = posicioMesPropera(quadrat(), new Vector3(0.2, 0.8, 0.1))
    expect(p.triangle).toBe(1)
    expect(puntDesDePosicio(quadrat(), p).distanceTo(new Vector3(0.2, 0.8, 0))).toBeLessThan(1e-5)
  })

  it('la normal del triangle mira cap a fora', () => {
    expect(normalTriangle(quadrat(), 0).z).toBeCloseTo(1)
  })

  it('rebutja un triangle que no existeix', () => {
    expect(() => puntDesDePosicio(quadrat(), { triangle: 2, b: [1, 0, 0] })).toThrow(RangeError)
  })

  it('les posicions generades compleixen el format del catàleg', () => {
    const p = posicioDesDePunt(quadrat(), 0, new Vector3(1 / 3, 0.1, 0))
    expect(esquemaPosicio3D.safeParse(posicio3D('prova', 'E', p)).success).toBe(true)
  })
})

describe('empremta de la topologia', () => {
  it('canvia si canvia la malla', () => {
    const a = quadrat()
    const b = quadrat()
    b.setIndex([0, 1, 3, 1, 2, 3])
    expect(empremtaTopologia('x', a)).not.toBe(empremtaTopologia('x', b))
    expect(empremtaTopologia('x', a)).toMatch(/^x-4v-2t-[0-9a-f]{8}$/)
  })
})

describe('maniquí provisional', () => {
  const g = crearManiqui()

  it('és determinista: sempre la mateixa topologia', () => {
    expect(modelManiqui().topologia).toBe(modelManiqui().topologia)
    expect(modelManiqui().definitiu).toBe(false)
  })

  it('fa uns 1,72 m, té els peus a terra i és simètric', () => {
    const caixa = g.boundingBox!
    expect(caixa.min.y).toBeCloseTo(0, 1)
    expect(caixa.max.y).toBeGreaterThan(1.65)
    expect(caixa.max.y).toBeLessThan(1.8)
    expect(caixa.max.x).toBeCloseTo(-caixa.min.x, 3)
  })

  it('és prou lleuger per a una tauleta', () => {
    expect(nombreTriangles(g)).toBeLessThan(20_000)
  })

  it('el mirall d\'un punt de la mà esquerra cau a la mà dreta', () => {
    const esquerra = posicioMesPropera(g, new Vector3(0.31, 0.78, 0.07))
    const dreta = posicioMirall(g, esquerra)
    const a = puntDesDePosicio(g, esquerra)
    const b = puntDesDePosicio(g, dreta)
    expect(a.x).toBeGreaterThan(0.2)
    expect(b.x).toBeCloseTo(-a.x, 3)
    expect(b.y).toBeCloseTo(a.y, 3)
    expect(b.z).toBeCloseTo(a.z, 3)
  })

  it('la normal d\'un punt del pit mira endavant', () => {
    const pit = posicioMesPropera(g, new Vector3(0, 1.2, 0.3))
    expect(normalTriangle(g, pit.triangle).z).toBeGreaterThan(0.8)
  })
})

describe('càmera', () => {
  it('les vistes: davant 0, esquerra +X, darrere π, dreta −X', () => {
    expect(Math.sin(VISTES.esquerra)).toBeCloseTo(1)
    expect(Math.sin(VISTES.dreta)).toBeCloseTo(-1)
    expect(Math.cos(VISTES.darrere)).toBeCloseTo(-1)
  })

  it('gira cap a una vista pel camí curt encara que l\'azimut porti voltes acumulades', () => {
    const volta = Math.PI * 2
    expect(azimutMesProper(3 * volta + 0.1, VISTES.davant)).toBeCloseTo(3 * volta)
    expect(azimutMesProper(0.2, VISTES.darrere)).toBeCloseTo(Math.PI)
    expect(azimutMesProper(-0.2, VISTES.darrere)).toBeCloseTo(-Math.PI)
    expect(azimutMesProper(Math.PI - 0.1, VISTES.dreta)).toBeCloseTo(1.5 * Math.PI)
  })

  it('mostra més informació com més a prop', () => {
    expect(nivellEtiquetes(4.4)).toBe('cap')
    expect(nivellEtiquetes(1.5)).toBe('codi')
    expect(nivellEtiquetes(0.6)).toBe('pinyin')
  })

  it('per anar a un punt, la càmera es posa davant la pell, a la mateixa alçada', () => {
    const { camera, objectiu } = vistaCapAlPunt(new Vector3(0.1, 1, 0.1), new Vector3(0, 0.3, 1), 0, 0.5)
    expect(objectiu.y).toBe(1)
    expect(camera.y).toBe(1)
    expect(camera.z).toBeCloseTo(0.6)
  })

  it('si la pell mira amunt, manté la direcció actual', () => {
    const { camera } = vistaCapAlPunt(new Vector3(0, 0.05, 0.1), new Vector3(0, 1, 0), Math.PI / 2, 0.5)
    expect(camera.x).toBeCloseTo(0.5)
  })
})

describe('selecció a la pantalla', () => {
  function cameraDavant() {
    const c = new PerspectiveCamera(35, 1, 0.01, 100)
    c.position.set(0, 1, 4)
    c.lookAt(0, 1, 0)
    c.updateMatrixWorld()
    return c
  }

  const marcadors = [
    { dada: 'davant', punt: new Vector3(0, 1, 0.1), normal: new Vector3(0, 0, 1) },
    { dada: 'esquena', punt: new Vector3(0, 1, -0.1), normal: new Vector3(0, 0, -1) },
    { dada: 'dalt', punt: new Vector3(0, 1.3, 0.1), normal: new Vector3(0, 0, 1) },
  ]

  it('descarta els punts que no miren la càmera', () => {
    expect(miraLaCamera(new Vector3(0, 0, -0.1), new Vector3(0, 0, -1), new Vector3(0, 0, 4))).toBe(false)
    const visibles = projectarVisibles(marcadors, cameraDavant(), 800, 800).map((p) => p.dada)
    expect(visibles).toEqual(['davant', 'dalt'])
  })

  it('projecta al centre de la pantalla el punt on mira la càmera', () => {
    const [davant] = projectarVisibles(marcadors, cameraDavant(), 800, 600)
    expect(davant!.x).toBeCloseTo(400, 0)
    expect(davant!.y).toBeCloseTo(300, 0)
  })

  it('tria el marcador més proper al toc dins el radi', () => {
    const p = projectarVisibles(marcadors, cameraDavant(), 800, 800)
    expect(mesProperAlToc(p, 405, 395)).toBe('davant')
    expect(mesProperAlToc(p, 400, 100)).toBeUndefined()
    const dalt = p.find((x) => x.dada === 'dalt')!
    expect(mesProperAlToc(p, dalt.x, dalt.y + 5)).toBe('dalt')
  })
})
