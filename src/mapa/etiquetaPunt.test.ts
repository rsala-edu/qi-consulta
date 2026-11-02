import { describe, expect, it } from 'vitest'
import { cataleg } from '../punts/cataleg'
import { etiquetesDelPunt, representantDelGrup, textEtiqueta } from './etiquetaPunt'

const punt = (codi: string) => cataleg.punts.find((p) => p.codi === codi)!

describe('etiquetes dels punts', () => {
  it('un punt sol: el codi i, a prop, també el pinyin', () => {
    expect(etiquetesDelPunt(punt('ST36'))).toEqual({
      cos: 'ST36',
      codi: 'ST36',
      pinyin: 'ST36 · Zusanli',
      detall: 'ST36 · Zusanli',
    })
  })

  it('Jiaji: una sola etiqueta per costat (a T6) i, ampliant, el nivell a cada punt', () => {
    const jiaji = punt('EX-B2')
    expect(representantDelGrup(jiaji.subpunts!)).toBe(5)
    const t6 = etiquetesDelPunt(jiaji, 5)
    for (const n of ['cos', 'codi', 'pinyin'] as const) expect(t6[n]).toBe('EX-B2 · Jiaji')
    expect(t6.detall).toBe('T6')
    // La resta de punts del grup no porten etiqueta fins que s'amplia
    const etiquetes = jiaji.subpunts!.map((_, i) => etiquetesDelPunt(jiaji, i))
    for (const n of ['cos', 'codi', 'pinyin'] as const) expect(etiquetes.filter((e) => e[n] !== null)).toHaveLength(1)
    expect(etiquetes.map((e) => e.detall)).toEqual(jiaji.subpunts)
    // Si el text llarg no hi cap, el curt és el codi
    expect(textEtiqueta(t6, 'cos')).toEqual({ text: 'EX-B2 · Jiaji', curt: 'EX-B2' })
    expect(textEtiqueta(etiquetes[0]!, 'pinyin')).toBeNull()
  })

  it('grups amb noms llargs (Bafeng, Qiduan): una sola etiqueta, també ampliant', () => {
    for (const codi of ['EX-LE10', 'EX-LE12', 'EX-UE9']) {
      const p = punt(codi)
      const etiquetes = p.subpunts!.map((_, i) => etiquetesDelPunt(p, i))
      for (const n of ['cos', 'codi', 'pinyin', 'detall'] as const)
        expect(etiquetes.filter((e) => e[n] !== null), `${codi} ${n}`).toHaveLength(1)
    }
  })
})
