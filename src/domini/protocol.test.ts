import { describe, expect, it } from 'vitest'
import { aplicarProtocol, cercar, duplicar, EXEMPLES, nouProtocol, protocolDeSessio, suggerits } from './protocol'
import { nouPuntMarcat } from './puntMarcat'
import { mapaPunts } from './sessio'

const quatrePortes = { ...nouProtocol('Quatre portes'), punts: [nouPuntMarcat('LI4', 'bilateral', 'agulla'), nouPuntMarcat('LR3', 'bilateral', 'agulla')] }

describe('aplicar un protocol', () => {
  const actuals = mapaPunts([nouPuntMarcat('ST36', 'E', 'moxa'), nouPuntMarcat('LI4', 'D', 'electro')])

  it('substituir: només els punts del protocol', () => {
    const r = aplicarProtocol(actuals, quatrePortes, true)
    expect(Object.keys(r).sort()).toEqual(['cos:LI4', 'cos:LR3'])
    expect(r['cos:LI4']).toMatchObject({ costat: 'bilateral', tecnica: 'agulla' })
  })

  it('afegir: es queden els d\'abans; els comuns, com al protocol', () => {
    const r = aplicarProtocol(actuals, quatrePortes, false)
    expect(Object.keys(r).sort()).toEqual(['cos:LI4', 'cos:LR3', 'cos:ST36'])
    expect(r['cos:ST36']).toMatchObject({ costat: 'E', tecnica: 'moxa' })
    expect(r['cos:LI4']).toMatchObject({ costat: 'bilateral', tecnica: 'agulla' })
  })

  it('el protocol no es modifica en canviar la sessió', () => {
    const r = aplicarProtocol({}, quatrePortes, true)
    r['cos:LI4']!.costat = 'E'
    expect(quatrePortes.punts[0]!.costat).toBe('bilateral')
  })
})

describe('suggeriments i cerca', () => {
  const protocols = [
    { ...quatrePortes, etiquetes: ['Lumbàlgia', 'Liver qi stagnation'] },
    { ...nouProtocol('Insomni'), etiquetes: ['insomni'] },
    { ...nouProtocol('Arxivat'), etiquetes: ['lumbalgia'], arxivat: true },
  ]
  it('per motiu o síndrome, sense accents ni majúscules, i mai els arxivats', () => {
    expect(suggerits(protocols, ['Lumbalgia crònica']).map((p) => p.nom)).toEqual(['Quatre portes'])
    expect(suggerits(protocols, ['', 'Liver qi stagnation pattern']).map((p) => p.nom)).toEqual(['Quatre portes'])
    expect(suggerits(protocols, ['Cervicàlgia'])).toEqual([])
    expect(suggerits(protocols, [])).toEqual([])
  })
  it('cerca pel nom, una etiqueta o un codi de punt', () => {
    expect(cercar(protocols, 'lr3').map((p) => p.nom)).toEqual(['Quatre portes'])
    expect(cercar(protocols, 'INSOMNI').map((p) => p.nom)).toEqual(['Insomni'])
    expect(cercar(protocols, '')).toHaveLength(2)
  })
})

describe('desar, duplicar i exemples', () => {
  it('desar com a protocol els punts de la sessió, sense la palpació', () => {
    const p = protocolDeSessio(' Lumbar ', [nouPuntMarcat('BL23', 'bilateral', 'agulla'), nouPuntMarcat('GB30', 'E', 'palpacio')], ['Lumbàlgia'])
    expect(p).toMatchObject({ nom: 'Lumbar', etiquetes: ['Lumbàlgia'], exemple: false })
    expect(p.punts.map((x) => x.codi)).toEqual(['BL23'])
  })
  it('duplicar: una còpia que ja no és exemple ni està arxivada', () => {
    const d = duplicar({ ...quatrePortes, exemple: true, arxivat: true }, '(còpia)')
    expect(d).toMatchObject({ nom: 'Quatre portes (còpia)', exemple: false, arxivat: false })
    d.punts.pop()
    expect(quatrePortes.punts).toHaveLength(2)
  })
  it('hi ha 5 exemples clàssics, amb ids estables', () => {
    expect(EXEMPLES).toHaveLength(5)
    expect(EXEMPLES[0]!.punts.map((p) => p.codi)).toEqual(['LI4', 'LR3'])
    expect(new Set(EXEMPLES.map((e) => e.id)).size).toBe(5)
  })
})
