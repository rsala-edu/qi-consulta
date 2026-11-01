import { describe, expect, it } from 'vitest'
import {
  COLOR_TECNICA,
  desmarcar,
  esquemaPuntMarcat,
  marcar,
  nouPuntMarcat,
  tecnicaDelMarcador,
  TECNIQUES,
  TECNIQUES_DEL_MAPA,
} from './puntMarcat'

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

describe('punts del cos i de l\'orella a la mateixa llista', () => {
  it('el mateix codi a cada mapa són dos punts diferents', () => {
    let l = marcar([], nouPuntMarcat('TF4', 'E', 'xinxeta', 'orella'))
    l = marcar(l, nouPuntMarcat('ST36', 'bilateral', 'agulla'))
    l = marcar(l, nouPuntMarcat('TF4', 'bilateral', 'llavor', 'orella'))
    expect(l.map((p) => [p.mapa, p.codi, p.costat, p.tecnica])).toEqual([
      ['orella', 'TF4', 'bilateral', 'llavor'],
      ['cos', 'ST36', 'bilateral', 'agulla'],
    ])
    expect(tecnicaDelMarcador(l, 'TF4', 'D', 'orella')).toBe('llavor')
    expect(tecnicaDelMarcador(l, 'TF4', 'D')).toBeUndefined()
    expect(desmarcar(l, 'TF4').map((p) => p.codi)).toEqual(['TF4', 'ST36'])
    expect(desmarcar(l, 'TF4', 'orella').map((p) => p.codi)).toEqual(['ST36'])
  })

  it('cada mapa té les seves tècniques; la xinxeta només a l\'orella i la moxa només al cos', () => {
    expect(TECNIQUES_DEL_MAPA.orella).toEqual(['agulla', 'llavor', 'xinxeta', 'electro'])
    expect(esquemaPuntMarcat.safeParse(nouPuntMarcat('TF4', 'E', 'xinxeta', 'orella')).success).toBe(true)
    expect(esquemaPuntMarcat.safeParse(nouPuntMarcat('TF4', 'E', 'moxa', 'orella')).success).toBe(false)
    expect(esquemaPuntMarcat.safeParse(nouPuntMarcat('ST36', 'E', 'xinxeta')).success).toBe(false)
  })

  it('un punt desat abans de l\'orella (sense mapa) és del cos', () => {
    const { mapa: _m, ...antic } = nouPuntMarcat('LI4', 'E', 'agulla')
    expect(esquemaPuntMarcat.parse(antic).mapa).toBe('cos')
  })
})
