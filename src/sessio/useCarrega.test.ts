// useCarrega: si es desa res mentre es llegeix, es torna a llegir (el que
// s'ha llegit podria ser d'abans del desat i esborrar-lo de la pantalla).
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let escriptures = 0
vi.mock('../sincronia/escriptura', () => ({ comptadorEscriptures: () => escriptures }))

const { useCarrega } = await import('./useCarrega')

describe('useCarrega', () => {
  it('torna a llegir si mentre llegia s\'ha desat alguna cosa', async () => {
    let valor = 'abans'
    const carregar = vi.fn(async () => {
      const llegit = valor
      // Mentre es llegeix, la visita es desa (només la primera vegada)
      if (carregar.mock.calls.length === 1) {
        valor = 'després'
        escriptures++
      }
      await Promise.resolve()
      return llegit
    })
    const { result } = renderHook(() => useCarrega(carregar, []))
    await waitFor(() => expect(result.current[0]).toEqual({ estat: 'llest', dades: 'després' }))
    expect(carregar).toHaveBeenCalledTimes(2)
  })

  it('sense cap desat pel mig, llegeix una sola vegada', async () => {
    const carregar = vi.fn(async () => 'dades')
    const { result } = renderHook(() => useCarrega(carregar, []))
    await waitFor(() => expect(result.current[0]).toEqual({ estat: 'llest', dades: 'dades' }))
    expect(carregar).toHaveBeenCalledTimes(1)
  })
})
