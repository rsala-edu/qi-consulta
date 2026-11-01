import { describe, expect, it } from 'vitest'
import { ampliar, aPantalla, centrar, desDePantalla, desplacar, ESCALA_MAXIMA, mirallX, VISTA_INICIAL } from './vista'

const m = { amplada: 600, alcada: 800 }

describe('vista de l\'orella', () => {
  it('la pantalla i el dibuix fan anada i tornada', () => {
    const v = { escala: 2.3, cx: 150, cy: 200 }
    const p = aPantalla(v, m, 120, 260)
    const d = desDePantalla(v, m, p.x, p.y)
    expect(d.x).toBeCloseTo(120, 6)
    expect(d.y).toBeCloseTo(260, 6)
  })

  it('la roda amplia cap al cursor: el punt de sota el cursor no es mou', () => {
    const cursor = { x: 420, y: 250 }
    const abans = desDePantalla(VISTA_INICIAL, m, cursor.x, cursor.y)
    const v = ampliar(VISTA_INICIAL, m, 2, cursor.x, cursor.y)
    expect(v.escala).toBe(2)
    const despres = desDePantalla(v, m, cursor.x, cursor.y)
    expect(despres.x).toBeCloseTo(abans.x, 6)
    expect(despres.y).toBeCloseTo(abans.y, 6)
  })

  it('no redueix més que l\'orella sencera ni amplia més del màxim', () => {
    expect(ampliar(VISTA_INICIAL, m, 0.5)).toEqual(VISTA_INICIAL)
    expect(ampliar(VISTA_INICIAL, m, 100).escala).toBe(ESCALA_MAXIMA)
  })

  it('arrossegar desplaça el dibuix amb el dit, i no deixa sortir del dibuix', () => {
    const v = ampliar(VISTA_INICIAL, m, 3)
    const d = desplacar(v, m, 30, 0)
    expect(d.cx).toBeLessThan(v.cx)
    const lluny = desplacar(v, m, -100000, 0)
    expect(lluny.cx).toBe(360)
    // amb l'orella sencera no es desplaça
    expect(desplacar(VISTA_INICIAL, m, 50, 50)).toEqual(VISTA_INICIAL)
  })

  it('centra un punt ampliant', () => {
    expect(centrar(VISTA_INICIAL, 150, 100)).toEqual({ escala: 2.5, cx: 150, cy: 100 })
  })

  it('la dreta és el mirall de l\'esquerra', () => {
    expect(mirallX(100, 'E')).toBe(100)
    expect(mirallX(100, 'D')).toBe(240)
    // el mirall és respecte del centre del dibuix: el contorn queda al mateix lloc
    expect(mirallX(170, 'D')).toBe(170)
    expect(mirallX(mirallX(77, 'D'), 'D')).toBe(77)
  })
})
