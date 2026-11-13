import { afterEach, describe, expect, it, vi } from 'vitest'
import { comprovarIteracions, ITERACIONS_PBKDF2, iteracionsNoves } from './derivacio'

const CLAU = 'qi:proves:iteracions'

describe('iteracions de PBKDF2 per a un embolcall nou', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('sense res a localStorage, les de debò (600.000)', () => {
    expect(iteracionsNoves()).toBe(600_000)
  })

  it('en desenvolupament, les proves E2E les poden baixar; un valor que no és un enter positiu no compta', () => {
    vi.stubEnv('DEV', true)
    localStorage.setItem(CLAU, '1000')
    expect(iteracionsNoves()).toBe(1000)
    for (const dolent of ['0', '-5', '1.5', 'molt', '']) {
      localStorage.setItem(CLAU, dolent)
      expect(iteracionsNoves()).toBe(ITERACIONS_PBKDF2)
    }
  })

  it('a producció, localStorage no hi fa res', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('PROD', true)
    localStorage.setItem(CLAU, '1000')
    expect(iteracionsNoves()).toBe(ITERACIONS_PBKDF2)
    expect(() => comprovarIteracions()).not.toThrow()
  })

  it('la comprovació en arrencar a producció falla si no són 600.000', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('PROD', true)
    localStorage.setItem(CLAU, '1000')
    expect(() => comprovarIteracions()).toThrow(/1000 iteracions en lloc de 600000/)
  })
})
