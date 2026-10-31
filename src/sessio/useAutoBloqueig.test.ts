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
})
