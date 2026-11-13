// @vitest-environment node
import { BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { esquemaPosicio3D } from '../punts/esquema'
import { azimutMesProper, enquadramentCos, OCUPACIO_COS, CAMERA, nivellEtiquetes, VISTA_PEU, VISTES, vistaCapAlPunt } from './camera'
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

  it('«Tot el cos» omple el requadre: mana l\'alçada, o l\'amplada si el requadre és estret', () => {
    const caixa = { min: { x: -0.5, y: 0, z: -0.1 }, max: { x: 0.5, y: 1.7, z: 0.3 } }
    const tan = Math.tan((CAMERA.fov * Math.PI) / 360)
    const ample = enquadramentCos(caixa, 1200, 600)
    expect(ample.alcada).toBeCloseTo(0.85)
    expect(1.7 / (2 * ample.distancia * tan)).toBeCloseTo(OCUPACIO_COS)
    // La mida del requadre no compta si és prou ample: el cos creix amb el requadre
    expect(enquadramentCos(caixa, 2400, 1200).distancia).toBeCloseTo(ample.distancia)
    // Estret: l'amplada del cos ocupa la mateixa part de l'amplada del requadre
    const estret = enquadramentCos(caixa, 300, 900)
    expect(1 / (2 * estret.distancia * tan * (300 / 900))).toBeCloseTo(OCUPACIO_COS)
    expect(estret.distancia).toBeLessThanOrEqual(CAMERA.distanciaMaxima)
  })

  it('mostra més informació com més a prop', () => {
    expect(nivellEtiquetes(4.4)).toBe('cap')
    expect(nivellEtiquetes(1.5)).toBe('codi')
    expect(nivellEtiquetes(0.75)).toBe('pinyin')
    expect(nivellEtiquetes(0.4)).toBe('detall')
    // amb el cos sencer, només si hi ha un meridià filtrat
    expect(nivellEtiquetes(4.4, true)).toBe('cos')
    expect(nivellEtiquetes(2.0)).toBe('cap')
    expect(nivellEtiquetes(2.0, true)).toBe('cos')
  })

  it('per anar a un punt, la càmera es posa davant la pell, a la mateixa alçada', () => {
    const { camera, objectiu } = vistaCapAlPunt(new Vector3(0.1, 1, 0.1), new Vector3(0, 0.3, 1), 0, 0.5)
    expect(objectiu.y).toBe(1)
    expect(camera.y).toBe(1)
    expect(camera.z).toBeCloseTo(0.6)
  })

  it('si la pell mira amunt, manté la direcció actual', () => {
    const { camera } = vistaCapAlPunt(new Vector3(0, 1.7, 0.1), new Vector3(0, 1, 0), Math.PI / 2, 0.5)
    expect(camera.x).toBeCloseTo(0.5)
  })

  it('els punts del dors del peu es miren des de dalt i més a prop', () => {
    // Bafeng: a l'empenya, prop dels dits
    const punt = new Vector3(0.19, 0.026, 0.156)
    const { camera, objectiu, polar } = vistaCapAlPunt(punt, new Vector3(0.2, 0.65, 0.73), 0)
    expect(objectiu).toEqual(punt)
    expect(polar).toBeCloseTo(VISTA_PEU.polar)
    expect(camera.distanceTo(punt)).toBeCloseTo(VISTA_PEU.distancia)
    expect(camera.y - punt.y).toBeCloseTo(VISTA_PEU.distancia * Math.cos(VISTA_PEU.polar)) // des de dalt
    expect(camera.z).toBeGreaterThan(punt.z) // i des de davant
    // La planta (KI1) i el mal·lèol continuen amb la càmera horitzontal
    expect(vistaCapAlPunt(new Vector3(0.18, 0.007, 0.1), new Vector3(0, -1, 0), 0).polar).toBeCloseTo(CAMERA.polar)
    expect(vistaCapAlPunt(new Vector3(0.21, 0.065, 0.02), new Vector3(1, 0, 0), 0).camera.y).toBeCloseTo(0.065)
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
