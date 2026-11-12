import { beforeEach, describe, expect, it, vi } from 'vitest'

const actualitzarAra = vi.fn()
vi.mock('./actualitzacio', () => ({ actualitzarAra: () => actualitzarAra() }))
const { esErrorDeTros, recarregarPerTros } = await import('./trossos')

describe('trossos de l\'app que no es poden carregar', () => {
  beforeEach(() => {
    sessionStorage.clear()
    actualitzarAra.mockClear()
    vi.useRealTimers()
  })

  it('reconeix l\'error de Chrome, Firefox i Safari (i el del CSS), i no els altres', () => {
    expect(esErrorDeTros(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true)
    expect(esErrorDeTros(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true)
    expect(esErrorDeTros(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(esErrorDeTros(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true)
    expect(esErrorDeTros(new TypeError('Cannot read properties of undefined'))).toBe(false)
    expect(esErrorDeTros(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('es recarrega sola un sol cop: si torna a fallar al cap de poc, no (sense bucles)', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 12, 10, 0) })
    expect(recarregarPerTros()).toBe(true)
    expect(actualitzarAra).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000)
    expect(recarregarPerTros()).toBe(false)
    expect(actualitzarAra).toHaveBeenCalledTimes(1)
    // Molt més tard (una altra publicació), sí
    vi.advanceTimersByTime(10 * 60_000)
    expect(recarregarPerTros()).toBe(true)
    expect(actualitzarAra).toHaveBeenCalledTimes(2)
  })
})
