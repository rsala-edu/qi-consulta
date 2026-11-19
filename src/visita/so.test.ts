import { describe, expect, it } from 'vitest'
import { guanyDeVolum, PITIT } from './so'

describe('so del final de la retenció', () => {
  it('tres pitits d\'uns 0,4 s', () => {
    expect(PITIT.vegades).toBe(3)
    expect(PITIT.durada).toBeCloseTo(0.4)
  })
  it('el volum (0–100) dona un guany creixent, 0 sense volum, i es limita', () => {
    expect(guanyDeVolum(0)).toBe(0)
    expect(guanyDeVolum(50)).toBeLessThan(guanyDeVolum(100))
    expect(guanyDeVolum(150)).toBe(guanyDeVolum(100))
    expect(guanyDeVolum(-5)).toBe(0)
  })
})
