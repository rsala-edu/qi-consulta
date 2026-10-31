import { describe, expect, it } from 'vitest'
import { COLOR_TECNICA, desmarcar, marcar, nouPuntMarcat, tecnicaDelMarcador, TECNIQUES } from './puntMarcat'

describe('punts marcats', () => {
  it('marca, actualitza i desmarca', () => {
    let l = marcar([], nouPuntMarcat('ST36', 'bilateral', 'agulla'))
    l = marcar(l, nouPuntMarcat('LI4', 'E', 'moxa'))
    l = marcar(l, nouPuntMarcat('ST36', 'D', 'electro'))
    expect(l.map((p) => [p.codi, p.costat, p.tecnica])).toEqual([
      ['ST36', 'D', 'electro'],
      ['LI4', 'E', 'moxa'],
    ])
    expect(desmarcar(l, 'ST36').map((p) => p.codi)).toEqual(['LI4'])
  })

  it('pinta només el costat marcat, o tots dos si és bilateral', () => {
    const l = [nouPuntMarcat('LI4', 'E', 'moxa'), nouPuntMarcat('ST36', 'bilateral', 'agulla')]
    expect(tecnicaDelMarcador(l, 'LI4', 'E')).toBe('moxa')
    expect(tecnicaDelMarcador(l, 'LI4', 'D')).toBeUndefined()
    expect(tecnicaDelMarcador(l, 'ST36', 'E')).toBe('agulla')
    expect(tecnicaDelMarcador(l, 'ST36', 'D')).toBe('agulla')
    expect(tecnicaDelMarcador(l, 'ST25', 'E')).toBeUndefined()
  })

  it('cada tècnica té un color diferent', () => {
    expect(new Set(TECNIQUES.map((t) => COLOR_TECNICA[t])).size).toBe(TECNIQUES.length)
  })
})
