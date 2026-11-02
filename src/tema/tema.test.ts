import { afterEach, describe, expect, it } from 'vitest'
import { atributTema, canviarTema, CLAU_TEMA, llegirTema, temaSeguent } from './tema'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('tema', () => {
  it('cicle Sistema → Clar → Fosc → Sistema', () => {
    expect(temaSeguent('sistema')).toBe('clar')
    expect(temaSeguent('clar')).toBe('fosc')
    expect(temaSeguent('fosc')).toBe('sistema')
  })

  it('per defecte, com el sistema; un valor estrany també', () => {
    expect(llegirTema()).toBe('sistema')
    localStorage.setItem(CLAU_TEMA, 'blau')
    expect(llegirTema()).toBe('sistema')
  })

  it('es desa i s\'aplica a <html> (sense atribut, segueix el sistema)', () => {
    canviarTema('fosc')
    expect(localStorage.getItem(CLAU_TEMA)).toBe('fosc')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(llegirTema()).toBe('fosc')
    canviarTema('clar')
    expect(document.documentElement.dataset.theme).toBe('light')
    canviarTema('sistema')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(atributTema('sistema')).toBeNull()
  })
})
