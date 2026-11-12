import { afterEach, describe, expect, it } from 'vitest'
import { atributTema, canviarTema, CLAU_TEMA, llegirTema, temaAlternat, temaEfectiu } from './tema'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('tema', () => {
  it('la icona només alterna clar ↔ fosc, a partir del que es veu', () => {
    expect(temaAlternat('clar', true)).toBe('fosc')
    expect(temaAlternat('fosc', false)).toBe('clar')
    // «Com el sistema» només val fins al primer toc
    expect(temaAlternat('sistema', false)).toBe('fosc')
    expect(temaAlternat('sistema', true)).toBe('clar')
    expect(temaEfectiu('sistema', true)).toBe('fosc')
    expect(temaEfectiu('clar', true)).toBe('clar')
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
