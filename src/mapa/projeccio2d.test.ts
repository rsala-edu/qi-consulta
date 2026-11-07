import { describe, expect, it } from 'vitest'
import { crearManiqui } from './maniqui'
import { esVeu, millorVista, projectar, silueta } from './projeccio2d'

describe('mapa 2D', () => {
  it('projecta amb la mateixa orientació que les vistes del 3D', () => {
    // El costat esquerre del pacient és +X: de davant surt a la dreta de la pantalla
    expect(projectar({ x: 0.2, y: 1, z: 0 }, 'davant')).toEqual({ x: 0.2, y: -1 })
    expect(projectar({ x: 0.2, y: 1, z: 0 }, 'darrere').x).toBeCloseTo(-0.2)
    // Des de l'esquerra (càmera a +X), la panxa (+Z) surt a l'esquerra
    expect(projectar({ x: 0, y: 1, z: 0.1 }, 'esquerra').x).toBeCloseTo(-0.1)
    expect(projectar({ x: 0, y: 1, z: 0.1 }, 'dreta').x).toBeCloseTo(0.1)
  })

  it('un punt només es veu des del costat cap on mira la pell', () => {
    const panxa = { x: 0, y: 0, z: 1 }
    expect(esVeu(panxa, 'davant')).toBe(true)
    expect(esVeu(panxa, 'darrere')).toBe(false)
    expect(esVeu(panxa, 'esquerra')).toBe(false)
    expect(millorVista(panxa)).toBe('davant')
    expect(millorVista({ x: 0.9, y: 0, z: 0.2 })).toBe('esquerra')
    expect(millorVista({ x: -0.9, y: 0, z: -0.2 })).toBe('dreta')
    expect(millorVista({ x: 0, y: 0.3, z: -1 })).toBe('darrere')
  })

  it('la silueta del maniquí: un camí que cobreix tot el cos, sense WebGL', () => {
    const g = crearManiqui()
    const s = silueta(g, 'davant', 100)
    expect(s.cami.length).toBeGreaterThan(100)
    expect(s.cami.startsWith('M')).toBe(true)
    // La caixa fa l'alçada del model
    g.computeBoundingBox()
    const b = g.boundingBox!
    expect(s.caixa[3]).toBeCloseTo(b.max.y - b.min.y, 2)
    // De costat és més estret que de davant
    expect(silueta(g, 'esquerra', 100).caixa[2]).toBeLessThan(s.caixa[2])
  })
})
