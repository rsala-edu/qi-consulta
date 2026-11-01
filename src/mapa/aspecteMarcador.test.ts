import { describe, expect, it } from 'vitest'
import { COLOR_NEUTRE, RADI_MARCAT, RADI_NEUTRE, aspecteMarcador } from './aspecteMarcador'

const MOXA = '#d9822b'

describe('aspecte dels marcadors', () => {
  it('sense marcar: petit, gris jade, sense vora ni anell', () => {
    expect(aspecteMarcador({})).toEqual({ radi: RADI_NEUTRE, color: COLOR_NEUTRE, vora: null, anell: null })
  })

  it('marcat: color de la tècnica amb vora blanca, sense anell', () => {
    const a = aspecteMarcador({ color: MOXA })
    expect(a.color).toBe(MOXA)
    expect(a.radi).toBe(RADI_MARCAT)
    expect(a.vora).toBeGreaterThan(a.radi)
    expect(a.anell).toBeNull()
  })

  it('seleccionat: conserva el color de dins i hi afegeix un anell per fora de la vora', () => {
    const marcat = aspecteMarcador({ color: MOXA, destacat: true })
    expect(marcat.color).toBe(MOXA)
    expect(marcat.anell).not.toBeNull()
    const [dins, fora] = marcat.anell!
    expect(dins).toBeGreaterThan(marcat.vora!)
    expect(fora).toBeGreaterThan(dins)

    const senseMarcar = aspecteMarcador({ destacat: true })
    expect(senseMarcar.color).toBe(COLOR_NEUTRE)
    expect(senseMarcar.anell).not.toBeNull()
  })

  it('el cinabri ja no es fa servir per al seleccionat', () => {
    expect(aspecteMarcador({ destacat: true }).color.toLowerCase()).not.toBe('#b5432f')
  })
})
