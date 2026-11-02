import { describe, expect, it } from 'vitest'
import { FRASES_ENTRADA } from '../i18n/frases'
import { triarFrase } from './frase'

describe('frase de la pantalla d\'entrada', () => {
  it('hi ha les quatre frases', () => {
    expect(FRASES_ENTRADA).toHaveLength(4)
    expect(FRASES_ENTRADA).toContain('Respira. El cos coneix el camí.')
  })

  it('mai repeteix la de la vegada anterior, sigui quin sigui l\'atzar', () => {
    for (let anterior = 0; anterior < 4; anterior++)
      for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.9999]) {
        const i = triarFrase(4, anterior, () => r)
        expect(i).not.toBe(anterior)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(4)
      }
  })

  it('totes les altres frases poden sortir', () => {
    const sortides = new Set([0, 0.34, 0.67, 0.99].map((r) => triarFrase(4, 2, () => r)))
    expect([...sortides].sort()).toEqual([0, 1, 3])
  })

  it('la primera vegada (o amb un valor estrany), qualsevol', () => {
    expect(triarFrase(4, null, () => 0.99)).toBe(3)
    expect(triarFrase(4, 7, () => 0)).toBe(0)
    expect(triarFrase(1, 0)).toBe(0)
  })
})
