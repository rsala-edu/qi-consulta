import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEU_MINUTS } from './ContextSessio'
import { useAutoBloqueig } from './useAutoBloqueig'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bloqueig automàtic', () => {
  it('són 10 minuts', () => {
    expect(DEU_MINUTS).toBe(600_000)
  })

  it('bloqueja després del temps sense activitat', () => {
    const bloquejar = vi.fn()
    renderHook(() => useAutoBloqueig(true, bloquejar, DEU_MINUTS))
    vi.advanceTimersByTime(DEU_MINUTS - 1)
    expect(bloquejar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bloquejar).toHaveBeenCalledOnce()
  })

  it('cada toc o tecla reinicia el compte', () => {
    const bloquejar = vi.fn()
    renderHook(() => useAutoBloqueig(true, bloquejar, DEU_MINUTS))
    vi.advanceTimersByTime(DEU_MINUTS - 1000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(DEU_MINUTS - 1000)
    window.dispatchEvent(new KeyboardEvent('keydown'))
    vi.advanceTimersByTime(DEU_MINUTS - 1000)
    expect(bloquejar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(bloquejar).toHaveBeenCalledOnce()
  })

  it('no fa res si l\'app ja està bloquejada', () => {
    const bloquejar = vi.fn()
    renderHook(() => useAutoBloqueig(false, bloquejar, DEU_MINUTS))
    vi.advanceTimersByTime(DEU_MINUTS * 2)
    expect(bloquejar).not.toHaveBeenCalled()
  })

  it('en tornar d\'una altra app, compta el temps real: si ja ha passat, bloqueja de seguida', () => {
    const bloquejar = vi.fn()
    renderHook(() => useAutoBloqueig(true, bloquejar, DEU_MINUTS))
    // En segon pla el navegador atura els temporitzadors: el rellotge avança sense que es disparin
    vi.setSystemTime(Date.now() + DEU_MINUTS + 5000)
    const visibilitat = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(bloquejar).toHaveBeenCalledOnce()
    visibilitat.mockRestore()
  })

  it('si torna abans del límit, no bloqueja i només compta el temps que queda', () => {
    const bloquejar = vi.fn()
    renderHook(() => useAutoBloqueig(true, bloquejar, DEU_MINUTS))
    vi.setSystemTime(Date.now() + 4 * 60_000)
    const visibilitat = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(bloquejar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(6 * 60_000 - 1)
    expect(bloquejar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(bloquejar).toHaveBeenCalledOnce()
    visibilitat.mockRestore()
  })
})
